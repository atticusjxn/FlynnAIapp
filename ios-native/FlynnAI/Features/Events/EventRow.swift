import SwiftUI

struct EventRow: View {
    let event: EventDTO

    var body: some View {
        FlynnCard(shadow: .sm) {
            VStack(alignment: .leading, spacing: FlynnSpacing.xs) {
                HStack {
                    Text(event.clientName ?? "Unknown client")
                        .flynnType(FlynnTypography.h4)
                        .foregroundColor(FlynnColor.textPrimary)
                    Spacer()
                    if let status = event.status {
                        FlynnBadge(label: label(for: status), variant: variant(for: status))
                    }
                }
                if let service = event.serviceType {
                    Text(service)
                        .flynnType(FlynnTypography.bodyMedium)
                        .foregroundColor(FlynnColor.textSecondary)
                }
                HStack(spacing: FlynnSpacing.xs) {
                    if let date = event.scheduledDate {
                        Text(date, style: .date)
                            .flynnType(FlynnTypography.caption)
                            .foregroundColor(FlynnColor.textTertiary)
                    }
                    if let time = event.scheduledTime {
                        Text("·")
                            .flynnType(FlynnTypography.caption)
                            .foregroundColor(FlynnColor.textTertiary)
                        Text(time)
                            .flynnType(FlynnTypography.caption)
                            .foregroundColor(FlynnColor.textTertiary)
                    }
                }
            }
        }
    }

    private func label(for status: String) -> String {
        switch status.lowercased() {
        case "new": return "New"
        case "pending": return "Pending"
        case "in-progress", "in_progress": return "In Progress"
        case "complete", "completed": return "Complete"
        case "failed": return "Failed"
        case "cancelled", "canceled": return "Cancelled"
        default: return status.replacingOccurrences(of: "_", with: " ").capitalized
        }
    }

    private func variant(for status: String) -> FlynnBadgeVariant {
        switch status.lowercased() {
        case "complete", "completed": return .success
        case "pending": return .warning
        case "in-progress", "in_progress": return .primary
        case "failed", "cancelled", "canceled": return .error
        default: return .neutral
        }
    }
}
