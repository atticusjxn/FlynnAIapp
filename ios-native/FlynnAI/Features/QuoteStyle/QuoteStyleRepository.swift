import Foundation

/// Talks to `/api/quote-style` with the Supabase session token.
struct QuoteStyleRepository {
    private let client = FlynnSupabase.client

    private func request(_ path: String, method: String) async throws -> URLRequest {
        let session = try await client.auth.session
        var req = URLRequest(url: FlynnEnv.flynnAPIBaseURL.appendingPathComponent(path))
        req.httpMethod = method
        req.setValue("Bearer \(session.accessToken)", forHTTPHeaderField: "Authorization")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        return req
    }

    private static func check(_ response: URLResponse) throws {
        guard let http = response as? HTTPURLResponse else { throw URLError(.badServerResponse) }
        if http.statusCode == 402 { throw QuoteStyleError.limitReached }
        guard (200...299).contains(http.statusCode) else { throw URLError(.badServerResponse) }
    }

    func get() async throws -> QuoteStyleResponse {
        let req = try await request("api/quote-style", method: "GET")
        let (data, response) = try await URLSession.shared.data(for: req)
        try Self.check(response)
        return try JSONDecoder().decode(QuoteStyleResponse.self, from: data)
    }

    /// Learn from captured document text. Returns the updated style.
    func learn(text: String, source: String) async throws -> QuoteStyleResponse {
        struct Body: Encodable { let text: String; let source: String }
        var req = try await request("api/quote-style", method: "POST")
        req.httpBody = try JSONEncoder().encode(Body(text: text, source: source))
        let (data, response) = try await URLSession.shared.data(for: req)
        try Self.check(response)
        return try JSONDecoder().decode(QuoteStyleResponse.self, from: data)
    }

    func reset() async throws {
        let req = try await request("api/quote-style", method: "DELETE")
        let (_, response) = try await URLSession.shared.data(for: req)
        try Self.check(response)
    }
}

enum QuoteStyleError: Error { case limitReached }
