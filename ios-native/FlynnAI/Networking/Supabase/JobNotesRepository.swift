import Foundation
import Supabase

protocol JobNotesRepositoryType: Sendable {
    func list(jobId: UUID) async throws -> [JobNoteDTO]
    func add(jobId: UUID, body: String) async throws -> JobNoteDTO
}

final class JobNotesRepository: JobNotesRepositoryType {
    private let client: SupabaseClient

    init(client: SupabaseClient = FlynnSupabase.client) {
        self.client = client
    }

    func list(jobId: UUID) async throws -> [JobNoteDTO] {
        try await client
            .from("job_notes")
            .select()
            .eq("job_id", value: jobId.uuidString)
            .order("created_at", ascending: true)
            .execute()
            .value
    }

    func add(jobId: UUID, body: String) async throws -> JobNoteDTO {
        let orgId = try await OrgResolver.current(client: client)
        let input = JobNoteInput(jobId: jobId, orgId: orgId, body: body)
        return try await client
            .from("job_notes")
            .insert(input, returning: .representation)
            .select()
            .single()
            .execute()
            .value
    }
}
