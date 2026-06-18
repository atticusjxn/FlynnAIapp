import AppKit
import ApplicationServices

/// Checks and requests the macOS Accessibility TCC permission.
///
/// Unlike sandboxed permissions, `AXUIElement` access is granted by the user in
/// System Settings > Privacy & Security > Accessibility. It is NOT tied to an
/// entitlement — the app must call `AXIsProcessTrusted()` and handle the result.
enum AccessibilityPermission {
    /// True if Flynn has been granted Accessibility access.
    static var isGranted: Bool {
        AXIsProcessTrusted()
    }

    /// Prompts macOS to show the Accessibility permission dialog (first call only).
    /// Subsequent calls after denial just return false — user must go to Settings.
    @discardableResult
    static func requestIfNeeded() -> Bool {
        let options = [kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String: true] as CFDictionary
        return AXIsProcessTrustedWithOptions(options)
    }

    /// Opens the relevant pane in System Settings directly.
    static func openSystemSettings() {
        if let url = URL(string: "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility") {
            NSWorkspace.shared.open(url)
        }
    }

    /// Polls until access is granted, with a max wait.
    static func waitForAccess(timeout: TimeInterval = 30) async -> Bool {
        let deadline = Date().addingTimeInterval(timeout)
        while Date() < deadline {
            if AXIsProcessTrusted() { return true }
            try? await Task.sleep(nanoseconds: 500_000_000) // 0.5s
        }
        return AXIsProcessTrusted()
    }
}
