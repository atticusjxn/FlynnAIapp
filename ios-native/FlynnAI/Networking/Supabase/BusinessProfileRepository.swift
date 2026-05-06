import Foundation
import Supabase

protocol BusinessProfileRepositoryType: Sendable {
    func fetch() async throws -> BusinessProfileDTO?
    func upsert(_ input: BusinessProfileInput) async throws -> BusinessProfileDTO
}

final class BusinessProfileRepository: BusinessProfileRepositoryType {
    private let client: SupabaseClient

    init(client: SupabaseClient = FlynnSupabase.client) {
        self.client = client
    }

    func fetch() async throws -> BusinessProfileDTO? {
        let rows: [BusinessProfileDTO] = try await client
            .from("business_profiles")
            .select()
            .limit(1)
            .execute()
            .value
        return rows.first
    }

    func upsert(_ input: BusinessProfileInput) async throws -> BusinessProfileDTO {
        let userId = try await client.auth.session.user.id.uuidString
        var payload = input
        payload.userId = userId
        return try await client
            .from("business_profiles")
            .upsert(payload, onConflict: "user_id", returning: .representation)
            .select()
            .single()
            .execute()
            .value
    }
}
