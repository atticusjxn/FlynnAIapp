import SwiftUI

enum FlynnButtonVariant {
    case primary
    case secondary
    case success
    case danger
    case ghost

    var background: Color {
        switch self {
        case .primary: return FlynnColor.primary
        case .secondary: return FlynnColor.white
        case .success: return FlynnColor.success
        case .danger: return FlynnColor.error
        case .ghost: return .clear
        }
    }

    var foreground: Color {
        switch self {
        case .primary, .success, .danger: return FlynnColor.white
        case .secondary, .ghost: return FlynnColor.textPrimary
        }
    }

    var borderColor: Color {
        switch self {
        case .ghost: return .clear
        default: return FlynnColor.border
        }
    }

    var shadowSize: BrutalistShadowSize? {
        switch self {
        case .ghost: return nil
        default: return .md
        }
    }
}

enum FlynnButtonSize {
    case small, medium, large

    var height: CGFloat {
        switch self {
        case .small: return 44
        case .medium: return FlynnLayout.buttonHeight
        case .large: return 64
        }
    }

    var horizontalPadding: CGFloat {
        switch self {
        case .small: return FlynnSpacing.md
        case .medium: return FlynnSpacing.lg
        case .large: return FlynnSpacing.xl
        }
    }
}

struct FlynnButton: View {
    let title: String
    let action: () -> Void
    var variant: FlynnButtonVariant = .primary
    var size: FlynnButtonSize = .medium
    var fullWidth: Bool = false
    var isLoading: Bool = false
    var isDisabled: Bool = false
    var icon: Image? = nil

    @State private var isPressed = false

    var body: some View {
        Button(action: {
            guard !isLoading, !isDisabled else { return }
            action()
        }) {
            HStack(spacing: FlynnSpacing.xs) {
                if isLoading {
                    ProgressView()
                        .tint(variant.foreground)
                } else {
                    if let icon {
                        icon.foregroundColor(variant.foreground)
                    }
                    Text(title)
                        .flynnType(FlynnTypography.button)
                        .foregroundColor(variant.foreground)
                }
            }
            .frame(maxWidth: fullWidth ? .infinity : nil)
            .frame(height: size.height)
            .padding(.horizontal, size.horizontalPadding)
            .background(
                RoundedRectangle(cornerRadius: FlynnRadii.md, style: .continuous)
                    .fill(variant.background)
            )
            .brutalistBorder(
                cornerRadius: FlynnRadii.md,
                color: variant.borderColor,
                lineWidth: variant == .ghost ? 0 : 2
            )
            .modifier(OptionalBrutalistShadow(size: variant.shadowSize, isPressed: isPressed))
            .opacity(isDisabled ? 0.4 : 1)
            .scaleEffect(isPressed ? 0.98 : 1)
            .offset(
                x: isPressed ? (variant.shadowSize?.rawValue ?? 0) : 0,
                y: isPressed ? (variant.shadowSize?.rawValue ?? 0) : 0
            )
        }
        .buttonStyle(.plain)
        .disabled(isLoading || isDisabled)
        .onLongPressGesture(minimumDuration: 0, maximumDistance: .infinity, pressing: { pressing in
            withAnimation(.easeOut(duration: 0.1)) { isPressed = pressing }
        }, perform: {})
    }
}

private struct OptionalBrutalistShadow: ViewModifier {
    let size: BrutalistShadowSize?
    let isPressed: Bool

    func body(content: Content) -> some View {
        if let size, !isPressed {
            content.brutalistShadow(size, cornerRadius: FlynnRadii.md)
        } else {
            content
        }
    }
}

#Preview {
    VStack(spacing: FlynnSpacing.md) {
        FlynnButton(title: "Primary", action: {})
        FlynnButton(title: "Secondary", action: {}, variant: .secondary)
        FlynnButton(title: "Success", action: {}, variant: .success)
        FlynnButton(title: "Danger", action: {}, variant: .danger)
        FlynnButton(title: "Full Width", action: {}, fullWidth: true)
        FlynnButton(title: "Loading", action: {}, isLoading: true)
        FlynnButton(title: "Disabled", action: {}, isDisabled: true)
    }
    .padding(FlynnSpacing.lg)
    .background(FlynnColor.background)
}
