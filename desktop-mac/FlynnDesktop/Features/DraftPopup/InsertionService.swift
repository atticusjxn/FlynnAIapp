import AppKit
import Carbon.HIToolbox

/// Inserts a draft string into the previously focused app by writing to the
/// pasteboard and simulating ⌘V. Called after the popup closes and the source
/// app regains focus (50ms delay in the ViewModel).
enum InsertionService {
    static func insert(text: String) {
        let pb = NSPasteboard.general
        pb.clearContents()
        pb.setString(text, forType: .string)

        guard let source = CGEventSource(stateID: .hidSystemState) else { return }

        // Key down ⌘V
        let vCode = CGKeyCode(kVK_ANSI_V)
        guard let keyDown = CGEvent(keyboardEventSource: source, virtualKey: vCode, keyDown: true) else { return }
        keyDown.flags = .maskCommand
        keyDown.post(tap: .cgAnnotatedSessionEventTap)

        // Key up ⌘V
        guard let keyUp = CGEvent(keyboardEventSource: source, virtualKey: vCode, keyDown: false) else { return }
        keyUp.flags = .maskCommand
        keyUp.post(tap: .cgAnnotatedSessionEventTap)
    }
}
