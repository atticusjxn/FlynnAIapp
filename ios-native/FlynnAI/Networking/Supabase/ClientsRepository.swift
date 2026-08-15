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
        #if DEBUG
        if FlynnDemo.isOn { return FlynnDemo.clients }
        #endif
        // No explicit org filter needed — RLS (`is_org_member(org_id)`) already
        // scopes every row to orgs the caller belongs to.
        return try await client
            .from("clients")
            .select()
            .order("last_job_date", ascending: false, nullsFirst: false)
            .limit(limit)
            .execute()
            .value
    }

    func fetch(id: UUID) async throws -> ClientDTO {
        #if DEBUG
        if FlynnDemo.isOn {
            guard let match = FlynnDemo.clients.first(where: { $0.id == id }) else {
                throw FlynnDemoError.notFound
            }
            return match
        }
        #endif
        return try await client
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
        #if DEBUG
        // Demo fixtures have no row behind them, so this update matched nothing
        // and PostgREST answered "Cannot coerce the result to a single JSON
        // object" — a real-looking database error from a screen showing fake
        // data. Reads were guarded and writes weren't. Echo the edit back so
        // the demo behaves like the app it's standing in for.
        if FlynnDemo.isOn {
            guard let seed = FlynnDemo.clients.first(where: { $0.id == id }) else {
                throw FlynnDemoError.notFound
            }
            return ClientDTO(
                id: seed.id, userId: seed.userId, orgId: seed.orgId,
                name: input.name, phone: input.phone, email: input.email,
                address: input.address, notes: input.notes,
                businessType: input.businessType,
                preferredContactMethod: input.preferredContactMethod,
                totalJobs: seed.totalJobs, lastJobDate: seed.lastJobDate,
                lastJobType: seed.lastJobType, createdAt: seed.createdAt,
                updatedAt: seed.updatedAt
            )
        }
        #endif
        return try await client
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
