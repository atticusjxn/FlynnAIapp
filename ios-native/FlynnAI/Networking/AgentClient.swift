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
        let pendingAction: PendingActionEcho?
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
