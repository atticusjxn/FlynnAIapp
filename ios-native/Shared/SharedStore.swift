import Foundation

/// Shared App Group storage for non-secret state the keyboard and app exchange:
/// the API base URL, business name, a keyboard install heartbeat, and the
/// per-thread "accumulate and update" message buffer.
///
/// Buffer behaviour (per product spec): the first copied message starts a thread
/// and drafts immediately; each additional copy within the reset window appends
/// and re-drafts with the fuller context. A long gap or an explicit reset starts
/// a new thread.
enum SharedStore {
    private static var defaults: UserDefaults? {
        UserDefaults(suiteName: FlynnShared.appGroupId)
    }

    // MARK: Config the app writes for the keyboard to read

    static var apiBaseURL: String? {
        get { defaults?.string(forKey: FlynnShared.DefaultsKey.apiBaseURL) }
        set { defaults?.set(newValue, forKey: FlynnShared.DefaultsKey.apiBaseURL) }
    }

    static var businessName: String? {
        get { defaults?.string(forKey: FlynnShared.DefaultsKey.businessName) }
        set { defaults?.set(newValue, forKey: FlynnShared.DefaultsKey.businessName) }
    }

    /// The keyboard stamps this on launch; the app reads it to confirm the
    /// keyboard has been added and opened at least once.
    static func stampKeyboardHeartbeat() {
        defaults?.set(Date().timeIntervalSince1970, forKey: FlynnShared.DefaultsKey.keyboardHeartbeat)
    }

    static var keyboardHeartbeat: Date? {
        let ts = defaults?.double(forKey: FlynnShared.DefaultsKey.keyboardHeartbeat) ?? 0
        return ts > 0 ? Date(timeIntervalSince1970: ts) : nil
    }

    // MARK: Thread buffer

    static var currentThreadKey: String? {
        defaults?.string(forKey: FlynnShared.DefaultsKey.threadKey)
    }

    static var currentMessages: [String] {
        defaults?.stringArray(forKey: FlynnShared.DefaultsKey.threadMessages) ?? []
    }

    private static var lastUpdatedAt: TimeInterval {
        defaults?.double(forKey: FlynnShared.DefaultsKey.threadUpdatedAt) ?? 0
    }

    /// Append a freshly-copied customer message, starting a new thread if the
    /// previous one is stale or empty. De-dupes an identical consecutive copy.
    /// Returns the full set of messages to draft from.
    @discardableResult
    static func appendCopiedMessage(_ raw: String) -> [String] {
        let text = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return currentMessages }

        let now = Date().timeIntervalSince1970
        let stale = (now - lastUpdatedAt) > FlynnShared.threadResetWindowSeconds
        var messages = currentMessages

        if currentThreadKey == nil || stale {
            startNewThread(with: text)
            return [text]
        }

        // Ignore an identical consecutive copy (re-opening the keyboard re-reads
        // the same clipboard contents).
        if messages.last?.caseInsensitiveCompare(text) != .orderedSame {
            messages.append(text)
        }
        defaults?.set(messages, forKey: FlynnShared.DefaultsKey.threadMessages)
        defaults?.set(now, forKey: FlynnShared.DefaultsKey.threadUpdatedAt)
        return messages
    }

    static func startNewThread(with first: String? = nil) {
        defaults?.set(UUID().uuidString, forKey: FlynnShared.DefaultsKey.threadKey)
        let messages = first.map { [$0] } ?? []
        defaults?.set(messages, forKey: FlynnShared.DefaultsKey.threadMessages)
        defaults?.set(Date().timeIntervalSince1970, forKey: FlynnShared.DefaultsKey.threadUpdatedAt)
    }

    static func resetThread() {
        defaults?.removeObject(forKey: FlynnShared.DefaultsKey.threadKey)
        defaults?.removeObject(forKey: FlynnShared.DefaultsKey.threadMessages)
        defaults?.removeObject(forKey: FlynnShared.DefaultsKey.threadUpdatedAt)
    }

    // MARK: Quick-context cache (chips)

    private static var stagedEncoder: JSONEncoder {
        let e = JSONEncoder()
        e.dateEncodingStrategy = .secondsSince1970
        return e
    }

    private static var stagedDecoder: JSONDecoder {
        let d = JSONDecoder()
        d.dateDecodingStrategy = .secondsSince1970
        return d
    }

    /// Last quick-context payload the keyboard fetched (invoices with pay links,
    /// free slots, priced services).
    ///
    /// Cached because the keyboard extension is relaunched constantly and gets a
    /// fresh URLSession each time (so no TLS resumption — a cold fetch can cost
    /// several hundred ms before any of our bytes arrive). The chips row paints
    /// from this synchronously, then refreshes in the background. Without the
    /// cache the chips would visibly pop in late on every single keyboard open.
    static func cacheQuickContext(_ context: QuickContext) {
        guard let data = try? stagedEncoder.encode(context) else { return }
        defaults?.set(data, forKey: FlynnShared.DefaultsKey.quickContext)
        defaults?.set(Date().timeIntervalSince1970, forKey: FlynnShared.DefaultsKey.quickContextAt)
    }

    /// The cached payload, or nil when nothing is cached or it's gone stale.
    /// Stale-but-present is treated as absent rather than shown, so a chip can
    /// never insert a pay link for an invoice that was settled days ago.
    static func cachedQuickContext() -> QuickContext? {
        guard
            let data = defaults?.data(forKey: FlynnShared.DefaultsKey.quickContext),
            let context = try? stagedDecoder.decode(QuickContext.self, from: data)
        else { return nil }
        let cachedAt = defaults?.double(forKey: FlynnShared.DefaultsKey.quickContextAt) ?? 0
        guard cachedAt > 0,
              Date().timeIntervalSince1970 - cachedAt <= FlynnShared.quickContextFreshnessSeconds
        else { return nil }
        return context
    }

    // MARK: Staged calendar booking (keyboard → main app)

    /// The app reads this on foreground. Returns nil if there's nothing staged,
    /// it's been consumed, or it's older than the freshness window.
    static func freshPendingCalendarEvent() -> PendingCalendarEvent? {
        guard
            let data = defaults?.data(forKey: FlynnShared.DefaultsKey.stagedCalendarEvent),
            let event = try? stagedDecoder.decode(PendingCalendarEvent.self, from: data),
            !event.consumed,
            Date().timeIntervalSince(event.createdAt) <= FlynnShared.stagedCalendarEventFreshnessSeconds
        else { return nil }
        return event
    }

    /// Mark the staged booking consumed (after the user confirms or dismisses) so a
    /// re-foreground doesn't offer it again.
    static func markPendingCalendarEventConsumed() {
        guard
            let data = defaults?.data(forKey: FlynnShared.DefaultsKey.stagedCalendarEvent),
            var event = try? stagedDecoder.decode(PendingCalendarEvent.self, from: data)
        else { return }
        event.consumed = true
        if let updated = try? stagedEncoder.encode(event) {
            defaults?.set(updated, forKey: FlynnShared.DefaultsKey.stagedCalendarEvent)
            defaults?.synchronize()
        }
    }
}
