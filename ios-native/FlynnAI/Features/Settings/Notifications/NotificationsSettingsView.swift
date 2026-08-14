import SwiftUI
import UIKit
import UserNotifications
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

    /// Whether iOS itself will deliver anything.
    ///
    /// These toggles only ever read `users.notification_prefs`, so someone who
    /// tapped "Don't Allow" saw three switches sitting proudly on while the OS
    /// dropped every push on the floor. The screen has to say that, and it has
    /// to offer the only route that fixes it, because notification permission
    /// can't be asked for twice.
    private(set) var systemAuthorized = true

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

    func refreshSystemAuthorization() async {
        let settings = await UNUserNotificationCenter.current().notificationSettings()
        switch settings.authorizationStatus {
        case .authorized, .provisional, .ephemeral:
            systemAuthorized = true
        case .denied, .notDetermined:
            systemAuthorized = false
        @unknown default:
            systemAuthorized = true
        }
    }

    /// Returns whether the write actually landed. It used to log the failure and
    /// return, leaving the switch flipped over a value that was never saved —
    /// the setting would silently revert the next time the screen loaded.
    @discardableResult
    func save() async -> Bool {
        struct Patch: Encodable { let notification_prefs: NotificationPrefs }
        do {
            let session = try await client.auth.session
            try await client
                .from("users")
                .update(Patch(notification_prefs: prefs))
                .eq("id", value: session.user.id.uuidString)
                .execute()
            return true
        } catch {
            FlynnLog.network.error("saveNotificationPrefs failed: \(error.localizedDescription, privacy: .public)")
            return false
        }
    }
}

struct NotificationsSettingsView: View {
    @Environment(FlashStore.self) private var flash
    @Environment(\.scenePhase) private var scenePhase
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
                    if !store.systemAuthorized { systemDeniedBanner }
                    togglesSection
                        .disabled(!store.systemAuthorized)
                        .opacity(store.systemAuthorized ? 1 : 0.5)
                }
            }
            .padding(FlynnSpacing.lg)
        }
        .background(FlynnColor.background)
        .navigationTitle("Notifications")
        .navigationBarTitleDisplayMode(.large)
        .task {
            await store.load()
            await store.refreshSystemAuthorization()
        }
        // They may have just come back from the Settings app having turned it on.
        .onChange(of: scenePhase) { _, phase in
            guard phase == .active else { return }
            Task { await store.refreshSystemAuthorization() }
        }
    }

    private var systemDeniedBanner: some View {
        VStack(alignment: .leading, spacing: FlynnSpacing.xs) {
            Text("Notifications are off for Flynn")
                .flynnType(FlynnTypography.h4)
                .foregroundColor(FlynnColor.textPrimary)
            Text("iOS is blocking these, so none of them arrive no matter what's switched on here. Turn them back on in Settings.")
                .flynnType(FlynnTypography.bodyMedium)
                .foregroundColor(FlynnColor.textSecondary)
                .fixedSize(horizontal: false, vertical: true)
            FlynnButton(title: "Open Settings", action: openSystemSettings, variant: .secondary)
        }
        .padding(FlynnSpacing.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .flynnCardSurface(.quiet)
    }

    private func openSystemSettings() {
        guard let url = URL(string: UIApplication.openSettingsURLString) else { return }
        UIApplication.shared.open(url)
    }

    /// Flip optimistically, then put it back if the write didn't land.
    private func setPref(_ keyPath: WritableKeyPath<NotificationPrefs, Bool>, _ newValue: Bool) {
        let previous = store.prefs[keyPath: keyPath]
        store.prefs[keyPath: keyPath] = newValue
        Task {
            if await store.save() == false {
                store.prefs[keyPath: keyPath] = previous
                flash.error("Couldn't save that. Check your connection and try again.")
            }
        }
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
                icon: "phone.badge.waveform.fill",
                title: "Calls answered",
                subtitle: "When Flynn answers a call and captures a job for you.",
                isOn: Binding(
                    get: { store.prefs.new_call },
                    set: { v in setPref(\.new_call, v) }
                )
            )
            toggleRow(
                icon: "gauge.with.dots.needle.bottom.50percent",
                title: "Usage warning",
                subtitle: "A heads-up before you reach your plan's limit.",
                isOn: Binding(
                    get: { store.prefs.usage_warning },
                    set: { v in setPref(\.usage_warning, v) }
                )
            )
            toggleRow(
                icon: "clock.badge.exclamationmark",
                title: "Trial ending",
                subtitle: "A reminder before your trial converts to paid.",
                isOn: Binding(
                    get: { store.prefs.trial_ending },
                    set: { v in setPref(\.trial_ending, v) }
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
