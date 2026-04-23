import Foundation
import Supabase

/// Read-only catalog of IVR scripts. Users can fork a template into
/// `business_profiles.ivr_custom_script` to customise.
protocol IvrTemplatesRepositoryType: Sendable {
    func list(locale: String?, industry: String?) async throws -> [IvrTemplateDTO]
    func fetch(id: UUID) async throws -> IvrTemplateDTO
    func fetch(slug: String) async throws -> IvrTemplateDTO
}

final class IvrTemplatesRepository: IvrTemplatesRepositoryType {
    private let client: SupabaseClient

    init(client: SupabaseClient = FlynnSupabase.client) {
        self.client = client
    }

    func list(locale: String? = "en-AU", industry: String? = nil) async throws -> [IvrTemplateDTO] {
        var query = client.from("ivr_templates").select()
        if let locale {
            query = query.eq("locale", value: locale)
        }
        if let industry {
            query = query.eq("industry", value: industry)
        }
        return try await query
            .order("industry", ascending: true)
            .order("name", ascending: true)
            .execute()
            .value
    }

    func fetch(id: UUID) async throws -> IvrTemplateDTO {
        try await client
            .from("ivr_templates")
            .select()
            .eq("id", value: id.uuidString)
            .single()
            .execute()
            .value
    }

    func fetch(slug: String) async throws -> IvrTemplateDTO {
        try await client
            .from("ivr_templates")
            .select()
            .eq("slug", value: slug)
            .single()
            .execute()
            .value
    }
}
