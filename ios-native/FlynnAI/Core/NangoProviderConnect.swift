import Foundation
import UIKit
import AuthenticationServices
import Supabase

/// Drives an OAuth connect handshake for a provider that lives behind
/// self-hosted Nango (Xero today; any future Nango-backed provider reuses
/// this rather than a new one-off flow).
///
/// This differs from `GoogleCalendarConnect` in one load-bearing way: Google's
/// OAuth exchange terminates on OUR OWN `/api/integrations/google-calendar/
/// callback`, which redirects to `flynnai://…` and `ASWebAuthenticationSession`
/// intercepts that to close the sheet automatically. A Nango-backed provider's
/// exchange terminates on NANGO_HOST's own post-consent page — Flynn doesn't
/// own that page and it never redirects to `flynnai://`, so the sheet just sits
/// there until the user taps Done. That is not a bug to route around: the
/// connection is recorded server-side by the Nango auth webhook independently
/// of whether the sheet ever closes cleanly, so `connect(...)` treats a manual
/// dismissal the same as any other closure and always polls the status
/// endpoint afterward rather than trusting a callback that will not come.
@MainActor
enum NangoProviderConnect {
    enum ConnectError: LocalizedError {
        case notConfigured
        case server(Int)
        case failed(String)

        var errorDescription: String? {
            switch self {
            case .notConfigured: return "That connection isn’t available right now."
            case .server(let code): return "Couldn’t start the connection (\(code))."
            case .failed(let message): return message
            }
        }
    }

    private static let callbackScheme = "flynnai"

    // ASWebAuthenticationSession + its presenter must outlive `connect()`, so
    // hold strong references for the duration of the flow.
    private static var liveSession: ASWebAuthenticationSession?
    private static var livePresenter: NangoAuthPresentationContext?

    /// Opens the provider's consent flow, waits for the sheet to close however
    /// it closes (deep link, Nango's own success page + manual Done, or a
    /// genuine cancel), then confirms the connection against the backend.
    /// Returns `true` once the backend confirms `connected`; throws only on a
    /// hard failure to start the flow — a user closing the sheet without
    /// connecting resolves to `false`, not an error, since the sheet not
    /// auto-closing is expected for this provider family.
    static func connect(provider: String, client: SupabaseClient = FlynnSupabase.client) async throws -> Bool {
        let session = try await client.auth.session
        let authURL = try await fetchConsentURL(provider: provider, token: session.accessToken)
        await presentAndWait(url: authURL)
        return try await pollStatus(provider: provider, token: session.accessToken)
    }

    /// Current connection state, for populating the toggle on screen load —
    /// same endpoint `connect(...)` polls after the sheet closes.
    static func status(provider: String, client: SupabaseClient = FlynnSupabase.client) async -> Bool {
        guard let session = try? await client.auth.session else { return false }
        return (try? await pollStatus(provider: provider, token: session.accessToken)) ?? false
    }

    private static func fetchConsentURL(provider: String, token: String) async throws -> URL {
        var req = URLRequest(
            url: FlynnEnv.flynnAPIBaseURL.appendingPathComponent("api/integrations/\(provider)/connect")
        )
        req.httpMethod = "GET"
        req.timeoutInterval = 12
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

        let (data, response) = try await URLSession.shared.data(for: req)
        guard let http = response as? HTTPURLResponse else { throw ConnectError.server(-1) }
        guard (200...299).contains(http.statusCode) else { throw ConnectError.server(http.statusCode) }

        struct ConnectResponse: Decodable { let authUrl: String }
        guard let decoded = try? JSONDecoder().decode(ConnectResponse.self, from: data),
              let url = URL(string: decoded.authUrl) else {
            throw ConnectError.notConfigured
        }
        return url
    }

    /// Presents the sheet and resumes once it closes for ANY reason. Unlike
    /// GoogleCalendarConnect this never throws on cancellation — for this
    /// provider family, the user tapping Done on Nango's own success page
    /// *is* the success path, and is indistinguishable at this layer from a
    /// genuine cancel. `pollStatus` afterward is what tells them apart.
    private static func presentAndWait(url: URL) async {
        await withCheckedContinuation { (cont: CheckedContinuation<Void, Never>) in
            let presenter = NangoAuthPresentationContext()
            let authSession = ASWebAuthenticationSession(
                url: url,
                callbackURLScheme: callbackScheme
            ) { _, _ in
                liveSession = nil
                livePresenter = nil
                cont.resume()
            }
            authSession.presentationContextProvider = presenter
            // Reuse Safari's session so an already-signed-in user skips login.
            authSession.prefersEphemeralWebBrowserSession = false

            liveSession = authSession
            livePresenter = presenter

            if !authSession.start() {
                liveSession = nil
                livePresenter = nil
                cont.resume()
            }
        }
    }

    private static func pollStatus(provider: String, token: String) async throws -> Bool {
        var req = URLRequest(
            url: FlynnEnv.flynnAPIBaseURL.appendingPathComponent("api/integrations/\(provider)/status")
        )
        req.httpMethod = "GET"
        req.timeoutInterval = 12
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

        let (data, response) = try await URLSession.shared.data(for: req)
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            return false
        }
        struct StatusResponse: Decodable { let connected: Bool }
        return (try? JSONDecoder().decode(StatusResponse.self, from: data))?.connected ?? false
    }
}

private final class NangoAuthPresentationContext: NSObject, ASWebAuthenticationPresentationContextProviding {
    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
        let window = scenes
            .flatMap { $0.windows }
            .first(where: { $0.isKeyWindow })
            ?? scenes.first?.windows.first
        return window ?? ASPresentationAnchor()
    }
}
