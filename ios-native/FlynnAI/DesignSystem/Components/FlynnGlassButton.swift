import SwiftUI

/// TIER 3 of the Flynn design rule — *action*. A translucent gradient fill, a
/// bright inner sheen along the top edge, a hairline specular highlight, and a
/// soft coloured glow beneath.
///
/// ⚠️ USE AT MOST ONE PER SCREEN, on the single primary call to action.
///
/// Scarcity is the entire point: glass only reads as premium when it's the one
/// thing on the page wearing it. Everything else — secondary actions, list
/// affordances, anything inside a card — uses `FlynnButton`. A screen with two
/// glass buttons has no primary action, and a screen made entirely of them
/// (Login used to be) spends the effect for nothing.
///
/// Shares its gradient with the landing page's `.flynn-pill` and the hosted
/// invoice page's `.btn`, so the app and the client-facing payment page read as
/// one product.
enum FlynnGlassVariant {
    /// Brand orange — the primary action.
    case primary
    /// Neutral light glass, for secondary actions on light backgrounds.
    case neutral
    /// Deep ink glass, for use over imagery or colour.
    case dark

    var gradient: LinearGradient {
        switch self {
        case .primary:
            // Hued off the one brand orange (#FB5B1E) so glass and ground share
            // a family — this used to be built on the retired #ff4500.
            return LinearGradient(
                colors: [Color(hex: "#FF8A4C"), FlynnColor.primary, Color(hex: "#D94A12")],
                startPoint: .top, endPoint: .bottom
            )
        case .neutral:
            return LinearGradient(
                colors: [Color(hex: "#FFFBF4"), Color(hex: "#F2E9D8")],
                startPoint: .top, endPoint: .bottom
            )
        case .dark:
            // Warm ink, not cool charcoal.
            return LinearGradient(
                colors: [Color(hex: "#4A3B30"), Color(hex: "#2C2018")],
                startPoint: .top, endPoint: .bottom
            )
        }
    }

    var foreground: Color {
        switch self {
        case .primary, .dark: return FlynnColor.textInverse
        case .neutral: return Color(hex: "#2C2018")
        }
    }

    /// The coloured glow cast beneath the button. Neutral gets a plain shadow.
    var glow: Color {
        switch self {
        case .primary: return FlynnColor.primary.opacity(0.45)
        case .dark: return Color.black.opacity(0.28)
        case .neutral: return Color.black.opacity(0.10)
        }
    }

    var strokeOpacity: Double {
        switch self {
        case .neutral: return 0.9
        case .primary, .dark: return 0.28
        }
    }
}

struct FlynnGlassButton: View {
    let title: String
    let action: () -> Void
    var variant: FlynnGlassVariant = .primary
    var fullWidth: Bool = true
    var isLoading: Bool = false
    var isDisabled: Bool = false
    var icon: Image? = nil

    @State private var isPressed = false

    private let height: CGFloat = 56

    var body: some View {
        Button(action: {
            guard !isLoading, !isDisabled else { return }
            action()
        }) {
            HStack(spacing: FlynnSpacing.xs) {
                if isLoading {
                    ProgressView().tint(variant.foreground)
                } else {
                    if let icon { icon.foregroundColor(variant.foreground) }
                    Text(title)
                        .flynnType(FlynnTypography.button)
                        .foregroundColor(variant.foreground)
                }
            }
            .frame(maxWidth: fullWidth ? .infinity : nil)
            .frame(height: height)
            .padding(.horizontal, FlynnSpacing.lg)
            .background(glassBackground)
            // Full capsule — the 2026 pill language, shared with the landing
            // page (.flynn-pill) and the hosted invoice page's .btn.
            .clipShape(Capsule(style: .continuous))
            // Coloured glow sits outside the clip so it can bloom: one tight
            // layer for lift, one wide soft layer for the "lit from within" read.
            .shadow(color: isPressed ? .clear : variant.glow, radius: 16, x: 0, y: 8)
            .shadow(color: isPressed ? .clear : variant.glow.opacity(0.55), radius: 36, x: 0, y: 20)
            .shadow(color: Color.black.opacity(0.12), radius: 4, x: 0, y: 2)
            .scaleEffect(isPressed ? 0.985 : 1)
            .offset(y: isPressed ? 1 : 0)
            .opacity(isDisabled ? 0.55 : 1)
        }
        .buttonStyle(.plain)
        .disabled(isLoading || isDisabled)
        .animation(.easeOut(duration: 0.16), value: isPressed)
        .onLongPressGesture(minimumDuration: 0, maximumDistance: .infinity, pressing: { pressing in
            isPressed = pressing
        }, perform: {})
    }

    private var glassBackground: some View {
        ZStack {
            variant.gradient

            // Inner sheen: bright at the very top, gone by ~60% down. This is
            // what sells the "glass" read.
            LinearGradient(
                stops: [
                    .init(color: .white.opacity(0.42), location: 0.0),
                    .init(color: .white.opacity(0.10), location: 0.42),
                    .init(color: .white.opacity(0.0), location: 0.62),
                ],
                startPoint: .top, endPoint: .bottom
            )

            // Hairline specular highlight along the top edge.
            VStack {
                LinearGradient(
                    colors: [.clear, .white.opacity(0.75), .clear],
                    startPoint: .leading, endPoint: .trailing
                )
                .frame(height: 1)
                Spacer(minLength: 0)
            }
        }
        .overlay(
            Capsule(style: .continuous)
                .strokeBorder(Color.white.opacity(variant.strokeOpacity), lineWidth: 1)
        )
    }
}

#Preview {
    VStack(spacing: 16) {
        FlynnGlassButton(title: "Get paid now", action: {})
        FlynnGlassButton(title: "Send invoice", action: {}, variant: .dark,
                         icon: Image(systemName: "paperplane.fill"))
        FlynnGlassButton(title: "Not now", action: {}, variant: .neutral)
        FlynnGlassButton(title: "Working", action: {}, isLoading: true)
    }
    .padding(24)
    .background(FlynnColor.background)
}
