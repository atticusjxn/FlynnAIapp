import AppKit
import EventKit
import KeyboardShortcuts

extension KeyboardShortcuts.Name {
    static let invoke = Self("invoke", default: .init(.space, modifiers: [.command, .shift]))
}

@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate, NSMenuDelegate {
    private var statusItem: NSStatusItem?
    private var statusMenu: NSMenu?

    func applicationDidFinishLaunching(_ notification: Notification) {
        AppState.shared.onAppDidFinishLaunching()
        setupMenuBar()
        setupHotkey()

        if !AccessibilityPermission.isGranted {
            AccessibilityPermission.requestIfNeeded()
        }
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        false
    }

    // MARK: - Menu bar

    private func setupMenuBar() {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)
        if let button = statusItem?.button {
            button.image = NSImage(systemSymbolName: "text.bubble.fill", accessibilityDescription: "Flynn")
            button.image?.isTemplate = true
        }
        let menu = NSMenu()
        menu.delegate = self
        statusMenu = menu
        statusItem?.menu = menu
    }

    // Rebuild on every open so email, calendar status, and pause label stay current.
    func menuWillOpen(_ menu: NSMenu) {
        menu.removeAllItems()

        let titleItem = NSMenuItem(title: "Flynn", action: nil, keyEquivalent: "")
        titleItem.isEnabled = false
        menu.addItem(titleItem)

        menu.addItem(.separator())

        let emailItem = NSMenuItem(title: AuthService.shared.userEmail ?? "Not signed in",
                                   action: nil, keyEquivalent: "")
        emailItem.isEnabled = false
        menu.addItem(emailItem)

        menu.addItem(.separator())

        let settingsItem = NSMenuItem(title: "Settings & Context\u{2026}",
                                      action: #selector(openSettings), keyEquivalent: "")
        settingsItem.target = self
        menu.addItem(settingsItem)

        let hotkeyItem = NSMenuItem(title: "Change Hotkey\u{2026}",
                                    action: #selector(openHotkeyPanel), keyEquivalent: "")
        hotkeyItem.target = self
        menu.addItem(hotkeyItem)

        menu.addItem(.separator())

        let calItem = NSMenuItem(title: calendarStatusTitle(), action: nil, keyEquivalent: "")
        calItem.isEnabled = false
        menu.addItem(calItem)

        let paused = AppState.shared.isPaused
        let pauseItem = NSMenuItem(title: paused ? "\u{25B6} Resume Flynn" : "\u{23F8} Pause Flynn",
                                   action: #selector(togglePause), keyEquivalent: "")
        pauseItem.target = self
        menu.addItem(pauseItem)

        menu.addItem(.separator())

        let helpItem = NSMenuItem(title: "Help & Support", action: #selector(openHelp), keyEquivalent: "")
        helpItem.target = self
        menu.addItem(helpItem)

        let quitItem = NSMenuItem(title: "Quit Flynn", action: #selector(quitApp), keyEquivalent: "q")
        quitItem.target = self
        menu.addItem(quitItem)
    }

    // MARK: - Actions

    @objc private func openSettings() {
        SettingsOpener.open()
    }

    @objc private func openHotkeyPanel() {
        HotkeyRecorderPanel.shared.show()
    }

    @objc private func togglePause() {
        AppState.shared.isPaused.toggle()
        if AppState.shared.isPaused {
            PreDraftEngine.shared.stop()
        } else if AuthService.shared.isLoggedIn {
            PreDraftEngine.shared.startIfAllowed()
        }
    }

    @objc private func openHelp() {
        NSWorkspace.shared.open(URL(string: "https://flynnai.app/help")!)
    }

    @objc private func quitApp() {
        NSApp.terminate(nil)
    }

    // MARK: - Helpers

    private func calendarStatusTitle() -> String {
        let status = EKEventStore.authorizationStatus(for: .event)
        return status == .fullAccess ? "\u{1F4C5} Calendar: Connected" : "\u{1F4C5} Calendar: Not connected"
    }

    // MARK: - Global hotkey

    private func setupHotkey() {
        KeyboardShortcuts.onKeyUp(for: .invoke) {
            DraftPopupCoordinator.shared.invoke()
        }
    }
}
