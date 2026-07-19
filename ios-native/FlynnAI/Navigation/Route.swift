import Foundation

/// Tab identifier for the root TabView. Value-based so deep links can select a tab.
enum FlynnTab: String, Hashable, Codable, CaseIterable, Sendable {
    // Rendered tabs (case names kept stable so deep links + parked code compile;
    // `dashboard` is displayed as "Home", `events` as "Bookings", `connected` as
    // the integrations grid).
    case dashboard
    case brain
    case events
    case money
    case clients
    case connected
    // Parked (not rendered as a tab; kept for deep links + future upsell).
    case calls

    /// The tabs actually shown in the bar, in order. `clients` joined the
    /// payments-first pivot (~/.claude/plans/iridescent-floating-moore.md) —
    /// its Swift feature (ClientsListView/ClientDetailView/ClientFormView) was
    /// already fully built but parked because the backing `clients` table was
    /// never created; see the org-spine migration for the fix.
    static let visibleTabs: [FlynnTab] = [.dashboard, .brain, .events, .money, .clients, .connected]

    var title: String {
        switch self {
        case .dashboard: return "Home"
        case .brain: return "Brain"
        case .events: return "Bookings"
        case .connected: return "Connected"
        case .calls: return "Calls"
        case .clients: return "Clients"
        case .money: return "Money"
        }
    }

    /// SF Symbol name. Liquid Glass refraction is tuned for SF Symbols, so we
    /// deliberately use them instead of custom icon assets for tab bar items.
    var systemImage: String {
        switch self {
        case .dashboard: return "house"
        case .brain: return "brain.head.profile"
        case .events: return "calendar"
        case .connected: return "square.stack.3d.up"
        case .calls: return "phone"
        case .clients: return "person.2"
        case .money: return "dollarsign.circle"
        }
    }
}

/// Routes pushed onto a per-tab NavigationStack. Codable so `NavigationPath`
/// can serialize them and deep links can reconstruct.
enum Route: Hashable, Codable, Sendable {
    case eventDetail(id: UUID)
    case clientDetail(id: UUID)
    case callDetail(id: UUID)
    case quoteDetail(id: UUID)
    case invoiceDetail(id: UUID)
    case settingsRoot
    case settingsSection(SettingsSection)
}

enum SettingsSection: String, Hashable, Codable, Sendable, CaseIterable {
    case businessProfile
    case bookingPage
    case billing
    case businessType
    case keyboard
    case integrations
    case notifications
    case appearance
    case support
    case terms
    case account

    var title: String {
        switch self {
        case .businessProfile: return "Business Profile"
        case .bookingPage: return "Booking Page"
        case .billing: return "Billing & Plans"
        case .businessType: return "Business Type"
        case .keyboard: return "Flynn Keyboard"
        case .integrations: return "Connected Apps"
        case .notifications: return "Notifications"
        case .appearance: return "Appearance"
        case .support: return "Help & Support"
        case .terms: return "Terms of Service"
        case .account: return "Account"
        }
    }

    var systemImage: String {
        switch self {
        case .businessProfile: return "building.2"
        case .bookingPage: return "calendar.badge.plus"
        case .billing: return "creditcard"
        case .businessType: return "tag"
        case .keyboard: return "keyboard"
        case .integrations: return "square.stack.3d.up"
        case .notifications: return "bell"
        case .appearance: return "paintbrush"
        case .support: return "lifepreserver"
        case .terms: return "doc.text"
        case .account: return "person.circle"
        }
    }
}
