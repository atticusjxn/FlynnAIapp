import SwiftUI

@main
struct FlynnDesktopApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate

    var body: some Scene {
        // No main window — this is a menu bar app.
        // LSUIElement=true in Info.plist keeps it out of the Dock.
        // The popup is a standalone NSPanel managed by DraftPopupCoordinator.
        Settings {
            SettingsView()
        }
    }
}
