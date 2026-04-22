import SwiftUI

enum FlynnBadgeVariant {
    case neutral, primary, success, warning, error

    var background: Color {
        switch self {
        case .neutral: return FlynnColor.gray200
        case .primary: return FlynnColor.primaryLight
        case .success: return FlynnColor.successLight
        case .warning: return FlynnColor.warningLight
        case .error: return FlynnColor.errorLight
        }
    }

    var foreground: Color {
        switch self {
        case .neutral: return FlynnColor.gray700
        case .primary: return FlynnColor.primaryDark
        case .success: return FlynnColor.successDark
        case .warning: return FlynnColor.warningDark
        case .error: return FlynnColor.errorDark
        }
    }
}

struct FlynnBadge: View {
    let label: String
    var variant: FlynnBadgeVariant = .neutral

    var body: some View {
        Text(label)
            .flynnType(FlynnTypography.caption)
            .foregroundColor(variant.foreground)
            .padding(.horizontal, FlynnSpacing.sm)
            .padding(.vertical, FlynnSpacing.xxs)
            .background(
                Capsule().fill(variant.background)
            )
    }
}

#Preview {
    HStack(spacing: FlynnSpacing.xs) {
        FlynnBadge(label: "Pending", variant: .warning)
        FlynnBadge(label: "Complete", variant: .success)
        FlynnBadge(label: "In Progress", variant: .primary)
        FlynnBadge(label: "Failed", variant: .error)
        FlynnBadge(label: "Draft")
    }
    .padding()
}
