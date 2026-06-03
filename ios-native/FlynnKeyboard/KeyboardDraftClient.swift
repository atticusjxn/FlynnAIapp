import Foundation

/// Network client used by the keyboard extension. Calls the backend with the
/// long-lived keyboard JWT (minted by the main app, read from the shared
/// keychain). Kept tiny and dependency-free to respect the keyboard's memory cap.
enum KeyboardDraftClient {
    enum ClientError: Error {
        case notConfigured        // missing API base URL or token
        case limitReached         // free daily draft cap hit (HTTP 402)
        case server(Int)
        case decode
    }

    private static func baseURL() -> URL? {
        guard let raw = SharedStore.apiBaseURL, let url = URL(string: raw) else { return nil }
        return url
    }

    /// Fetch reply drafts for the accumulated customer messages.
    static func fetchDrafts(messages: [String]) async throws -> [String] {
        guard let base = baseURL(), let token = SharedSecureStore.keyboardToken else {
            throw ClientError.notConfigured
        }

        var req = URLRequest(url: base.appendingPathComponent("api/keyboard/draft-replies"))
        req.httpMethod = "POST"
        req.timeoutInterval = 8
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONEncoder().encode(DraftRequest(messages: messages))

        let (data, response) = try await URLSession.shared.data(for: req)
        guard let http = response as? HTTPURLResponse else { throw ClientError.server(-1) }
        if http.statusCode == 402 { throw ClientError.limitReached }
        guard (200...299).contains(http.statusCode) else { throw ClientError.server(http.statusCode) }
        guard let decoded = try? JSONDecoder().decode(DraftResponse.self, from: data) else {
            throw ClientError.decode
        }
        return decoded.drafts
    }

    /// Best-effort: tell the backend which draft the user accepted (learning loop).
    /// Fire-and-forget; never throws into the UI.
    static func recordAccepted(text: String) {
        guard let base = baseURL(), let token = SharedSecureStore.keyboardToken else { return }
        var req = URLRequest(url: base.appendingPathComponent("api/keyboard/accept-draft"))
        req.httpMethod = "POST"
        req.timeoutInterval = 6
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try? JSONEncoder().encode(AcceptDraftRequest(text: text))
        let task = URLSession.shared.dataTask(with: req)
        task.resume()
    }
}
