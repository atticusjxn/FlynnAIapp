import Foundation
import Supabase

/// Read-only access to the per-call event log. Writes happen server-side using the
/// service role.
protocol CallEventsRepositoryType: Sendable {
    func listForCall(_ callId: UUID) async throws -> [CallEventDTO]
    func latestForUser(limit: Int) async throws -> [CallEventDTO]
    /// Summed cost_cents across all call_events rows in the given date range.
    /// Useful for the Dashboard cost widget ("today's spend", "this week").
    func totalCostCents(since: Date) async throws -> Int
}

final class CallEventsRepository: CallEventsRepositoryType {
    private let client: SupabaseClient

    init(client: SupabaseClient = FlynnSupabase.client) {
        self.client = client
    }

    func listForCall(_ callId: UUID) async throws -> [CallEventDTO] {
        try await client
            .from("call_events")
            .select()
            .eq("call_id", value: callId.uuidString)
            .order("created_at", ascending: true)
            .execute()
            .value
    }

    func latestForUser(limit: Int = 100) async throws -> [CallEventDTO] {
        try await client
            .from("call_events")
            .select()
            .order("created_at", ascending: false)
            .limit(limit)
            .execute()
            .value
    }

    func totalCostCents(since: Date) async throws -> Int {
        // Sum client-side from the event rows in range. Good enough for the
        // dashboards we need today; move to a SQL aggregate (or a materialised
        // view) when event volume warrants it.
        struct Row: Decodable { let cost_cents: Int? }
        let iso = ISO8601DateFormatter().string(from: since)
        let rows: [Row] = try await client
            .from("call_events")
            .select("cost_cents")
            .gte("created_at", value: iso)
            .execute()
            .value
        return rows.reduce(0) { $0 + ($1.cost_cents ?? 0) }
    }
}
