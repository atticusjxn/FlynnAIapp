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
    }

    /// Keychain account name for the keyboard JWT.
    static let keyboardTokenAccount = "flynn.keyboard.jwt"

    /// A new copy that lands more than this many seconds after the last one starts
    /// a fresh conversation thread instead of appending.
    static let threadResetWindowSeconds: TimeInterval = 600
}
