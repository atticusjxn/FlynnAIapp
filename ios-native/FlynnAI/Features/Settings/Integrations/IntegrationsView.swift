import SwiftUI
import UIKit
import Supabase

@MainActor
@Observable
final class IntegrationsStore {
    enum LoadState: Equatable { case idle, loading, loaded, error(String) }

    private(set) var loadState: LoadState = .idle
    var appleCalendarConnected: Bool = false
    var googleCalendarConnected: Bool = false
    var xeroConnected: Bool = false
    var telnyxPhoneNumber: String?

    private let client: SupabaseClient

    init(client: SupabaseClient = FlynnSupabase.client) {
        self.client = client
    }

    func load() async {
        loadState = .loading
        struct Row: Decodable {
            let apple_calendar_connected: Bool?
            let google_calendar_connected: Bool?
            let twilio_phone_number: String?
        }
        do {
            let session = try await client.auth.session
            let row: Row = try await client
                .from("users")
                .select("apple_calendar_connected, google_calendar_connected, twilio_phone_number")
                .eq("id", value: session.user.id.uuidString)
                .single()
                .execute()
                .value
            appleCalendarConnected = row.apple_calendar_connected ?? false
            googleCalendarConnected = row.google_calendar_connected ?? false
            telnyxPhoneNumber = row.twilio_phone_number
            loadState = .loaded

            // Xero lives in user_connections (Nango), not a column on users —
            // fetch it separately so a slow status check can't hold up the rest
            // of the screen from showing.
            xeroConnected = await NangoProviderConnect.status(provider: "xero", client: client)
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

    /// Launch the Google OAuth flow. The backend persists the connection and
    /// flips `google_calendar_connected`; reflect it locally on success.
    func connectGoogleCalendar() async throws {
        try await GoogleCalendarConnect.connect(client: client)
        googleCalendarConnected = true
    }

    /// Launch the Xero OAuth flow via Nango. Returns whether it ended up
    /// connected — see NangoProviderConnect for why this can't throw on a
    /// bare "user dismissed the sheet" the way Google's flow does.
    @discardableResult
    func connectXero() async -> Bool {
        let connected = (try? await NangoProviderConnect.connect(provider: "xero", client: client)) ?? false
        xeroConnected = connected
        return connected
    }
}

struct IntegrationsView: View {
    @Environment(FlashStore.self) private var flash
    @State private var store = IntegrationsStore()
    @State private var isConnectingGoogle = false
    @State private var isConnectingXero = false

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
        .navigationTitle("Connected")
        .navigationBarTitleDisplayMode(.large)
        .task { await store.load() }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: FlynnSpacing.xs) {
            Text("Your apps")
                .flynnType(FlynnTypography.overline)
                .foregroundColor(FlynnColor.textTertiary)
            Text("Connect the apps Flynn works with. Add more as you need them.")
                .flynnType(FlynnTypography.h3)
                .foregroundColor(FlynnColor.textPrimary)
        }
    }

    @ViewBuilder
    private var rows: some View {
        integrationRow(
            brand: .appleCalendar,
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

        googleRow
        xeroRow
    }

    private var googleRow: some View {
        Button {
            guard !store.googleCalendarConnected, !isConnectingGoogle else { return }
            isConnectingGoogle = true
            Task {
                do {
                    try await store.connectGoogleCalendar()
                    flash.success("Google Calendar connected")
                } catch GoogleCalendarConnect.ConnectError.cancelled {
                    // User backed out of the sheet — stay quiet.
                } catch {
                    flash.error(error.localizedDescription)
                }
                isConnectingGoogle = false
            }
        } label: {
            HStack(alignment: .top, spacing: FlynnSpacing.sm) {
                IntegrationLogoView(brand: .googleCalendar)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Google Calendar")
                        .flynnType(FlynnTypography.h4)
                        .foregroundColor(FlynnColor.textPrimary)
                    Text(store.googleCalendarConnected
                         ? "Connected"
                         : "Offer real open slots and drop confirmed bookings onto your calendar")
                        .flynnType(FlynnTypography.caption)
                        .foregroundColor(FlynnColor.textSecondary)
                }
                Spacer()
                if isConnectingGoogle {
                    ProgressView()
                } else {
                    Image(systemName: store.googleCalendarConnected ? "checkmark.circle.fill" : "chevron.right")
                        .foregroundColor(store.googleCalendarConnected ? FlynnColor.success : FlynnColor.textTertiary)
                }
            }
            .padding(FlynnSpacing.md)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: FlynnRadii.md, style: .continuous)
                    .fill(FlynnColor.backgroundSecondary)
            )
            .brutalistBorder(cornerRadius: FlynnRadii.md)
        }
        .buttonStyle(.plain)
        .disabled(store.googleCalendarConnected)
    }

    private var xeroRow: some View {
        Button {
            guard !store.xeroConnected, !isConnectingXero else { return }
            isConnectingXero = true
            Task {
                let connected = await store.connectXero()
                if connected {
                    flash.success("Xero connected")
                }
                // A sheet that closes without connecting (user backed out, or
                // just tapped Done on Nango's own page without finishing) is
                // silent here rather than an error — see NangoProviderConnect,
                // there is no reliable way to tell "cancelled" from "closed the
                // success page" at this layer.
                isConnectingXero = false
            }
        } label: {
            HStack(alignment: .top, spacing: FlynnSpacing.sm) {
                IntegrationLogoView(brand: .xero)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Xero")
                        .flynnType(FlynnTypography.h4)
                        .foregroundColor(FlynnColor.textPrimary)
                    Text(store.xeroConnected
                         ? "Connected"
                         : "Send invoices and file expenses straight to your books")
                        .flynnType(FlynnTypography.caption)
                        .foregroundColor(FlynnColor.textSecondary)
                }
                Spacer()
                if isConnectingXero {
                    ProgressView()
                } else {
                    Image(systemName: store.xeroConnected ? "checkmark.circle.fill" : "chevron.right")
                        .foregroundColor(store.xeroConnected ? FlynnColor.success : FlynnColor.textTertiary)
                }
            }
            .padding(FlynnSpacing.md)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: FlynnRadii.md, style: .continuous)
                    .fill(FlynnColor.backgroundSecondary)
            )
            .brutalistBorder(cornerRadius: FlynnRadii.md)
        }
        .buttonStyle(.plain)
        .disabled(store.xeroConnected)
    }

    private func integrationRow(
        brand: IntegrationBrand,
        title: String,
        subtitle: String,
        toggle: Binding<Bool>,
        disabled: Bool = false
    ) -> some View {
        HStack(alignment: .top, spacing: FlynnSpacing.sm) {
            IntegrationLogoView(brand: brand)
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

}
