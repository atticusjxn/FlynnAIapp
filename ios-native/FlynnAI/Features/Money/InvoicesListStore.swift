import Foundation

@MainActor
@Observable
final class InvoicesListStore {
    enum State: Equatable {
        case idle, loading, loaded, error(String)
    }

    var state: State = .idle
    var invoices: [InvoiceDTO] = []

    private let repository: InvoicesRepositoryType

    init(repository: InvoicesRepositoryType = InvoicesRepository()) {
        self.repository = repository
    }

    func load() async {
        state = .loading
        do {
            let orgId = try await OrgResolver.current()
            invoices = try await repository.list(orgId: orgId, limit: 200)
            state = .loaded
        } catch {
            FlynnLog.network.error("Invoices load failed: \(error.localizedDescription, privacy: .public)")
            state = .error(error.localizedDescription)
        }
    }
}
