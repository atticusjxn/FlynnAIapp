import SwiftUI

@MainActor
@Observable
final class MemoryStore {
    var facts: [MemoryFact] = []
    var isLoading = false
    var errorMessage: String?

    private let repo = MemoryRepository()

    /// Facts passively extracted, awaiting the owner's keep/discard.
    var toReview: [MemoryFact] { facts.filter { $0.isUnconfirmed } }
    /// Kept facts, grouped by subject for display.
    var rememberedBySubject: [(subject: String, facts: [MemoryFact])] {
        let confirmed = facts.filter { $0.status == "confirmed" }
        let groups = Dictionary(grouping: confirmed, by: { $0.subjectTitle })
        return groups
            .map { (subject: $0.key, facts: $0.value) }
            .sorted { $0.subject.localizedCaseInsensitiveCompare($1.subject) == .orderedAscending }
    }

    func load() async {
        isLoading = true
        defer { isLoading = false }
        do { facts = try await repo.list() }
        catch { errorMessage = "Couldn't load what Flynn remembers." }
    }

    func keep(_ fact: MemoryFact) async {
        do { try await repo.setStatus(id: fact.id, status: "confirmed"); await load() }
        catch { errorMessage = "Couldn't save that." }
    }

    func discard(_ fact: MemoryFact) async {
        facts.removeAll { $0.id == fact.id }
        try? await repo.setStatus(id: fact.id, status: "dismissed")
    }

    func delete(_ fact: MemoryFact) async {
        facts.removeAll { $0.id == fact.id }
        try? await repo.delete(id: fact.id)
    }

    func add(fact: String, subject: String?) async {
        let trimmed = fact.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        let subj = subject?.trimmingCharacters(in: .whitespacesAndNewlines)
        do {
            try await repo.add(fact: trimmed, subject: (subj?.isEmpty == false) ? subj : nil)
            await load()
        } catch { errorMessage = "Couldn't add that." }
    }
}
