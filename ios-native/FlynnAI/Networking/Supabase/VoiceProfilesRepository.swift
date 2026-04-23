import Foundation
import Supabase

/// Read-only catalog of Cartesia voice presets available to all users.
protocol VoiceProfilesRepositoryType: Sendable {
    func list(locale: String?) async throws -> [VoiceProfileDTO]
    func fetch(slug: String) async throws -> VoiceProfileDTO
    func fetch(id: UUID) async throws -> VoiceProfileDTO
}

final class VoiceProfilesRepository: VoiceProfilesRepositoryType {
    private let client: SupabaseClient

    init(client: SupabaseClient = FlynnSupabase.client) {
        self.client = client
    }

    func list(locale: String? = "en-AU") async throws -> [VoiceProfileDTO] {
        var query = client.from("voice_profiles").select()
        if let locale {
            query = query.eq("locale", value: locale)
        }
        return try await query
            .order("gender", ascending: true)
            .order("display_name", ascending: true)
            .execute()
            .value
    }

    func fetch(slug: String) async throws -> VoiceProfileDTO {
        try await client
            .from("voice_profiles")
            .select()
            .eq("slug", value: slug)
            .single()
            .execute()
            .value
    }

    func fetch(id: UUID) async throws -> VoiceProfileDTO {
        try await client
            .from("voice_profiles")
            .select()
            .eq("id", value: id.uuidString)
            .single()
            .execute()
            .value
    }
}
