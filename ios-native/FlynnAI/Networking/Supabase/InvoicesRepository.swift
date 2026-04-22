import Foundation
import Supabase

protocol InvoicesRepositoryType: Sendable {
    func list(orgId: UUID, limit: Int) async throws -> [InvoiceDTO]
    func fetch(id: UUID) async throws -> InvoiceDTO
}

final class InvoicesRepository: InvoicesRepositoryType {
    private let client: SupabaseClient

    init(client: SupabaseClient = FlynnSupabase.client) {
        self.client = client
    }

    func list(orgId: UUID, limit: Int = 100) async throws -> [InvoiceDTO] {
        try await client
            .from("invoices")
            .select()
            .eq("org_id", value: orgId.uuidString)
            .order("created_at", ascending: false)
            .limit(limit)
            .execute()
            .value
    }

    func fetch(id: UUID) async throws -> InvoiceDTO {
        try await client
            .from("invoices")
            .select()
            .eq("id", value: id.uuidString)
            .single()
            .execute()
            .value
    }
}
