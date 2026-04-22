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

    private let client: SupabaseClient
    private var authListenerTask: Task<Void, Never>?

    init(client: SupabaseClient = FlynnSupabase.client) {
        self.client = client
    }

    /// Call once from FlynnAIApp.init — restores session from Keychain/SDK storage.
    func bootstrap() async {
        do {
            let session = try await client.auth.session
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
        await run {
            _ = try await self.client.auth.signUp(email: email, password: password)
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

    func sendPasswordReset(email: String) async {
        await run {
            try await self.client.auth.resetPasswordForEmail(email)
        }
    }

    func signOut() async {
        await run {
            try await self.client.auth.signOut()
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
