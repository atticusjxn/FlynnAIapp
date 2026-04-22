import SwiftUI

/// Maps Twilio call status strings to a FlynnBadge variant + label.
enum CallStatusBadgeMapper {
    static func label(for status: String?) -> String {
        guard let status, !status.isEmpty else { return "Unknown" }
        // Humanize: "in-progress" -> "In progress"
        let cleaned = status.replacingOccurrences(of: "-", with: " ")
            .replacingOccurrences(of: "_", with: " ")
        return cleaned.prefix(1).uppercased() + cleaned.dropFirst()
    }

    static func variant(for status: String?) -> FlynnBadgeVariant {
        switch status?.lowercased() {
        case "completed": return .success
        case "failed", "no-answer", "busy", "cancelled", "canceled": return .error
        case "in-progress", "ringing", "queued": return .primary
        default: return .warning
        }
    }
}

struct CallStatusBadge: View {
    let status: String?

    var body: some View {
        FlynnBadge(
            label: CallStatusBadgeMapper.label(for: status),
            variant: CallStatusBadgeMapper.variant(for: status)
        )
    }
}
