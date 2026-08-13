import SwiftUI

/// Root tab shell. Each tab owns its own `NavigationPath` so deep links can
/// push onto the correct stack without clobbering the others.
struct MainTabView: View {
    @Environment(DeepLinkRouter.self) private var deepLink
    @Environment(FlashStore.self) private var flash
    @State private var selection: FlynnTab = FlynnDemo.initialTab ?? .dashboard
    @State private var drawer = DrawerController()

    @State private var dashboardPath = NavigationPath()
    @State private var brainPath = NavigationPath()
    @State private var eventsPath = NavigationPath()
    @State private var connectedPath = NavigationPath()
    // Parked tabs — paths retained so deep links to their detail routes still work.
    @State private var callsPath = NavigationPath()
    @State private var clientsPath = NavigationPath()
    @State private var moneyPath = NavigationPath()

    var body: some View {
        ZStack(alignment: .leading) {
            TabView(selection: $selection) {
                tab(.dashboard, path: $dashboardPath) { DashboardView() }
                tab(.brain, path: $brainPath) { BrainView() }
                tab(.events, path: $eventsPath) { EventsListView() }
                tab(.money, path: $moneyPath) { MoneyView() }
                tab(.clients, path: $clientsPath) { ClientsListView() }
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
        .task {
            // Demo-mode launch route, pushed once the stacks exist.
            if let route = FlynnDemo.initialRoute {
                switch selection {
                case .money: moneyPath.append(route)
                case .events: eventsPath.append(route)
                case .clients: clientsPath.append(route)
                default: dashboardPath.append(route)
                }
            }
        }
        .environment(drawer)
        .animation(.easeOut(duration: 0.25), value: drawer.isOpen)
        .onChange(of: deepLink.pending) { _, link in
            guard let link else { return }
            applyDeepLink(link)
            deepLink.pending = nil
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
                // One place to cover every screen pushed in this tab — the Money
                // form stack, the note fields, the detail editors — that used to
                // strand the keyboard with no way to dismiss it.
                .dismissKeyboardOnTap()
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
        case .callsList:
            CallsListView()
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
        case .billing:
            SubscriptionDetailView()
        case .integrations:
            IntegrationsView()
        case .notifications:
            NotificationsSettingsView()
        case .appearance:
            AppearanceView()
        case .paymentDetails:
            PaymentDetailsView()
        case .callForwarding:
            CallForwardingView()
        case .support:
            SupportView()
        case .terms:
            LegalView(kind: .terms)
        case .account:
            AccountView()
        case .bookingPage, .businessType:
            PlaceholderDetailView(title: section.title, id: nil)
        }
    }

    private func applyDeepLink(_ link: DeepLinkRouter.PendingLink) {
        // `connected` is no longer a tab (see FlynnTab.visibleTabs) — it pushes
        // onto Home instead, so existing links and buttons keep working.
        if link.tab == .connected {
            selection = .dashboard
            dashboardPath.append(Route.settingsSection(.integrations))
            return
        }
        // `calls` is not a rendered tab either. Selecting it left the TabView in
        // an undefined state (a blank shell) — the "See all" on Home and the
        // flynnai://calls deep link both hit this. Push the calls list onto Home
        // instead, and the specific call after it if the link carried one.
        if link.tab == .calls {
            selection = .dashboard
            dashboardPath.append(Route.callsList)
            if let route = link.route { dashboardPath.append(route) }
            return
        }
        selection = link.tab
        guard let route = link.route else { return }
        switch link.tab {
        case .dashboard: dashboardPath.append(route)
        case .events: eventsPath.append(route)
        case .calls: callsPath.append(route)
        case .clients: clientsPath.append(route)
        case .money: moneyPath.append(route)
        case .connected: dashboardPath.append(route)
        case .brain: brainPath.append(route)
        }
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
