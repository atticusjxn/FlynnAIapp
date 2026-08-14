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

    /// `silently` reloads without dropping back to `.loading`.
    ///
    /// Pull-to-refresh used to call this bare, so the switch in the view fell to
    /// its `.loading` branch and the list you were holding onto was replaced,
    /// mid-gesture, by a centred spinner. The data is already on screen during a
    /// refresh; there is no reason to throw it away to fetch the same rows again.
    func load(silently: Bool = false) async {
        if !silently { state = .loading }
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
