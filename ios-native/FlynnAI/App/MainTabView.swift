import SwiftUI

/// Root tab shell. Each tab owns its own `NavigationPath` so deep links can
/// push onto the correct stack without clobbering the others.
struct MainTabView: View {
    @Environment(DeepLinkRouter.self) private var deepLink
    @State private var selection: FlynnTab = .dashboard

    @State private var dashboardPath = NavigationPath()
    @State private var eventsPath = NavigationPath()
    @State private var callsPath = NavigationPath()
    @State private var clientsPath = NavigationPath()
    @State private var moneyPath = NavigationPath()
    @State private var settingsPath = NavigationPath()

    var body: some View {
        TabView(selection: $selection) {
            Tab(FlynnTab.dashboard.title, systemImage: FlynnTab.dashboard.systemImage, value: FlynnTab.dashboard) {
                NavigationStack(path: $dashboardPath) {
                    DashboardView()
                        .navigationDestination(for: Route.self) { route in destination(for: route) }
                }
            }
            Tab(FlynnTab.events.title, systemImage: FlynnTab.events.systemImage, value: FlynnTab.events) {
                NavigationStack(path: $eventsPath) {
                    EventsListView()
                        .navigationDestination(for: Route.self) { route in destination(for: route) }
                }
            }
            Tab(FlynnTab.calls.title, systemImage: FlynnTab.calls.systemImage, value: FlynnTab.calls) {
                NavigationStack(path: $callsPath) {
                    CallsListView()
                        .navigationDestination(for: Route.self) { route in destination(for: route) }
                }
            }
            Tab(FlynnTab.clients.title, systemImage: FlynnTab.clients.systemImage, value: FlynnTab.clients) {
                NavigationStack(path: $clientsPath) {
                    ClientsListView()
                        .navigationDestination(for: Route.self) { route in destination(for: route) }
                }
            }
            Tab(FlynnTab.money.title, systemImage: FlynnTab.money.systemImage, value: FlynnTab.money) {
                NavigationStack(path: $moneyPath) {
                    MoneyView()
                        .navigationDestination(for: Route.self) { route in destination(for: route) }
                }
            }
            Tab(FlynnTab.settings.title, systemImage: FlynnTab.settings.systemImage, value: FlynnTab.settings) {
                NavigationStack(path: $settingsPath) {
                    SettingsView()
                        .navigationDestination(for: Route.self) { route in destination(for: route) }
                }
            }
        }
        .tabBarMinimizeBehavior(.onScrollDown)
        .onChange(of: deepLink.pending) { _, link in
            guard let link else { return }
            applyDeepLink(link)
            deepLink.pending = nil
        }
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
        case .settings: settingsPath.append(route)
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
