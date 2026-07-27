import Foundation
import Supabase

protocol PartsOrdersRepositoryType: Sendable {
    func list(orgId: UUID, limit: Int) async throws -> [PartsOrderDTO]
    func fetch(id: UUID) async throws -> PartsOrderDTO
    func setStatus(id: UUID, status: String) async throws -> PartsOrderDTO
}

/// Read path for supplier orders the agent places ("order it on my account").
/// Orders are created server-side by the agent tool loop, never in the app —
/// hence no create/update here.
final class PartsOrdersRepository: PartsOrdersRepositoryType {
    private let client: SupabaseClient

    init(client: SupabaseClient = FlynnSupabase.client) {
        self.client = client
    }

    func list(orgId: UUID, limit: Int = 100) async throws -> [PartsOrderDTO] {
        try await client
            .from("parts_orders")
            .select()
            .eq("org_id", value: orgId.uuidString)
            .order("created_at", ascending: false)
            .limit(limit)
            .execute()
            .value
    }

    func fetch(id: UUID) async throws -> PartsOrderDTO {
        try await client
            .from("parts_orders")
            .select()
            .eq("id", value: id.uuidString)
            .single()
            .execute()
            .value
    }

    func setStatus(id: UUID, status: String) async throws -> PartsOrderDTO {
        struct StatusPatch: Encodable { let status: String }
        return try await client
            .from("parts_orders")
            .update(StatusPatch(status: status), returning: .representation)
            .eq("id", value: id.uuidString)
            .select()
            .single()
            .execute()
            .value
    }
}
