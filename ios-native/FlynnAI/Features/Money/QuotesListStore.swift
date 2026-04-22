import Foundation

@MainActor
@Observable
final class QuotesListStore {
    enum State: Equatable {
        case idle, loading, loaded, error(String)
    }

    var state: State = .idle
    var quotes: [QuoteDTO] = []

    private let repository: QuotesRepositoryType

    init(repository: QuotesRepositoryType = QuotesRepository()) {
        self.repository = repository
    }

    func load() async {
        state = .loading
        do {
            let orgId = try await OrgResolver.current()
            quotes = try await repository.list(orgId: orgId, limit: 200)
            state = .loaded
        } catch {
            FlynnLog.network.error("Quotes load failed: \(error.localizedDescription, privacy: .public)")
            state = .error(error.localizedDescription)
        }
    }
}
