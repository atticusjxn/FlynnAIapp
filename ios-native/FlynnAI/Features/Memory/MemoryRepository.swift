import Foundation

/// Talks to the `/api/memory` endpoints with the Supabase session token (same
/// pattern as `QuotesRepository`).
struct MemoryRepository {
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
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            throw URLError(.badServerResponse)
        }
    }

    func list() async throws -> [MemoryFact] {
        let req = try await request("api/memory", method: "GET")
        let (data, response) = try await URLSession.shared.data(for: req)
        try Self.check(response)
        struct Wrapper: Decodable { let facts: [MemoryFact] }
        return try JSONDecoder().decode(Wrapper.self, from: data).facts
    }

    func setStatus(id: UUID, status: String) async throws {
        var req = try await request("api/memory/\(id.uuidString)/status", method: "POST")
        req.httpBody = try JSONEncoder().encode(["status": status])
        let (_, response) = try await URLSession.shared.data(for: req)
        try Self.check(response)
    }

    func add(fact: String, subject: String?) async throws {
        struct Body: Encodable { let fact: String; let subject: String? }
        var req = try await request("api/memory", method: "POST")
        req.httpBody = try JSONEncoder().encode(Body(fact: fact, subject: subject))
        let (_, response) = try await URLSession.shared.data(for: req)
        try Self.check(response)
    }

    func delete(id: UUID) async throws {
        let req = try await request("api/memory/\(id.uuidString)", method: "DELETE")
        let (_, response) = try await URLSession.shared.data(for: req)
        try Self.check(response)
    }
}
