import Foundation
import Supabase

protocol PlansRepositoryType: Sendable {
    func list() async throws -> [PlanDTO]
    func fetch(slug: String) async throws -> PlanDTO?
}

final class PlansRepository: PlansRepositoryType {
    private let client: SupabaseClient

    init(client: SupabaseClient = FlynnSupabase.client) {
        self.client = client
    }

    func list() async throws -> [PlanDTO] {
        try await client
            .from("plans")
            .select()
            .eq("is_active", value: true)
            .order("sort_order", ascending: true)
            .execute()
            .value
    }

    func fetch(slug: String) async throws -> PlanDTO? {
        let rows: [PlanDTO] = try await client
            .from("plans")
            .select()
            .eq("slug", value: slug)
            .limit(1)
            .execute()
            .value
        return rows.first
    }
}
