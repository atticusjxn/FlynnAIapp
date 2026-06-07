import SwiftUI

/// Root tab shell. Each tab owns its own `NavigationPath` so deep links can
/// push onto the correct stack without clobbering the others.
struct MainTabView: View {
    @Environment(DeepLinkRouter.self) private var deepLink
    @Environment(FlashStore.self) private var flash
    @Environment(\.scenePhase) private var scenePhase
    @State private var selection: FlynnTab = .dashboard
    @State private var drawer = DrawerController()
    @State private var calendarStore = PendingCalendarStore()
    @State private var voiceStore = VoiceCommandStore()
    @State private var voiceQuote: IdentifiedQuote?

    /// Identifiable wrapper so a created quote can drive a `.sheet(item:)`.
    private struct IdentifiedQuote: Identifiable { let id: UUID }

    @State private var dashboardPath = NavigationPath()
    @State private var voicePath = NavigationPath()
    @State private var brainPath = NavigationPath()
    @State private var eventsPath = NavigationPath()
    // Parked tabs — paths retained so deep links to their detail routes still work.
    @State private var callsPath = NavigationPath()
    @State private var clientsPath = NavigationPath()
    @State private var moneyPath = NavigationPath()

    var body: some View {
        @Bindable var calendarStore = calendarStore
        @Bindable var voiceStore = voiceStore
        ZStack(alignment: .leading) {
            TabView(selection: $selection) {
                tab(.dashboard, path: $dashboardPath) { DashboardView() }
                tab(.voice, path: $voicePath) { VoiceView() }
                tab(.brain, path: $brainPath) { BrainView() }
                tab(.events, path: $eventsPath) { EventsListView() }
            }

            if drawer.isOpen {
                Color.black.opacity(0.35)
                    .ignoresSafeArea()
                    .onTapGesture { drawer.isOpen = false }
                    .transition(.opacity)
                DrawerView()
                    .frame(maxWidth: 320, maxHeight: .infinity)
                    .transition(.move(edge: .leading))
                    .ignoresSafeArea(edges: .bottom)
            }
        }
        // App-wide hold-to-talk mic, floating above the tab bar (hidden behind the drawer).
        .overlay(alignment: .bottomTrailing) {
            if !drawer.isOpen {
                FloatingMicButton(store: voiceStore)
                    .padding(.trailing, FlynnSpacing.lg)
                    .padding(.bottom, 92)
            }
        }
        .environment(drawer)
        .animation(.easeOut(duration: 0.25), value: drawer.isOpen)
        .onChange(of: deepLink.pending) { _, link in
            guard let link else { return }
            applyDeepLink(link)
            deepLink.pending = nil
        }
        // A booking the keyboard staged becomes a confirm card here — the foreground
        // app is the only place that can write to the calendar. Picked up on launch,
        // on every foreground, and when the calendar deep link pings.
        .task { calendarStore.checkForPending() }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active { calendarStore.checkForPending() }
        }
        .onChange(of: deepLink.calendarPickupPing) { _, _ in
            calendarStore.checkForPending()
        }
        .sheet(item: $calendarStore.pending, onDismiss: { calendarStore.handleSheetDismissed() }) { event in
            PendingEventConfirmView(
                event: event,
                writeState: calendarStore.writeState,
                onConfirm: { Task { await calendarStore.confirm() } },
                onDismiss: { calendarStore.dismiss() }
            )
            .presentationDetents([.medium])
            .interactiveDismissDisabled(calendarStore.writeState == .writing)
        }
        // Voice command results → the right surface for each intent.
        .onChange(of: voiceStore.lastResult) { _, result in
            guard let result else { return }
            voiceStore.clearResult()
            routeVoiceResult(result)
        }
        .onChange(of: voiceStore.errorMessage) { _, message in
            guard let message else { return }
            flash.show(message, kind: .error)
            voiceStore.clearError()
        }
        .sheet(item: $voiceStore.replyDrafts) { item in
            VoiceReplyDraftsView(
                recipient: item.recipient,
                drafts: item.drafts,
                onClose: { voiceStore.replyDrafts = nil },
                onCopied: { flash.show("Copied — paste it where you're messaging.", kind: .success) }
            )
        }
        .sheet(item: $voiceQuote) { item in
            NavigationStack { QuoteDetailView(quoteId: item.id) }
        }
    }

    /// Dispatch a voice command result to the matching surface.
    private func routeVoiceResult(_ result: VoiceCommandResult) {
        switch result.intent {
        case "calendar":
            if let event = result.event {
                calendarStore.present(event: PendingCalendarEvent(
                    title: event.title,
                    startISO: event.startISO,
                    durationMin: event.durationMin,
                    location: event.location,
                    customer: event.customer
                ))
            } else {
                flash.show("Got it — but I need a clear day and time. Try again.", kind: .info)
            }
        case "quote":
            if let idString = result.quoteId, let id = UUID(uuidString: idString) {
                voiceQuote = IdentifiedQuote(id: id)
            } else {
                flash.show("Drafted a quote but couldn't open it — check the Money area.", kind: .info)
            }
        case "reply":
            voiceStore.replyDrafts = VoiceCommandStore.ReplyDrafts(
                recipient: result.recipient,
                drafts: result.drafts ?? []
            )
        case "note":
            let about = result.subject.map { " about \($0)" } ?? ""
            flash.show("Saved ✓ Flynn will remember that\(about).", kind: .success)
        default:
            flash.show(result.message ?? result.summary ?? "Didn't catch that — try again.", kind: .info)
        }
    }

    @ViewBuilder
    private func tab<Root: View>(
        _ t: FlynnTab,
        path: Binding<NavigationPath>,
        @ViewBuilder root: () -> Root
    ) -> some View {
        NavigationStack(path: path) {
            root()
                .navigationDestination(for: Route.self) { route in destination(for: route) }
                .toolbar { ToolbarItem(placement: .topBarLeading) { DrawerButton() } }
        }
        .tabItem { Label(t.title, systemImage: t.systemImage) }
        .tag(t)
    }

    @ViewBuilder
    private func destination(for route: Route) -> some View {
        switch route {
        case .eventDetail(let id):
            EventDetailView(eventId: id)
        case .clientDetail(let id):
            ClientDetailView(clientId: id)
        case .callDetail(let id):
            CallDetailView(callId: id)
        case .quoteDetail(let id):
            QuoteDetailView(quoteId: id)
        case .invoiceDetail(let id):
            InvoiceDetailView(invoiceId: id)
        case .settingsRoot:
            SettingsView()
        case .settingsSection(let section):
            settingsDestination(for: section)
        }
    }

    @ViewBuilder
    private func settingsDestination(for section: SettingsSection) -> some View {
        switch section {
        case .businessProfile:
            BusinessProfileEditorView()
        case .callForwarding:
            ForwardingSetupView()
        case .billing:
            SubscriptionDetailView()
        case .integrations:
            IntegrationsView()
        case .notifications:
            NotificationsSettingsView()
        case .appearance:
            AppearanceView()
        case .bookingPage, .businessType, .support, .terms, .account:
            PlaceholderDetailView(title: section.title, id: nil)
        }
    }

    private func applyDeepLink(_ link: DeepLinkRouter.PendingLink) {
        selection = link.tab
        guard let route = link.route else { return }
        switch link.tab {
        case .dashboard: dashboardPath.append(route)
        case .events: eventsPath.append(route)
        case .calls: callsPath.append(route)
        case .clients: clientsPath.append(route)
        case .money: moneyPath.append(route)
        case .voice: voicePath.append(route)
        case .brain: brainPath.append(route)
        }
    }
}

/// Lightweight placeholder used for tabs/screens not yet ported in Phase 1.
struct PlaceholderTabView: View {
    let title: String

    var body: some View {
        VStack(spacing: FlynnSpacing.md) {
            Text(title)
                .flynnType(FlynnTypography.displayMedium)
            Text("Coming in a later phase.")
                .flynnType(FlynnTypography.bodyLarge)
                .foregroundColor(FlynnColor.textSecondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(FlynnColor.background)
        .navigationTitle(title)
    }
}

struct PlaceholderDetailView: View {
    let title: String
    let id: UUID?

    var body: some View {
        VStack(spacing: FlynnSpacing.sm) {
            Text(title).flynnType(FlynnTypography.h2)
            if let id {
                Text(id.uuidString)
                    .flynnType(FlynnTypography.bodySmall)
                    .foregroundColor(FlynnColor.textSecondary)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(FlynnColor.background)
        .navigationTitle(title)
    }
}
