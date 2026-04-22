import Foundation

@MainActor
@Observable
final class DashboardStore {
    enum State: Equatable {
        case idle
        case loading
        case loaded
        case error(String)
    }

    var state: State = .idle
    var events: [EventDTO] = []

    private let repository: EventsRepositoryType

    init(repository: EventsRepositoryType = EventsRepository()) {
        self.repository = repository
    }

    func load() async {
        state = .loading
        do {
            let list = try await repository.list(limit: 10)
            events = list
            state = .loaded
        } catch {
            FlynnLog.network.error("Dashboard load failed: \(error.localizedDescription, privacy: .public)")
            state = .error(error.localizedDescription)
        }
    }
}
