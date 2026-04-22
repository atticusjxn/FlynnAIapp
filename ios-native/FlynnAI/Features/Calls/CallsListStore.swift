import Foundation

@MainActor
@Observable
final class CallsListStore {
    enum State: Equatable {
        case idle, loading, loaded, error(String)
    }

    var state: State = .idle
    var calls: [CallDTO] = []

    private let repository: CallsRepositoryType

    init(repository: CallsRepositoryType = CallsRepository()) {
        self.repository = repository
    }

    func load() async {
        state = .loading
        do {
            calls = try await repository.list(limit: 200)
            state = .loaded
        } catch {
            FlynnLog.network.error("Calls load failed: \(error.localizedDescription, privacy: .public)")
            state = .error(error.localizedDescription)
        }
    }
}
