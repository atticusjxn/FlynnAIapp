import AppKit

/// Checks and guides the user through granting Full Disk Access for iMessage.
///
/// Full Disk Access is a TCC permission in System Settings > Privacy > Full Disk Access.
/// It's not an entitlement — the app simply tries to read `chat.db` to test access.
enum iMessagePermission {
    static let chatDBPath = "\(NSHomeDirectory())/Library/Messages/chat.db"

    static var isGranted: Bool {
        FileManager.default.isReadableFile(atPath: chatDBPath)
    }

    static func openSystemSettings() {
        if let url = URL(string: "x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles") {
            NSWorkspace.shared.open(url)
        }
    }

    static let disclosureText = """
Flynn will read your Messages database locally on this Mac to prepare drafts before you ask.

Your message text is sent to Flynn's servers only to generate drafts — the same as when you manually press your hotkey. Drafts are staged silently; nothing is sent anywhere until you choose to insert a draft.

This feature runs only while Flynn is open on this Mac. Drafts are not pre-loaded on other devices.
"""
}
