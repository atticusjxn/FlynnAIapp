import Foundation
import Supabase

protocol UsageRepositoryType: Sendable {
    func current() async throws -> UsageDTO?
}

final class UsageRepository: UsageRepositoryType {
    private let client: SupabaseClient

    init(client: SupabaseClient = FlynnSupabase.client) {
        self.client = client
    }

    func current() async throws -> UsageDTO? {
        let session = try await client.auth.session
        let rows: [UsageDTO] = try await client
            .from("v_current_usage")
            .select()
            .eq("user_id", value: session.user.id.uuidString)
            .limit(1)
            .execute()
            .value
        return rows.first
    }
}
