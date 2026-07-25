import Foundation

/// Identifiers shared between the main app and the keyboard extension.
/// These must match the App Group + Keychain Sharing capabilities registered in
/// the Apple Developer portal and the entitlements files.
enum FlynnShared {
    /// App Group used for shared UserDefaults (message buffer, API base URL, flags).
    static let appGroupId = "group.com.flynnai.app"

    /// Shared keychain access group for the long-lived keyboard JWT.
    /// Format is `<AppIdentifierPrefix><group>`; the prefix is the team id.
    static let keychainAccessGroup = "69T5H7R46N.com.flynnai.shared"

    /// Keys for the shared UserDefaults suite.
    enum DefaultsKey {
        static let apiBaseURL = "flynn.apiBaseURL"
        static let businessName = "flynn.businessName"
        /// Timestamp the keyboard writes on launch so the app can infer it's installed.
        static let keyboardHeartbeat = "flynn.keyboardHeartbeat"
        // Per-thread accumulate-and-update buffer.
        static let threadKey = "flynn.thread.key"
        static let threadMessages = "flynn.thread.messages"
        static let threadUpdatedAt = "flynn.thread.updatedAt"
        /// Last quick-context payload (invoices + pay links, free slots, rates) so
        /// the keyboard's chips row paints instantly on relaunch.
        static let quickContext = "flynn.quickContext"
        static let quickContextAt = "flynn.quickContext.at"
        /// An agreed-time booking staged by the keyboard for the main app to write
        /// to the calendar (the keyboard/intent can't touch EventKit themselves).
        static let stagedCalendarEvent = "flynn.staged.calendarEvent"
        /// User-authored canned messages (away reply, availability, booking link)
        /// the keyboard offers for one-tap insert. Edited in Settings → Quick messages.
        static let savedMessages = "flynn.savedMessages"
    }

    /// Keychain account name for the keyboard JWT.
    static let keyboardTokenAccount = "flynn.keyboard.jwt"

    /// A new copy that lands more than this many seconds after the last one starts
    /// a fresh conversation thread instead of appending.
    static let threadResetWindowSeconds: TimeInterval = 600

    /// Cached quick-context older than this is discarded rather than shown. Kept
    /// short because it carries invoice state: a chip must never offer a pay link
    /// for an invoice that has since been settled.
    static let quickContextFreshnessSeconds: TimeInterval = 300

    /// A staged calendar booking older than this is ignored by the app. Longer
    /// than the draft window because the user may tap the chip, then take a while
    /// to actually switch into Flynn to confirm it.
    static let stagedCalendarEventFreshnessSeconds: TimeInterval = 900
}
