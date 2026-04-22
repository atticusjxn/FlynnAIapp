import Foundation
import Supabase

protocol EventsRepositoryType: Sendable {
    func list(limit: Int) async throws -> [EventDTO]
    func fetch(id: UUID) async throws -> EventDTO
    func insert(_ input: EventInput) async throws -> EventDTO
    func update(id: UUID, _ input: EventInput) async throws -> EventDTO
    func setStatus(id: UUID, status: String) async throws -> EventDTO
    func delete(id: UUID) async throws
}

final class EventsRepository: EventsRepositoryType {
    private let client: SupabaseClient

    init(client: SupabaseClient = FlynnSupabase.client) {
        self.client = client
    }

    func list(limit: Int = 50) async throws -> [EventDTO] {
        try await client
            .from("jobs")
            .select()
            .order("scheduled_date", ascending: false)
            .limit(limit)
            .execute()
            .value
    }

    func fetch(id: UUID) async throws -> EventDTO {
        try await client
            .from("jobs")
            .select()
            .eq("id", value: id.uuidString)
            .single()
            .execute()
            .value
    }

    func insert(_ input: EventInput) async throws -> EventDTO {
        try await client
            .from("jobs")
            .insert(input, returning: .representation)
            .select()
            .single()
            .execute()
            .value
    }

    func update(id: UUID, _ input: EventInput) async throws -> EventDTO {
        try await client
            .from("jobs")
            .update(input, returning: .representation)
            .eq("id", value: id.uuidString)
            .select()
            .single()
            .execute()
            .value
    }

    func setStatus(id: UUID, status: String) async throws -> EventDTO {
        struct StatusPatch: Encodable { let status: String }
        return try await client
            .from("jobs")
            .update(StatusPatch(status: status), returning: .representation)
            .eq("id", value: id.uuidString)
            .select()
            .single()
            .execute()
            .value
    }

    func delete(id: UUID) async throws {
        try await client
            .from("jobs")
            .delete()
            .eq("id", value: id.uuidString)
            .execute()
    }
}
