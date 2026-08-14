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

    /// `silently` reloads without dropping back to `.loading`.
    ///
    /// Pull-to-refresh used to call this bare, so the switch in the view fell to
    /// its `.loading` branch and the list you were holding onto was replaced,
    /// mid-gesture, by a centred spinner. The data is already on screen during a
    /// refresh; there is no reason to throw it away to fetch the same rows again.
    func load(silently: Bool = false) async {
        if !silently { state = .loading }
        do {
            calls = try await repository.list(limit: 200)
            state = .loaded
        } catch {
            FlynnLog.network.error("Calls load failed: \(error.localizedDescription, privacy: .public)")
            state = .error(error.localizedDescription)
        }
    }
}
