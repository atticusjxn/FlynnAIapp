import SwiftUI
import Supabase

/// Dashboard card that nudges the user to connect a calendar so confirmed
/// bookings land on their device calendar. Persistent — stays until either
/// a calendar is connected or the user explicitly dismisses ("No thanks").
///
/// Apple Calendar: EventKit local permission, flips `users.apple_calendar_connected`.
/// Google Calendar: OAuth start/callback — wired server-side but the full
///   iOS OAuth initiation handshake is follow-up work. The card surfaces the
///   Google button regardless; it hands off to `Settings → Connected apps`
///   when Google isn't yet one-tap from here.
@MainActor
@Observable
final class CalendarPromptStore {
    enum LoadState: Equatable { case idle, loading, loaded, error(String) }

    private(set) var loadState: LoadState = .idle
    private(set) var appleConnected: Bool = false
    private(set) var googleConnected: Bool = false
    private(set) var promptDismissed: Bool = false

    private let client: SupabaseClient
    private let calendarService: AppleCalendarService

    init(
        client: SupabaseClient = FlynnSupabase.client,
        calendarService: AppleCalendarService = AppleCalendarService()
    ) {
        self.client = client
        self.calendarService = calendarService
    }

    var shouldShowCard: Bool {
        loadState == .loaded && !appleConnected && !googleConnected && !promptDismissed
    }

    func load() async {
        loadState = .loading
        struct Row: Decodable {
            let apple_calendar_connected: Bool
            let google_calendar_connected: Bool
            let calendar_prompt_dismissed_at: Date?
        }
        do {
            let session = try await client.auth.session
            let row: Row = try await client
                .from("users")
                .select("apple_calendar_connected, google_calendar_connected, calendar_prompt_dismissed_at")
                .eq("id", value: session.user.id.uuidString)
                .single()
                .execute()
                .value
            appleConnected = row.apple_calendar_connected
            googleConnected = row.google_calendar_connected
            promptDismissed = row.calendar_prompt_dismissed_at != nil
            loadState = .loaded
        } catch {
            // Fail silently — this card is non-critical for the Dashboard render.
            FlynnLog.network.error("CalendarPrompt load failed: \(error.localizedDescription, privacy: .public)")
            loadState = .error(error.localizedDescription)
        }
    }

    func connectAppleCalendar() async throws {
        let granted = try await calendarService.requestAccess()
        guard granted else { throw AppleCalendarService.CalendarError.accessDenied }

        struct Patch: Encodable {
            let apple_calendar_connected: Bool
            let calendar_prompt_dismissed_at: Date?
        }
        let session = try await client.auth.session
        try await client
            .from("users")
            .update(Patch(apple_calendar_connected: true, calendar_prompt_dismissed_at: Date()))
            .eq("id", value: session.user.id.uuidString)
            .execute()
        appleConnected = true
    }

    func dismiss() async {
        struct Patch: Encodable { let calendar_prompt_dismissed_at: Date }
        do {
            let session = try await client.auth.session
            try await client
                .from("users")
                .update(Patch(calendar_prompt_dismissed_at: Date()))
                .eq("id", value: session.user.id.uuidString)
                .execute()
            promptDismissed = true
        } catch {
            FlynnLog.network.error("CalendarPrompt dismiss failed: \(error.localizedDescription, privacy: .public)")
        }
    }
}

struct CalendarConnectCard: View {
    @Environment(FlashStore.self) private var flash
    @State private var store = CalendarPromptStore()
    @State private var isConnectingApple = false

    var body: some View {
        Group {
            if store.shouldShowCard {
                cardBody
                    .transition(.opacity.combined(with: .scale(scale: 0.98)))
            }
        }
        .task { await store.load() }
        .animation(.spring(response: 0.4, dampingFraction: 0.85), value: store.shouldShowCard)
    }

    private var cardBody: some View {
        VStack(alignment: .leading, spacing: FlynnSpacing.sm) {
            HStack(spacing: FlynnSpacing.xs) {
                Image(systemName: "calendar.badge.plus")
                    .font(.title3)
                    .foregroundColor(FlynnColor.primary)
                Text("Connect your calendar")
                    .flynnType(FlynnTypography.h4)
                    .foregroundColor(FlynnColor.textPrimary)
                Spacer()
            }

            Text("Flynn puts confirmed bookings straight onto your calendar so you never double-book a job.")
                .flynnType(FlynnTypography.bodyMedium)
                .foregroundColor(FlynnColor.textSecondary)
                .fixedSize(horizontal: false, vertical: true)

            HStack(spacing: FlynnSpacing.sm) {
                FlynnButton(
                    title: "Apple Calendar",
                    action: connectApple,
                    fullWidth: true,
                    isLoading: isConnectingApple
                )
                FlynnButton(
                    title: "Google Calendar",
                    action: { flash.info("Open Settings → Connected apps to link Google Calendar") },
                    variant: .secondary,
                    fullWidth: true
                )
            }

            Button("No thanks") { Task { await store.dismiss() } }
                .flynnType(FlynnTypography.caption)
                .foregroundColor(FlynnColor.textTertiary)
                .frame(maxWidth: .infinity, minHeight: 44)
                .contentShape(Rectangle())
        }
        .padding(FlynnSpacing.md)
        .background(
            RoundedRectangle(cornerRadius: FlynnRadii.md, style: .continuous)
                .fill(FlynnColor.backgroundSecondary)
        )
        .brutalistBorder(cornerRadius: FlynnRadii.md)
    }

    private func connectApple() {
        isConnectingApple = true
        Task {
            do {
                try await store.connectAppleCalendar()
                flash.success("Apple Calendar connected")
            } catch {
                flash.error(error.localizedDescription)
            }
            isConnectingApple = false
        }
    }
}
