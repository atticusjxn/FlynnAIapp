import Foundation
import Supabase

@MainActor
@Observable
final class AuthStore {
    enum State: Equatable {
        case loading
        case signedOut
        case signedIn(userID: UUID, email: String?)
    }

    var state: State = .loading
    var errorMessage: String?
    var isSubmitting: Bool = false
    /// Set true after a successful email signup that requires email confirmation.
    /// LoginView observes this to show "Check your email — we sent you a link."
    var awaitingEmailConfirmation: Bool = false

    private let client: SupabaseClient
    private var authListenerTask: Task<Void, Never>?

    private static let authCallbackURL = URL(string: "flynnai://auth/callback")!

    init(client: SupabaseClient = FlynnSupabase.client) {
        self.client = client
    }

    /// Call once from FlynnAIApp.init — restores session from Keychain/SDK storage.
    func bootstrap() async {
        do {
            // 6-second timeout guards against the Supabase SDK hanging on first launch
            // (observed in iOS 26 Simulator when no prior keychain session exists).
            let session = try await withThrowingTaskGroup(of: Session.self) { group in
                group.addTask { try await self.client.auth.session }
                group.addTask {
                    try await Task.sleep(for: .seconds(6))
                    throw CancellationError()
                }
                let result = try await group.next()!
                group.cancelAll()
                return result
            }
            // A keychain-restored session is trusted by the SDK without any server
            // check, so a deleted/revoked user whose access token hasn't expired yet
            // stays "signed in" indefinitely (and never sees the login screen).
            // Validate it against the server before trusting it.
            try await validateRestoredSession()
            setSignedIn(session: session)
        } catch {
            FlynnLog.auth.info("No valid session on launch: \(error.localizedDescription, privacy: .public)")
            // Clear any stale keychain session locally so the user lands on login.
            try? await client.auth.signOut(scope: .local)
            state = .signedOut
        }

        // Subscribe to future auth state changes.
        authListenerTask = Task { [weak self] in
            guard let self else { return }
            for await change in self.client.auth.authStateChanges {
                await self.handle(event: change.event, session: change.session)
            }
        }
    }

    private func handle(event: AuthChangeEvent, session: Session?) async {
        switch event {
        case .signedIn, .tokenRefreshed, .userUpdated:
            if let session { setSignedIn(session: session) }
        case .signedOut, .userDeleted:
            state = .signedOut
        default:
            break
        }
    }

    private func setSignedIn(session: Session) {
        state = .signedIn(userID: session.user.id, email: session.user.email)
    }

    /// Confirms the restored session still maps to a live user server-side by
    /// fetching `/auth/v1/user`. Throws on a genuine auth rejection (user deleted
    /// or token revoked) so the caller signs out; swallows transient/offline
    /// failures so a flaky-network launch keeps the cached session.
    private func validateRestoredSession() async throws {
        do {
            _ = try await withThrowingTaskGroup(of: User.self) { group in
                group.addTask { try await self.client.auth.user() }
                group.addTask {
                    try await Task.sleep(for: .seconds(6))
                    throw CancellationError()
                }
                let result = try await group.next()!
                group.cancelAll()
                return result
            }
        } catch is CancellationError {
            return                              // validation timed out — trust cached session
        } catch let error as URLError {
            FlynnLog.auth.info("Session validation offline (\(error.code.rawValue, privacy: .public)); keeping cached session")
            return                              // offline — don't kick the user
        }
        // Any other error (user not found / token revoked) propagates → sign out.
    }

    // MARK: - Public actions

    func signIn(email: String, password: String) async {
        await run {
            _ = try await self.client.auth.signIn(email: email, password: password)
        }
    }

    func signUp(email: String, password: String) async {
        awaitingEmailConfirmation = false
        await run {
            let response = try await self.client.auth.signUp(
                email: email,
                password: password,
                redirectTo: Self.authCallbackURL
            )
            // If session is nil after signUp, Supabase is waiting on email confirmation.
            if response.session == nil {
                self.awaitingEmailConfirmation = true
            }
        }
    }

    func signInWithOTP(email: String) async {
        await run {
            try await self.client.auth.signInWithOTP(email: email)
        }
    }

    func verifyOTP(email: String, token: String) async {
        await run {
            _ = try await self.client.auth.verifyOTP(email: email, token: token, type: .email)
        }
    }

    /// Sends an SMS OTP to the given phone. Supabase merges signin/signup for phone,
    /// so the same call handles both new and existing users.
    func signInWithPhone(phone: String) async {
        await run {
            try await self.client.auth.signInWithOTP(phone: phone)
        }
    }

    /// Verifies the SMS OTP and on success transitions the store to .signedIn via
    /// the auth state listener.
    func verifyPhoneOTP(phone: String, token: String) async {
        await run {
            _ = try await self.client.auth.verifyOTP(phone: phone, token: token, type: .sms)
        }
    }

    func sendPasswordReset(email: String) async {
        await run {
            try await self.client.auth.resetPasswordForEmail(email, redirectTo: Self.authCallbackURL)
        }
    }

    func signOut() async {
        await run {
            try await self.client.auth.signOut()
        }
    }

    /// Called when the OS delivers `flynnai://auth/callback?...`. Handles two flows:
    ///  - Frictionless app sign-in: a `token_hash` magic link texted to the user by
    ///    Flynn (no OTP typed) → exchanged via `verifyOTP(tokenHash:)`.
    ///  - Legacy implicit flow (email confirmation / password reset) carrying a
    ///    `code`/fragment → exchanged via `session(from:)`.
    /// On success the auth state listener transitions the store to `.signedIn`.
    func handleAuthCallback(url: URL) async {
        guard url.absoluteString.hasPrefix("flynnai://auth/callback") else { return }
        let components = URLComponents(url: url, resolvingAgainstBaseURL: false)
        let tokenHash = components?.queryItems?.first(where: { $0.name == "token_hash" })?.value

        await run {
            if let tokenHash, !tokenHash.isEmpty {
                _ = try await self.client.auth.verifyOTP(tokenHash: tokenHash, type: .magiclink)
            } else {
                try await self.client.auth.session(from: url)
            }
            self.awaitingEmailConfirmation = false
        }
    }

    /// Asks the backend to text a single-use sign-in link to `phone`. Used by the
    /// entry screen's "text me a link" path. No OTP — receipt of the link on that
    /// phone is the proof of identity.
    func requestAppLink(phone: String) async -> Bool {
        var ok = false
        await run {
            let url = FlynnEnv.flynnAPIBaseURL.appendingPathComponent("api/auth/app-link")
            var req = URLRequest(url: url)
            req.httpMethod = "POST"
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.httpBody = try JSONSerialization.data(withJSONObject: ["phone": phone])
            let (data, response) = try await URLSession.shared.data(for: req)
            guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
                let msg = (try? JSONSerialization.jsonObject(with: data) as? [String: Any])?["error"] as? String
                throw NSError(domain: "FlynnAuth", code: 1, userInfo: [NSLocalizedDescriptionKey: msg ?? "Couldn't send the link. Try again."])
            }
            ok = true
        }
        return ok
    }

    // MARK: - Helper

    private func run(_ work: @escaping () async throws -> Void) async {
        errorMessage = nil
        isSubmitting = true
        defer { isSubmitting = false }
        do {
            try await work()
        } catch {
            FlynnLog.auth.error("Auth error: \(error.localizedDescription, privacy: .public)")
            errorMessage = error.localizedDescription
        }
    }
}
