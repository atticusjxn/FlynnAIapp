import Foundation

/// Static, non-secret app configuration.
enum FlynnConfig {
    /// Published iCloud link to the prebuilt "Take Screenshot → Capture with Flynn"
    /// shortcut. Tapping it lets the user add the shortcut in one tap.
    ///
    /// To publish: in the Shortcuts app build a shortcut that runs the
    /// **Take Screenshot** action and passes its output into the **Capture with
    /// Flynn** intent, then Share → Copy iCloud Link and paste it here.
    ///
    /// While this is `nil`, the capture-setup screen shows the manual build steps
    /// as a fallback.
    static let captureShortcutURL: URL? = nil

    /// The intent's title as it appears in the Shortcuts/Settings pickers — kept in
    /// one place so onboarding copy and the AppIntent title stay in sync.
    static let captureIntentName = "Capture with Flynn"
}
