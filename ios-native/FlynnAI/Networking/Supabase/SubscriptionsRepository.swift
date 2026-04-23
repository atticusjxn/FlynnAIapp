import Foundation
import Supabase

protocol SubscriptionsRepositoryType: Sendable {
    func currentSubscription() async throws -> SubscriptionDTO?
}

final class SubscriptionsRepository: SubscriptionsRepositoryType {
    private let client: SupabaseClient

    init(client: SupabaseClient = FlynnSupabase.client) {
        self.client = client
    }

    func currentSubscription() async throws -> SubscriptionDTO? {
        let session = try await client.auth.session
        // A user should have at most one non-expired row. We pick the most recently
        // updated just in case Apple delivered overlapping renewal notifications.
        let rows: [SubscriptionDTO] = try await client
            .from("subscriptions")
            .select()
            .eq("user_id", value: session.user.id.uuidString)
            .in("status", values: ["trialing", "active", "grace_period"])
            .order("updated_at", ascending: false)
            .limit(1)
            .execute()
            .value
        return rows.first
    }
}
