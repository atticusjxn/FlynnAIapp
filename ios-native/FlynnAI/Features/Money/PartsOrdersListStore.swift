import Foundation

@MainActor
@Observable
final class PartsOrdersListStore {
    enum State: Equatable {
        case idle, loading, loaded, error(String)
    }

    var state: State = .idle
    var orders: [PartsOrderDTO] = []

    private let repository: PartsOrdersRepositoryType

    init(repository: PartsOrdersRepositoryType = PartsOrdersRepository()) {
        self.repository = repository
    }

    func load() async {
        state = .loading
        do {
            let orgId = try await OrgResolver.current()
            orders = try await repository.list(orgId: orgId, limit: 100)
            state = .loaded
        } catch {
            FlynnLog.network.error("Parts orders load failed: \(error.localizedDescription, privacy: .public)")
            state = .error(error.localizedDescription)
        }
    }

    /// Spend across orders still to be collected — the number worth surfacing
    /// above the list, since placed-but-not-picked-up is the actionable state.
    var outstandingTotal: Double {
        orders
            .filter { ["placed", "confirmed", "ready_for_pickup"].contains($0.status.lowercased()) }
            .reduce(0) { $0 + $1.total }
    }
}
