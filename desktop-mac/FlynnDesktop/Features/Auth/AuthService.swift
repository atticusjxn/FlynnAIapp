import Foundation
import Supabase
import AppKit

/// Auth state and sign-in/out operations using Supabase. Persists the session
/// token in the system Keychain (macOS Keychain Services via the Supabase SDK).
@MainActor
@Observable
final class AuthService {
    static let shared = AuthService()

    private(set) var isLoggedIn = false
    private(set) var userID: UUID?
    private(set) var userEmail: String?
    private(set) var isSubmitting = false
    private(set) var errorMessage: String?
    private(set) var awaitingEmailConfirmation = false

    private let supabase = FlynnSupabase.client

    private init() {
        Task { await restoreSession() }
    }

    // MARK: - Session

    func restoreSession() async {
        do {
            let session = try await supabase.auth.session
            applySession(session)
        } catch {
            isLoggedIn = false
        }
    }

    var currentJWT: String? {
        get async {
            try? await supabase.auth.session.accessToken
        }
    }

    // MARK: - Sign in / up

    func signIn(email: String, password: String) async {
        isSubmitting = true; errorMessage = nil
        defer { isSubmitting = false }
        do {
            let session = try await supabase.auth.signIn(email: email, password: password)
            applySession(session)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func signUp(email: String, password: String) async {
        isSubmitting = true; errorMessage = nil; awaitingEmailConfirmation = false
        defer { isSubmitting = false }
        do {
            let response = try await supabase.auth.signUp(email: email, password: password)
            if response.session == nil {
                awaitingEmailConfirmation = true
            } else {
                applySession(response.session!)
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func signInWithOTP(email: String) async {
        isSubmitting = true; errorMessage = nil
        defer { isSubmitting = false }
        do {
            try await supabase.auth.signInWithOTP(email: email)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func verifyOTP(email: String, token: String) async {
        isSubmitting = true; errorMessage = nil
        defer { isSubmitting = false }
        do {
            let response = try await supabase.auth.verifyOTP(email: email, token: token, type: .email)
            if let session = response.session {
                applySession(session)
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func signOut() async {
        try? await supabase.auth.signOut()
        isLoggedIn = false; userID = nil; userEmail = nil
    }

    // MARK: - Private

    private func applySession(_ session: Session) {
        isLoggedIn = true
        userID = UUID(uuidString: session.user.id.uuidString)
        userEmail = session.user.email
    }
}
