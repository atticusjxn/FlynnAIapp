import Foundation
import Supabase

protocol QuotesRepositoryType: Sendable {
    func list(orgId: UUID, limit: Int) async throws -> [QuoteDTO]
    func fetch(id: UUID) async throws -> QuoteDTO
}

final class QuotesRepository: QuotesRepositoryType {
    private let client: SupabaseClient

    init(client: SupabaseClient = FlynnSupabase.client) {
        self.client = client
    }

    func list(orgId: UUID, limit: Int = 100) async throws -> [QuoteDTO] {
        try await client
            .from("quotes")
            .select()
            .eq("org_id", value: orgId.uuidString)
            .order("created_at", ascending: false)
            .limit(limit)
            .execute()
            .value
    }

    func fetch(id: UUID) async throws -> QuoteDTO {
        try await client
            .from("quotes")
            .select()
            .eq("id", value: id.uuidString)
            .single()
            .execute()
            .value
    }
}
