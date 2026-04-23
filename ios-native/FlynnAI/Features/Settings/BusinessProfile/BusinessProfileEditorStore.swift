import Foundation

@MainActor
@Observable
final class BusinessProfileEditorStore {
    enum LoadState: Equatable {
        case idle, loading, loaded, error(String)
    }

    private(set) var loadState: LoadState = .idle
    private(set) var isSaving: Bool = false
    var input: BusinessProfileInput = .empty

    private let repository: BusinessProfileRepositoryType

    init(repository: BusinessProfileRepositoryType = BusinessProfileRepository()) {
        self.repository = repository
    }

    func load() async {
        loadState = .loading
        do {
            if let existing = try await repository.fetch() {
                input = BusinessProfileInput(from: existing)
            } else {
                input = .empty
            }
            loadState = .loaded
        } catch {
            loadState = .error(error.localizedDescription)
        }
    }

    func save() async throws -> BusinessProfileDTO {
        isSaving = true
        defer { isSaving = false }
        return try await repository.upsert(input)
    }
}
