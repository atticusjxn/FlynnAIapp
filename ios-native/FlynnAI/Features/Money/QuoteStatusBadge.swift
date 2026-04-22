import SwiftUI

enum QuoteStatusBadgeMapper {
    static func variant(for status: String) -> FlynnBadgeVariant {
        switch status.lowercased() {
        case "draft": return .neutral
        case "sent", "viewed": return .primary
        case "accepted": return .success
        case "declined", "expired": return .error
        default: return .neutral
        }
    }

    static func label(for status: String) -> String {
        status.prefix(1).uppercased() + status.dropFirst()
    }
}

enum InvoiceStatusBadgeMapper {
    static func variant(for status: String) -> FlynnBadgeVariant {
        switch status.lowercased() {
        case "draft": return .neutral
        case "sent", "viewed": return .primary
        case "partial": return .warning
        case "paid": return .success
        case "overdue": return .error
        case "cancelled", "canceled", "refunded": return .error
        default: return .neutral
        }
    }

    static func label(for status: String) -> String {
        status.prefix(1).uppercased() + status.dropFirst()
    }
}
