import Foundation
import Supabase

/// Reads and writes the caller's single `business_profiles` row (PK = `user_id`,
/// RLS scopes by `auth.uid()`).
protocol BusinessProfileRepositoryType: Sendable {
    func fetch() async throws -> BusinessProfileDTO?
    func upsert(_ input: BusinessProfileInput) async throws -> BusinessProfileDTO
}

final class BusinessProfileRepository: BusinessProfileRepositoryType {
    private let client: SupabaseClient

    init(client: SupabaseClient = FlynnSupabase.client) {
        self.client = client
    }

    /// Returns the profile if one exists, else nil. We use `.single()`'s error-tolerant
    /// cousin (`limit(1)` + first) because a brand-new user may have no row yet.
    func fetch() async throws -> BusinessProfileDTO? {
        let rows: [BusinessProfileDTO] = try await client
            .from("business_profiles")
            .select()
            .limit(1)
            .execute()
            .value
        return rows.first
    }

    /// Upsert keyed on `user_id`. Server fills in `user_id` from `auth.uid()` via RLS
    /// when missing, and returns the full row post-write.
    func upsert(_ input: BusinessProfileInput) async throws -> BusinessProfileDTO {
        try await client
            .from("business_profiles")
            .upsert(input, onConflict: "user_id", returning: .representation)
            .select()
            .single()
            .execute()
            .value
    }
}
