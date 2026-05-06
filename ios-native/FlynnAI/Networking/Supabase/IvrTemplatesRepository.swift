import Foundation
import Supabase

/// Read-only catalog of call greeting scripts. Users can fork a template into
/// `business_profiles.ivr_custom_script` to customise.
protocol IvrTemplatesRepositoryType: Sendable {
    func list(industry: String?) async throws -> [IvrTemplateDTO]
    func fetch(id: UUID) async throws -> IvrTemplateDTO
}

final class IvrTemplatesRepository: IvrTemplatesRepositoryType {
    private let client: SupabaseClient

    init(client: SupabaseClient = FlynnSupabase.client) {
        self.client = client
    }

    func list(industry: String? = nil) async throws -> [IvrTemplateDTO] {
        var query = client
            .from("ivr_templates")
            .select()
            .eq("is_active", value: true)
        if let industry {
            query = query.eq("industry_type", value: industry)
        }
        return try await query
            .order("industry_type", ascending: true)
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
}
