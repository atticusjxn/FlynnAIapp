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

    // MARK: Staged screenshot capture (App Intent → keyboard)

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

    /// Called by the screenshot App Intent to hand a capture to the keyboard.
    /// The intent is a short-lived background process that iOS suspends/kills the
    /// instant `perform()` returns — so `set` alone often loses the write before it
    /// flushes. `synchronize()` forces it to disk immediately so the keyboard reliably
    /// sees the capture (this is the difference between "hit or miss" and "works").
    static func stageScreenshotDraft(_ staged: StagedScreenshotDraft) {
        guard let data = try? stagedEncoder.encode(staged) else { return }
        defaults?.set(data, forKey: FlynnShared.DefaultsKey.stagedScreenshot)
        defaults?.synchronize()
    }

    /// The keyboard reads this on appear. Returns `nil` if there's nothing staged,
    /// it's already been consumed, or it's older than the freshness window — so a
    /// stale capture never overrides a fresh clipboard copy.
    static func freshStagedScreenshotDraft() -> StagedScreenshotDraft? {
        guard
            let data = defaults?.data(forKey: FlynnShared.DefaultsKey.stagedScreenshot),
            let staged = try? stagedDecoder.decode(StagedScreenshotDraft.self, from: data),
            !staged.consumed,
            Date().timeIntervalSince(staged.capturedAt) <= FlynnShared.stagedDraftFreshnessSeconds
        else { return nil }
        return staged
    }

    // MARK: OCR debug log (intent → keyboard, cleared on each new capture)

    static var ocrDebugLog: String? {
        get { defaults?.string(forKey: "flynn.debug.ocrLog") }
        set { defaults?.set(newValue, forKey: "flynn.debug.ocrLog"); defaults?.synchronize() }
    }

    /// Mark the staged capture consumed so a keyboard re-appear doesn't replay it.
    static func markStagedScreenshotConsumed() {
        guard
            let data = defaults?.data(forKey: FlynnShared.DefaultsKey.stagedScreenshot),
            var staged = try? stagedDecoder.decode(StagedScreenshotDraft.self, from: data)
        else { return }
        staged.consumed = true
        if let updated = try? stagedEncoder.encode(staged) {
            defaults?.set(updated, forKey: FlynnShared.DefaultsKey.stagedScreenshot)
            defaults?.synchronize()
        }
    }

    // MARK: Staged calendar booking (keyboard → main app)

    /// Called by the keyboard when the backend flags an agreed, genuinely-free
    /// time. The main app picks this up on its next foreground and offers the user
    /// a one-tap confirm. `synchronize()` for the same cross-process reason as the
    /// screenshot hand-off.
    static func stagePendingCalendarEvent(_ event: PendingCalendarEvent) {
        guard let data = try? stagedEncoder.encode(event) else { return }
        defaults?.set(data, forKey: FlynnShared.DefaultsKey.stagedCalendarEvent)
        defaults?.synchronize()
    }

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
