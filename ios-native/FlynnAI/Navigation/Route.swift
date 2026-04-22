import Foundation

/// Tab identifier for the root TabView. Value-based so deep links can select a tab.
enum FlynnTab: String, Hashable, Codable, CaseIterable, Sendable {
    case dashboard
    case events
    case calls
    case clients
    case money
    case settings

    var title: String {
        switch self {
        case .dashboard: return "Dashboard"
        case .events: return "Events"
        case .calls: return "Calls"
        case .clients: return "Clients"
        case .money: return "Money"
        case .settings: return "Settings"
        }
    }

    /// SF Symbol name. Liquid Glass refraction is tuned for SF Symbols, so we
    /// deliberately use them instead of custom icon assets for tab bar items.
    var systemImage: String {
        switch self {
        case .dashboard: return "square.grid.2x2"
        case .events: return "calendar"
        case .calls: return "phone"
        case .clients: return "person.2"
        case .money: return "dollarsign.circle"
        case .settings: return "gearshape"
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
    case settingsSection(SettingsSection)
}

enum SettingsSection: String, Hashable, Codable, Sendable, CaseIterable {
    case businessProfile
    case bookingPage
    case billing
    case businessType
    case callForwarding
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
        case .callForwarding: return "Call Forwarding"
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
        case .callForwarding: return "phone.arrow.up.right"
        case .integrations: return "square.stack.3d.up"
        case .notifications: return "bell"
        case .appearance: return "paintbrush"
        case .support: return "lifepreserver"
        case .terms: return "doc.text"
        case .account: return "person.circle"
        }
    }
}
