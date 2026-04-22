import Foundation
import SwiftUI
import os

/// Parses `flynnai://` URLs into a tab + route pair that the UI can consume.
///
/// Examples:
///   flynnai://dashboard
///   flynnai://events
///   flynnai://events/<uuid>
///   flynnai://clients/<uuid>
///   flynnai://settings/billing
@MainActor
@Observable
final class DeepLinkRouter {
    /// Pending link set by the OS. The root view clears it after consuming.
    var pending: PendingLink?

    struct PendingLink: Hashable, Sendable {
        let tab: FlynnTab
        let route: Route?
    }

    func handle(url: URL) {
        FlynnLog.nav.info("DeepLink received: \(url.absoluteString, privacy: .public)")
        guard url.scheme?.lowercased() == "flynnai" else { return }

        // URL format: flynnai://<host>/<path?>  — host is the tab segment
        let host = url.host?.lowercased()
        let pathComponents = url.pathComponents.filter { $0 != "/" }

        switch host {
        case "dashboard":
            pending = PendingLink(tab: .dashboard, route: nil)
        case "events":
            if let first = pathComponents.first, let id = UUID(uuidString: first) {
                pending = PendingLink(tab: .events, route: .eventDetail(id: id))
            } else {
                pending = PendingLink(tab: .events, route: nil)
            }
        case "clients":
            if let first = pathComponents.first, let id = UUID(uuidString: first) {
                pending = PendingLink(tab: .clients, route: .clientDetail(id: id))
            } else {
                pending = PendingLink(tab: .clients, route: nil)
            }
        case "calls":
            if let first = pathComponents.first, let id = UUID(uuidString: first) {
                pending = PendingLink(tab: .calls, route: .callDetail(id: id))
            } else {
                pending = PendingLink(tab: .calls, route: nil)
            }
        case "money":
            // flynnai://money                          — lands on Money tab
            // flynnai://money/<uuid>                   — invoice detail (legacy shape)
            // flynnai://money/quotes/<uuid>            — quote detail
            // flynnai://money/invoices/<uuid>          — invoice detail
            if pathComponents.count >= 2 {
                let kind = pathComponents[0].lowercased()
                if let id = UUID(uuidString: pathComponents[1]) {
                    switch kind {
                    case "quotes":
                        pending = PendingLink(tab: .money, route: .quoteDetail(id: id))
                    case "invoices":
                        pending = PendingLink(tab: .money, route: .invoiceDetail(id: id))
                    default:
                        pending = PendingLink(tab: .money, route: nil)
                    }
                } else {
                    pending = PendingLink(tab: .money, route: nil)
                }
            } else if let first = pathComponents.first, let id = UUID(uuidString: first) {
                pending = PendingLink(tab: .money, route: .invoiceDetail(id: id))
            } else {
                pending = PendingLink(tab: .money, route: nil)
            }
        case "settings":
            if let first = pathComponents.first,
               let section = SettingsSection(rawValue: first) {
                pending = PendingLink(tab: .settings, route: .settingsSection(section))
            } else {
                pending = PendingLink(tab: .settings, route: nil)
            }
        default:
            FlynnLog.nav.warning("Unknown deep link host: \(host ?? "nil", privacy: .public)")
        }
    }
}
