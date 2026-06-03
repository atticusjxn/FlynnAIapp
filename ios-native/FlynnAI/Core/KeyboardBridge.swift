import Foundation

/// Bridges the main app and the keyboard extension. The sandboxed keyboard can't
/// run the Supabase SDK or refresh short-lived tokens, so the app mints a
/// long-lived keyboard JWT (`/api/keyboard/provision-token`) and stashes it, plus
/// the API base URL and business name, in the shared App Group / keychain for the
/// keyboard to use. Call on launch, on foreground, and after sign-in.
enum KeyboardBridge {

    private struct ProvisionTokenResponse: Decodable {
        let token: String
        let expiresAt: String?
    }

    /// Refresh everything the keyboard needs. Best-effort: never throws.
    static func sync(businessName: String? = nil) async {
        // Always publish the API base URL so the keyboard can reach the backend.
        SharedStore.apiBaseURL = FlynnEnv.flynnAPIBaseURL.absoluteString
        if let businessName, !businessName.isEmpty {
            SharedStore.businessName = businessName
        }

        do {
            let session = try await FlynnSupabase.client.auth.session
            var req = URLRequest(
                url: FlynnEnv.flynnAPIBaseURL.appendingPathComponent("api/keyboard/provision-token")
            )
            req.httpMethod = "POST"
            req.setValue("Bearer \(session.accessToken)", forHTTPHeaderField: "Authorization")
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.httpBody = Data("{}".utf8)

            let (data, response) = try await URLSession.shared.data(for: req)
            guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
                return
            }
            let decoded = try JSONDecoder().decode(ProvisionTokenResponse.self, from: data)
            SharedSecureStore.setKeyboardToken(decoded.token)
        } catch {
            // No session yet, or network error — the keyboard shows its
            // "open Flynn to finish setup" state until this succeeds.
        }
    }

    /// Clear the keyboard's access on sign-out.
    static func clear() {
        SharedSecureStore.delete(account: FlynnShared.keyboardTokenAccount)
    }
}
