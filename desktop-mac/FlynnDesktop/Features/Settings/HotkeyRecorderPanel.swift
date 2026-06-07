import AppKit
import SwiftUI
import KeyboardShortcuts

/// Lightweight panel for changing the invoke hotkey.
/// The only native UI surface besides the draft popup.
@MainActor
final class HotkeyRecorderPanel: NSPanel {
    static let shared = HotkeyRecorderPanel()

    private init() {
        super.init(
            contentRect: NSRect(x: 0, y: 0, width: 320, height: 100),
            styleMask: [.titled, .closable, .fullSizeContentView],
            backing: .buffered,
            defer: false
        )
        title = "Change Hotkey"
        isMovableByWindowBackground = true
        titlebarAppearsTransparent = true
        contentView = NSHostingView(rootView: HotkeyRecorderView())
    }

    func show() {
        center()
        NSApp.activate(ignoringOtherApps: true)
        makeKeyAndOrderFront(nil)
    }
}

private struct HotkeyRecorderView: View {
    var body: some View {
        VStack(spacing: 10) {
            Text("Invoke shortcut")
                .font(.headline)
            KeyboardShortcuts.Recorder("", name: .invoke)
                .frame(width: 200)
        }
        .padding(20)
        .frame(width: 320, height: 100)
    }
}
