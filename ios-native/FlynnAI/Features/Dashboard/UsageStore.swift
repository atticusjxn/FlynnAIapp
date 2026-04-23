import Foundation
import Observation

@MainActor
@Observable
final class UsageStore {
    enum LoadState: Equatable { case idle, loading, loaded, error(String) }

    private(set) var loadState: LoadState = .idle
    private(set) var usage: UsageDTO?

    private let repository: UsageRepositoryType

    init(repository: UsageRepositoryType = UsageRepository()) {
        self.repository = repository
    }

    func load() async {
        loadState = .loading
        do {
            usage = try await repository.current()
            loadState = .loaded
        } catch {
            loadState = .error(error.localizedDescription)
        }
    }
}
