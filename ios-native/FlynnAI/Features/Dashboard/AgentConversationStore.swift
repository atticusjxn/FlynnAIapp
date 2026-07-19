import Foundation

/// Turn history for the Home agent bar — what you said/typed and what Flynn
/// did about it, rendered inline as cards above the input bar. Separate from
/// DashboardStore (which loads the proactive "what Flynn's been up to" feed)
/// so a fresh turn can append instantly without a full dashboard reload.
@MainActor
@Observable
final class AgentConversationStore {
    struct Turn: Identifiable {
        let id = UUID()
        let message: String
        var bubbles: [String] = []
        var isPending: Bool = true
        var errorMessage: String?
    }

    var turns: [Turn] = []
    var isSending: Bool = false

    func send(_ message: String) async {
        let trimmed = message.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, !isSending else { return }

        var turn = Turn(message: trimmed)
        let index = turns.count
        turns.append(turn)
        isSending = true
        defer { isSending = false }

        do {
            let response = try await AgentClient.sendTurn(message: trimmed)
            turn.bubbles = response.bubbles
            turn.isPending = false
        } catch {
            turn.isPending = false
            turn.errorMessage = error.localizedDescription
        }
        if turns.indices.contains(index) {
            turns[index] = turn
        }
    }
}
