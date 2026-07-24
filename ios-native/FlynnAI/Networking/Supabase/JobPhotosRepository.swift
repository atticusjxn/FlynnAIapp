import Foundation
import Supabase

protocol JobPhotosRepositoryType: Sendable {
    func list(jobId: UUID) async throws -> [JobPhotoDTO]
}

final class JobPhotosRepository: JobPhotosRepositoryType {
    private let client: SupabaseClient

    init(client: SupabaseClient = FlynnSupabase.client) {
        self.client = client
    }

    func list(jobId: UUID) async throws -> [JobPhotoDTO] {
        try await client
            .from("job_photos")
            .select()
            .eq("job_id", value: jobId.uuidString)
            .order("created_at", ascending: false)
            .execute()
            .value
    }
}
