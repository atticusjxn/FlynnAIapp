import SwiftUI
import Supabase

@MainActor
@Observable
final class IntegrationsStore {
    enum LoadState: Equatable { case idle, loading, loaded, error(String) }

    private(set) var loadState: LoadState = .idle
    var appleCalendarConnected: Bool = false
    var googleCalendarConnected: Bool = false
    var telnyxPhoneNumber: String?

    private let client: SupabaseClient

    init(client: SupabaseClient = FlynnSupabase.client) {
        self.client = client
    }

    func load() async {
        loadState = .loading
        struct Row: Decodable {
            let apple_calendar_connected: Bool
            let google_calendar_connected: Bool
            let telnyx_phone_number: String?
        }
        do {
            let session = try await client.auth.session
            let row: Row = try await client
                .from("users")
                .select("apple_calendar_connected, google_calendar_connected, telnyx_phone_number")
                .eq("id", value: session.user.id.uuidString)
                .single()
                .execute()
                .value
            appleCalendarConnected = row.apple_calendar_connected
            googleCalendarConnected = row.google_calendar_connected
            telnyxPhoneNumber = row.telnyx_phone_number
            loadState = .loaded
        } catch {
            loadState = .error(error.localizedDescription)
        }
    }

    func setAppleCalendar(_ value: Bool) async {
        struct Patch: Encodable { let apple_calendar_connected: Bool }
        do {
            let session = try await client.auth.session
            try await client
                .from("users")
                .update(Patch(apple_calendar_connected: value))
                .eq("id", value: session.user.id.uuidString)
                .execute()
            appleCalendarConnected = value
        } catch {
            FlynnLog.network.error("setAppleCalendar failed: \(error.localizedDescription, privacy: .public)")
        }
    }
}

struct IntegrationsView: View {
    @Environment(FlashStore.self) private var flash
    @State private var store = IntegrationsStore()

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
                    rows
                }
            }
            .padding(FlynnSpacing.lg)
        }
        .background(FlynnColor.background)
        .navigationTitle("Connected apps")
        .navigationBarTitleDisplayMode(.large)
        .task { await store.load() }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: FlynnSpacing.xs) {
            Text("Integrations")
                .flynnType(FlynnTypography.overline)
                .foregroundColor(FlynnColor.textTertiary)
            Text("Keep Flynn in sync with your calendar and phone")
                .flynnType(FlynnTypography.h3)
                .foregroundColor(FlynnColor.textPrimary)
        }
    }

    @ViewBuilder
    private var rows: some View {
        integrationRow(
            icon: "calendar",
            title: "Apple Calendar",
            subtitle: store.appleCalendarConnected ? "Connected" : "Create events for confirmed bookings",
            toggle: Binding(
                get: { store.appleCalendarConnected },
                set: { newValue in
                    Task { await store.setAppleCalendar(newValue) }
                    flash.success(newValue ? "Apple Calendar connected" : "Apple Calendar disconnected")
                }
            )
        )

        integrationRow(
            icon: "globe",
            title: "Google Calendar",
            subtitle: "Coming soon",
            toggle: .constant(false),
            disabled: true
        )

        telnyxRow
    }

    private func integrationRow(
        icon: String,
        title: String,
        subtitle: String,
        toggle: Binding<Bool>,
        disabled: Bool = false
    ) -> some View {
        HStack(alignment: .top, spacing: FlynnSpacing.sm) {
            Image(systemName: icon)
                .font(.system(size: 22))
                .foregroundColor(disabled ? FlynnColor.textTertiary : FlynnColor.primary)
                .frame(width: 32)
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .flynnType(FlynnTypography.h4)
                    .foregroundColor(FlynnColor.textPrimary)
                Text(subtitle)
                    .flynnType(FlynnTypography.caption)
                    .foregroundColor(FlynnColor.textSecondary)
            }
            Spacer()
            Toggle("", isOn: toggle)
                .labelsHidden()
                .tint(FlynnColor.primary)
                .disabled(disabled)
        }
        .padding(FlynnSpacing.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: FlynnRadii.md, style: .continuous)
                .fill(FlynnColor.backgroundSecondary)
        )
        .brutalistBorder(cornerRadius: FlynnRadii.md)
    }

    private var telnyxRow: some View {
        HStack(alignment: .top, spacing: FlynnSpacing.sm) {
            Image(systemName: "phone.connection")
                .font(.system(size: 22))
                .foregroundColor(FlynnColor.success)
                .frame(width: 32)
            VStack(alignment: .leading, spacing: 2) {
                Text("Flynn phone number")
                    .flynnType(FlynnTypography.h4)
                    .foregroundColor(FlynnColor.textPrimary)
                Text(store.telnyxPhoneNumber ?? "Not provisioned yet")
                    .flynnType(FlynnTypography.caption)
                    .foregroundColor(FlynnColor.textSecondary)
                    .monospaced()
            }
            Spacer()
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
