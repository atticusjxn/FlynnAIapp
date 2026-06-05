import Foundation
import Supabase

@MainActor
@Observable
final class DashboardStore {
    enum State: Equatable {
        case idle, loading, loaded, error(String)
    }

    var state: State = .idle
    var events: [EventDTO] = []
    var firstName: String?
    var calendarConnected: Bool = false
    /// True once the Flynn keyboard has been opened at least once (it stamps a
    /// heartbeat into the shared App Group on launch).
    var keyboardAdded: Bool = false
    /// Recent replies the user sent via Flynn (accepted drafts).
    var recentReplies: [String] = []

    private let repository: EventsRepositoryType

    init(repository: EventsRepositoryType = EventsRepository()) {
        self.repository = repository
    }

    func load() async {
        state = .loading
        // The keyboard stamps a heartbeat only once it's actually used; treat the
        // onboarding "I've added it" acknowledgement as added too, so we don't nag
        // users who set it up but haven't opened it in Messages yet.
        keyboardAdded = SharedStore.keyboardHeartbeat != nil
            || UserDefaults.standard.bool(forKey: "flynn.keyboardAcknowledged")
        async let eventsTask = repository.list(limit: 10)
        async let profileTask: (String?, Bool) = loadProfile()
        async let repliesTask = loadRecentReplies()

        do {
            let (list, profile, replies) = try await (eventsTask, profileTask, repliesTask)
            events = list
            firstName = profile.0
            calendarConnected = profile.1
            recentReplies = replies
            state = .loaded
        } catch {
            FlynnLog.network.error("Dashboard load failed: \(error.localizedDescription, privacy: .public)")
            state = .error(error.localizedDescription)
        }
    }

    private func loadRecentReplies() async -> [String] {
        struct Row: Decodable { let sample_text: String }
        do {
            let session = try await FlynnSupabase.client.auth.session
            let rows: [Row] = try await FlynnSupabase.client
                .from("tone_samples")
                .select("sample_text")
                .eq("user_id", value: session.user.id.uuidString)
                .eq("source", value: "accepted")
                .order("created_at", ascending: false)
                .limit(5)
                .execute()
                .value
            return rows.map { $0.sample_text }
        } catch {
            return []
        }
    }

    private func loadProfile() async throws -> (String?, Bool) {
        struct Row: Decodable {
            let full_name: String?
            let calendar_sync_enabled: Bool?
        }
        let session = try await FlynnSupabase.client.auth.session
        let row: Row = try await FlynnSupabase.client
            .from("users")
            .select("full_name, calendar_sync_enabled")
            .eq("id", value: session.user.id.uuidString)
            .single()
            .execute()
            .value
        let first = row.full_name?.components(separatedBy: " ").first
        return (first, row.calendar_sync_enabled ?? false)
    }
}
