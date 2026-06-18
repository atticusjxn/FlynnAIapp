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
    ///
    /// Note: the iCloud *web* preview for this link shows "Unable to find the
    /// shortcut" — that's expected for any shortcut containing the third-party
    /// `Capture with Flynn` app-intent action (the web renderer can't resolve it),
    /// and does NOT mean the link is broken. On-device import works. This build of
    /// the shortcut has the Take Screenshot output wired into the intent's
    /// `screenshot` parameter with "Show When Run" off, so it runs with no prompt.
    static let captureShortcutURL: URL? = URL(string: "https://www.icloud.com/shortcuts/0b4b7130499646dcb5d81109c6303798")

    /// The intent's title as it appears in the Shortcuts/Settings pickers — kept in
    /// one place so onboarding copy and the AppIntent title stay in sync.
    static let captureIntentName = "Capture with Flynn"
}
