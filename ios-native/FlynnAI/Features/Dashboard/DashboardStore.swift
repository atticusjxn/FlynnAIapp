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
    /// Recent things Flynn did over text (latest outbound replies), and actions it
    /// has staged that are waiting on the user's OK. Both are vertical-agnostic —
    /// whatever the user actually uses Flynn for shows up here.
    var recentActivity: [ActivityReply] = []
    var awaitingConfirmation: [PendingActionItem] = []

    struct ActivityReply: Decodable, Identifiable {
        let body: String
        let channel: String?
        let createdAt: String?
        var id: String { (createdAt ?? "") + body }
    }

    struct PendingActionItem: Decodable, Identifiable {
        let actionType: String?
        let message: String?
        let createdAt: String?
        var id: String { (createdAt ?? "") + (message ?? actionType ?? "") }
    }

    private let repository: EventsRepositoryType

    init(repository: EventsRepositoryType = EventsRepository()) {
        self.repository = repository
    }

    func load() async {
        state = .loading
        // The keyboard stamps a heartbeat only once it's actually used; treat the
        // "I've added it" acknowledgement as added too, so we don't nag users who set
        // it up but haven't opened it in Messages yet.
        keyboardAdded = SharedStore.keyboardHeartbeat != nil
            || UserDefaults.standard.bool(forKey: "flynn.keyboardAcknowledged")
        async let eventsTask = repository.list(limit: 10)
        async let profileTask: (String?, Bool) = loadProfile()
        async let activityTask = loadActivity()

        do {
            let (list, profile, activity) = try await (eventsTask, profileTask, activityTask)
            events = list
            firstName = profile.0
            calendarConnected = profile.1
            recentActivity = activity.replies
            awaitingConfirmation = activity.pending
            state = .loaded
        } catch {
            FlynnLog.network.error("Dashboard load failed: \(error.localizedDescription, privacy: .public)")
            state = .error(error.localizedDescription)
        }
    }

    /// Pulls the activity feed from the backend, which resolves the user's phone and
    /// joins the iMessage-side tables (sms_messages, pending_actions) server-side — so
    /// the app never has to reconcile the phone-vs-uid keying itself.
    private func loadActivity() async -> (replies: [ActivityReply], pending: [PendingActionItem]) {
        struct Resp: Decodable {
            let recentReplies: [ActivityReply]
            let awaitingConfirmation: [PendingActionItem]
        }
        do {
            let session = try await FlynnSupabase.client.auth.session
            var req = URLRequest(url: FlynnEnv.flynnAPIBaseURL.appendingPathComponent("api/dashboard/activity"))
            req.setValue("Bearer \(session.accessToken)", forHTTPHeaderField: "Authorization")
            let (data, response) = try await URLSession.shared.data(for: req)
            guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
                return ([], [])
            }
            let decoded = try JSONDecoder().decode(Resp.self, from: data)
            return (decoded.recentReplies, decoded.awaitingConfirmation)
        } catch {
            return ([], [])
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
