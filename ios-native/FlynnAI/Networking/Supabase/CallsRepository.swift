import Foundation
import Supabase

protocol CallsRepositoryType: Sendable {
    func list(limit: Int) async throws -> [CallDTO]
    func fetch(id: UUID) async throws -> CallDTO
}

final class CallsRepository: CallsRepositoryType {
    private let client: SupabaseClient

    init(client: SupabaseClient = FlynnSupabase.client) {
        self.client = client
    }

    func list(limit: Int = 100) async throws -> [CallDTO] {
        try await client
            .from("calls")
            .select()
            .order("created_at", ascending: false)
            .limit(limit)
            .execute()
            .value
    }

    func fetch(id: UUID) async throws -> CallDTO {
        try await client
            .from("calls")
            .select()
            .eq("id", value: id.uuidString)
            .single()
            .execute()
            .value
    }
}
