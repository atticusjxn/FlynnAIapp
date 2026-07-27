import Foundation

/// Client for POST /api/dashboard/agent-turn — the Home agent bar's backend,
/// where "hold a button, talk or type" from the payments-first pivot
/// (~/.claude/plans/iridescent-floating-moore.md) actually runs. Same brain as
/// texting Flynn (processMessage server-side); this just carries the turn over
/// JSON instead of SMS/iMessage.
enum AgentClient {
    struct TurnResponse: Decodable {
        let bubbles: [String]
        let intent: String
        let cards: [AgentCard]?
        let pendingAction: PendingActionEcho?
    }

    /// Structured payload a tool wants drawn rather than described — a price
    /// comparison reads as a table, not a paragraph of chat. Decoded leniently
    /// so a card type this build doesn't know about is skipped, not fatal.
    struct AgentCard: Decodable, Identifiable, Hashable {
        let id = UUID()
        let type: String
        let title: String?
        let subtitle: String?
        let options: [Option]

        struct Option: Decodable, Identifiable, Hashable {
            let id = UUID()
            let seller: String
            let price: String?
            let note: String?
            let best: Bool?

            enum CodingKeys: String, CodingKey { case seller, price, note, best }
        }

        enum CodingKeys: String, CodingKey { case type, title, subtitle, options }

        init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            type = (try? c.decode(String.self, forKey: .type)) ?? "unknown"
            title = try? c.decode(String.self, forKey: .title)
            subtitle = try? c.decode(String.self, forKey: .subtitle)
            options = (try? c.decode([Option].self, forKey: .options)) ?? []
        }
    }

    struct PendingActionEcho: Decodable {
        let actionType: String?
        let confirmationMessage: String?

        enum CodingKeys: String, CodingKey {
            case actionType = "action_type"
            case confirmationMessage = "confirmation_message"
        }
    }

    enum AgentError: Error, LocalizedError {
        case notSignedIn
        case server(String)

        var errorDescription: String? {
            switch self {
            case .notSignedIn: return "You're not signed in."
            case .server(let message): return message
            }
        }
    }

    static func sendTurn(message: String) async throws -> TurnResponse {
        let session = try await FlynnSupabase.client.auth.session
        var request = URLRequest(url: FlynnEnv.flynnAPIBaseURL.appendingPathComponent("api/dashboard/agent-turn"))
        request.httpMethod = "POST"
        request.setValue("Bearer \(session.accessToken)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(["message": message])

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw AgentError.server("No response from Flynn")
        }
        guard (200..<300).contains(http.statusCode) else {
            let message = (try? JSONDecoder().decode([String: String].self, from: data))?["error"]
            throw AgentError.server(message ?? "Flynn couldn't process that (\(http.statusCode))")
        }
        return try JSONDecoder().decode(TurnResponse.self, from: data)
    }
}
