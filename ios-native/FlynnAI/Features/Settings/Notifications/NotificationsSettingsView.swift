import SwiftUI
import Supabase

/// Mirror of `users.notification_prefs` jsonb column. Keys are stable strings
/// so the backend push-notifier can read the same names without needing a
/// TypeScript enum shared across languages.
struct NotificationPrefs: Codable, Hashable, Sendable {
    var new_call: Bool
    var usage_warning: Bool
    var trial_ending: Bool

    static let `default` = NotificationPrefs(new_call: true, usage_warning: true, trial_ending: true)
}

@MainActor
@Observable
final class NotificationsSettingsStore {
    enum LoadState: Equatable { case idle, loading, loaded, error(String) }

    private(set) var loadState: LoadState = .idle
    var prefs: NotificationPrefs = .default

    private let client: SupabaseClient

    init(client: SupabaseClient = FlynnSupabase.client) {
        self.client = client
    }

    func load() async {
        loadState = .loading
        struct Row: Decodable { let notification_prefs: NotificationPrefs? }
        do {
            let session = try await client.auth.session
            let row: Row = try await client
                .from("users")
                .select("notification_prefs")
                .eq("id", value: session.user.id.uuidString)
                .single()
                .execute()
                .value
            prefs = row.notification_prefs ?? .default
            loadState = .loaded
        } catch {
            loadState = .error(error.localizedDescription)
        }
    }

    func save() async {
        struct Patch: Encodable { let notification_prefs: NotificationPrefs }
        do {
            let session = try await client.auth.session
            try await client
                .from("users")
                .update(Patch(notification_prefs: prefs))
                .eq("id", value: session.user.id.uuidString)
                .execute()
        } catch {
            FlynnLog.network.error("saveNotificationPrefs failed: \(error.localizedDescription, privacy: .public)")
        }
    }
}

struct NotificationsSettingsView: View {
    @Environment(FlashStore.self) private var flash
    @State private var store = NotificationsSettingsStore()

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: FlynnSpacing.md) {
                header

                switch store.loadState {
                case .idle, .loading:
                    ProgressView()
                        .frame(maxWidth: .infinity, minHeight: 160)
                case .error(let msg):
                    Text(msg)
                        .flynnType(FlynnTypography.bodyMedium)
                        .foregroundColor(FlynnColor.error)
                case .loaded:
                    togglesSection
                }
            }
            .padding(FlynnSpacing.lg)
        }
        .background(FlynnColor.background)
        .navigationTitle("Notifications")
        .navigationBarTitleDisplayMode(.large)
        .task { await store.load() }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: FlynnSpacing.xs) {
            Text("Push notifications")
                .flynnType(FlynnTypography.overline)
                .foregroundColor(FlynnColor.textTertiary)
            Text("Decide when Flynn should ping your phone")
                .flynnType(FlynnTypography.h3)
                .foregroundColor(FlynnColor.textPrimary)
        }
    }

    private var togglesSection: some View {
        VStack(spacing: FlynnSpacing.sm) {
            toggleRow(
                icon: "phone.arrow.down.left.fill",
                title: "New inbound call",
                subtitle: "Tradies usually want this on.",
                isOn: Binding(
                    get: { store.prefs.new_call },
                    set: { v in store.prefs.new_call = v; Task { await store.save() } }
                )
            )
            toggleRow(
                icon: "gauge.with.dots.needle.bottom.50percent",
                title: "Usage warning (80%)",
                subtitle: "Heads-up before your AI minutes run out.",
                isOn: Binding(
                    get: { store.prefs.usage_warning },
                    set: { v in store.prefs.usage_warning = v; Task { await store.save() } }
                )
            )
            toggleRow(
                icon: "clock.badge.exclamationmark",
                title: "Trial ending",
                subtitle: "Reminder 3 days before trial auto-renews.",
                isOn: Binding(
                    get: { store.prefs.trial_ending },
                    set: { v in store.prefs.trial_ending = v; Task { await store.save() } }
                )
            )
        }
    }

    private func toggleRow(icon: String, title: String, subtitle: String, isOn: Binding<Bool>) -> some View {
        HStack(alignment: .top, spacing: FlynnSpacing.sm) {
            Image(systemName: icon)
                .font(.system(size: 20))
                .foregroundColor(FlynnColor.primary)
                .frame(width: 28)
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .flynnType(FlynnTypography.h4)
                    .foregroundColor(FlynnColor.textPrimary)
                Text(subtitle)
                    .flynnType(FlynnTypography.caption)
                    .foregroundColor(FlynnColor.textSecondary)
            }
            Spacer()
            Toggle("", isOn: isOn).labelsHidden().tint(FlynnColor.primary)
        }
        .padding(FlynnSpacing.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: FlynnRadii.md, style: .continuous)
                .fill(FlynnColor.backgroundSecondary)
        )
        .brutalistBorder(cornerRadius: FlynnRadii.md)
    }
}
