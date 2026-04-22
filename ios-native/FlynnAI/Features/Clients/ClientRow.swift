import SwiftUI

struct ClientRow: View {
    let client: ClientDTO

    var body: some View {
        FlynnCard(shadow: .sm) {
            VStack(alignment: .leading, spacing: FlynnSpacing.xs) {
                HStack(alignment: .firstTextBaseline) {
                    Text(client.name)
                        .flynnType(FlynnTypography.h4)
                        .foregroundColor(FlynnColor.textPrimary)
                    Spacer()
                    if let count = client.totalJobs, count > 0 {
                        FlynnBadge(label: "\(count) job\(count == 1 ? "" : "s")", variant: .primary)
                    }
                }

                if let phone = client.phone, !phone.isEmpty {
                    Label(FlynnFormatter.phone(phone), systemImage: "phone")
                        .flynnType(FlynnTypography.bodySmall)
                        .foregroundColor(FlynnColor.textSecondary)
                }

                if let lastJobType = client.lastJobType {
                    HStack(spacing: FlynnSpacing.xxs) {
                        Text(lastJobType)
                            .flynnType(FlynnTypography.caption)
                            .foregroundColor(FlynnColor.textTertiary)
                        if let lastJobDate = client.lastJobDate {
                            Text("·")
                                .flynnType(FlynnTypography.caption)
                                .foregroundColor(FlynnColor.textTertiary)
                            Text(FlynnFormatter.relativeDate(lastJobDate))
                                .flynnType(FlynnTypography.caption)
                                .foregroundColor(FlynnColor.textTertiary)
                        }
                    }
                }
            }
        }
    }
}
