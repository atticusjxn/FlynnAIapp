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
}
