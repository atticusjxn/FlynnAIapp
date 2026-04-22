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
        try await client
            .from("clients")
            .insert(input, returning: .representation)
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
