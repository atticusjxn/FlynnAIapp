import Foundation
import UIKit
import AuthenticationServices
import Supabase

/// Drives the Google Calendar OAuth handshake from the app:
///   1. ask the backend (authed) for the Google consent URL,
///   2. present it in an `ASWebAuthenticationSession`,
///   3. the server callback stores the tokens, flips
///      `users.google_calendar_connected`, then redirects to
///      `flynnai://calendar-connected?status=…`, which closes the sheet.
///
/// Returns normally on success; throws `ConnectError` otherwise. Callers should
/// reflect the connected state (the server has already persisted it).
@MainActor
enum GoogleCalendarConnect {
    enum ConnectError: LocalizedError {
        case notConfigured
        case server(Int)
        case cancelled
        case failed(String)

        var errorDescription: String? {
            switch self {
            case .notConfigured: return "Google Calendar connection isn’t available right now."
            case .server(let code): return "Couldn’t start Google sign-in (\(code))."
            case .cancelled: return "Connection cancelled."
            case .failed(let message): return message
            }
        }
    }

    private static let callbackScheme = "flynnai"

    // ASWebAuthenticationSession + its presenter must outlive `start()`, so hold
    // strong references for the duration of the flow.
    private static var liveSession: ASWebAuthenticationSession?
    private static var livePresenter: AuthPresentationContext?

    /// Run the full connect flow. Throws on failure; returns on success.
    static func connect(client: SupabaseClient = FlynnSupabase.client) async throws {
        let session = try await client.auth.session
        let authURL = try await fetchConsentURL(token: session.accessToken)
        try await present(url: authURL)
    }

    private static func fetchConsentURL(token: String) async throws -> URL {
        var req = URLRequest(
            url: FlynnEnv.flynnAPIBaseURL.appendingPathComponent("api/integrations/google-calendar/connect")
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

    private static func present(url: URL) async throws {
        try await withCheckedThrowingContinuation { (cont: CheckedContinuation<Void, Error>) in
            let presenter = AuthPresentationContext()
            let authSession = ASWebAuthenticationSession(
                url: url,
                callbackURLScheme: callbackScheme
            ) { callbackURL, error in
                defer { liveSession = nil; livePresenter = nil }

                if let error = error {
                    if (error as? ASWebAuthenticationSessionError)?.code == .canceledLogin {
                        cont.resume(throwing: ConnectError.cancelled)
                    } else {
                        cont.resume(throwing: ConnectError.failed(error.localizedDescription))
                    }
                    return
                }

                let status = callbackURL
                    .flatMap { URLComponents(url: $0, resolvingAgainstBaseURL: false) }?
                    .queryItems?
                    .first(where: { $0.name == "status" })?.value
                if status == "error" {
                    cont.resume(throwing: ConnectError.failed("Google declined the connection."))
                } else {
                    cont.resume(returning: ())
                }
            }
            authSession.presentationContextProvider = presenter
            // Reuse Safari's Google session so an already-signed-in user skips login.
            authSession.prefersEphemeralWebBrowserSession = false

            liveSession = authSession
            livePresenter = presenter

            if !authSession.start() {
                liveSession = nil
                livePresenter = nil
                cont.resume(throwing: ConnectError.failed("Couldn’t open Google sign-in."))
            }
        }
    }
}

private final class AuthPresentationContext: NSObject, ASWebAuthenticationPresentationContextProviding {
    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
        let window = scenes
            .flatMap { $0.windows }
            .first(where: { $0.isKeyWindow })
            ?? scenes.first?.windows.first
        return window ?? ASPresentationAnchor()
    }
}
