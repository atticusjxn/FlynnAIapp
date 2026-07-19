import Foundation
import Supabase

protocol ClientsRepositoryType: Sendable {
    func list(limit: Int) async throws -> [ClientDTO]
    func fetch(id: UUID) async throws -> ClientDTO
    func insert(_ input: ClientInput) async throws -> ClientDTO
    func update(id: UUID, _ input: ClientInput) async throws -> ClientDTO
    func delete(id: UUID) async throws
}

final class ClientsRepository: ClientsRepositoryType {
    private let client: SupabaseClient

    init(client: SupabaseClient = FlynnSupabase.client) {
        self.client = client
    }

    func list(limit: Int = 100) async throws -> [ClientDTO] {
        // No explicit org filter needed — RLS (`is_org_member(org_id)`) already
        // scopes every row to orgs the caller belongs to.
        try await client
            .from("clients")
            .select()
            .order("last_job_date", ascending: false, nullsFirst: false)
            .limit(limit)
            .execute()
            .value
    }

    func fetch(id: UUID) async throws -> ClientDTO {
        try await client
            .from("clients")
            .select()
            .eq("id", value: id.uuidString)
            .single()
            .execute()
            .value
    }

    func insert(_ input: ClientInput) async throws -> ClientDTO {
        var payload = input

        // user_id is NOT NULL with no default/trigger — an insert without it
        // fails, so always stamp it from the current session.
        if payload.userId == nil {
            payload.userId = try await client.auth.session.user.id
        }

        // org_id is nullable. Populate it when the user actually has an org so
        // the row joins the org spine, but don't block client creation for
        // users who aren't in one yet (OrgResolver throws missingDefaultOrg) —
        // the pre-existing user-scoped RLS policies still cover them.
        if payload.orgId == nil {
            payload.orgId = try? await OrgResolver.current(client: client)
        }

        return try await client
            .from("clients")
            .insert(payload, returning: .representation)
            .select()
            .single()
            .execute()
            .value
    }

    func update(id: UUID, _ input: ClientInput) async throws -> ClientDTO {
        try await client
            .from("clients")
            .update(input, returning: .representation)
            .eq("id", value: id.uuidString)
            .select()
            .single()
            .execute()
            .value
    }

    func delete(id: UUID) async throws {
        try await client
            .from("clients")
            .delete()
            .eq("id", value: id.uuidString)
            .execute()
    }
}
