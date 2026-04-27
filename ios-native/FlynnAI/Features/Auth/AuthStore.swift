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
            setSignedIn(session: session)
        } catch {
            FlynnLog.auth.info("No active session on launch")
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

    /// Called when the OS delivers `flynnai://auth/callback?code=...` (email
    /// confirmation, magic link, password reset). Exchanges the URL for a
    /// Supabase session.
    func handleAuthCallback(url: URL) async {
        guard url.absoluteString.hasPrefix("flynnai://auth/callback") else { return }
        await run {
            try await self.client.auth.session(from: url)
            self.awaitingEmailConfirmation = false
        }
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
