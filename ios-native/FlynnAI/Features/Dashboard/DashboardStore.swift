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
    /// Money owed, money overdue, money that just landed. Flynn is a payments
    /// product; the home screen used to never mention money at all.
    var money: MoneySnapshot = .empty
    /// Calls the receptionist has taken. The AI receptionist is the wedge, and
    /// the calls table was fully populated but surfaced nowhere in the app.
    var recentCalls: [CallDTO] = []

    struct MoneySnapshot: Equatable {
        var owedTotal: Double = 0
        var owedCount: Int = 0
        var overdueTotal: Double = 0
        var overdueCount: Int = 0
        var paidRecentTotal: Double = 0
        var paidRecentCount: Int = 0

        static let empty = MoneySnapshot()
        var hasAnything: Bool { owedCount > 0 || paidRecentCount > 0 }

        /// Invoices that are out but not settled. `draft` isn't owed yet and
        /// cancelled/refunded never will be.
        private static let openStatuses: Set<String> = ["sent", "viewed", "partial", "overdue"]

        static func from(_ invoices: [InvoiceDTO], now: Date = Date()) -> MoneySnapshot {
            var snap = MoneySnapshot()
            let paidWindow = now.addingTimeInterval(-7 * 24 * 60 * 60)

            for inv in invoices {
                let status = inv.status.lowercased()

                if openStatuses.contains(status), inv.amountDue > 0 {
                    snap.owedTotal += inv.amountDue
                    snap.owedCount += 1
                    // Overdue is a subset of owed, not a separate bucket — the
                    // card reads "$X owed, $Y of it overdue".
                    if let due = inv.dueDate, due < now {
                        snap.overdueTotal += inv.amountDue
                        snap.overdueCount += 1
                    }
                }

                if let paidAt = inv.paidAt, paidAt >= paidWindow, status == "paid" {
                    snap.paidRecentTotal += inv.total
                    snap.paidRecentCount += 1
                }
            }
            return snap
        }
    }

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
    private let invoices: InvoicesRepositoryType
    private let calls: CallsRepositoryType

    init(
        repository: EventsRepositoryType = EventsRepository(),
        invoices: InvoicesRepositoryType = InvoicesRepository(),
        calls: CallsRepositoryType = CallsRepository()
    ) {
        self.repository = repository
        self.invoices = invoices
        self.calls = calls
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
        async let moneyTask = loadMoney()
        async let callsTask = loadCalls()

        do {
            let (list, profile, activity, snapshot) = try await (eventsTask, profileTask, activityTask, moneyTask)
            recentCalls = await callsTask
            events = list
            firstName = profile.0
            calendarConnected = profile.1
            recentActivity = activity.replies
            awaitingConfirmation = activity.pending
            money = snapshot
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

    /// Money never blocks the rest of Home — if the org or the invoice list
    /// fails, the card just doesn't appear.
    private func loadMoney() async -> MoneySnapshot {
        do {
            let orgId = try await OrgResolver.current()
            let list = try await invoices.list(orgId: orgId, limit: 200)
            return MoneySnapshot.from(list)
        } catch {
            FlynnLog.network.error("Dashboard money load failed: \(error.localizedDescription, privacy: .public)")
            return .empty
        }
    }

    /// Like money, calls never block the rest of Home.
    private func loadCalls() async -> [CallDTO] {
        do { return try await calls.list(limit: 8) } catch { return [] }
    }

    private func loadProfile() async throws -> (String?, Bool) {
        #if DEBUG
        if FlynnDemo.isOn { return ("Atticus", true) }
        #endif
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
