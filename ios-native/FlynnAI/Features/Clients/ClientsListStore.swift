import Foundation

@MainActor
@Observable
final class ClientsListStore {
    enum State: Equatable {
        case idle, loading, loaded, error(String)
    }

    var state: State = .idle
    var clients: [ClientDTO] = []

    private let repository: ClientsRepositoryType

    init(repository: ClientsRepositoryType = ClientsRepository()) {
        self.repository = repository
    }

    func load() async {
        state = .loading
        do {
            clients = try await repository.list(limit: 200)
            state = .loaded
        } catch {
            FlynnLog.network.error("Clients load failed: \(error.localizedDescription, privacy: .public)")
            state = .error(error.localizedDescription)
        }
    }
}
