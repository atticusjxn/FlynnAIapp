import AppKit

enum SettingsSection: String {
    case businessBrain = "business-brain"
    case voiceTone     = "voice-tone"
    case calendar      = "calendar"
    case account       = "account"
    case learned       = "learned"
}

/// Opens the web settings app in the default browser, passing the Supabase session
/// via URL fragment so the user isn't asked to log in again.
///
/// v2 swap point: replace `NSWorkspace.shared.open(...)` with a WKWebView NSPanel.
enum SettingsOpener {
    private static let baseURL = "https://flynnai.app/app/settings"

    static func open(section: SettingsSection = .businessBrain) {
        Task { @MainActor in
            if let session = try? await FlynnSupabase.client.auth.session {
                var comps = URLComponents(string: baseURL)!
                comps.fragment = "access_token=\(session.accessToken)&refresh_token=\(session.refreshToken)&section=\(section.rawValue)"
                NSWorkspace.shared.open(comps.url!)
            } else {
                NSWorkspace.shared.open(URL(string: baseURL)!)
            }
        }
    }
}
