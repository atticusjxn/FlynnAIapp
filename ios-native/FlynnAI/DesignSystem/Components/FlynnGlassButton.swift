import SwiftUI

/// Glassmorphic button — the "next level" surface treatment used by apps like
/// Cluely: a translucent gradient fill, a bright inner sheen along the top
/// edge, a hairline specular highlight, and a soft coloured glow beneath.
///
/// This sits ALONGSIDE `FlynnButton` (the brutalist hard-shadow style) rather
/// than replacing it — the brutalist look is still right for dense, utilitarian
/// screens, while this is for hero moments: the primary call to action, paywall,
/// onboarding, and anywhere the app should feel premium.
///
/// Matches the CSS treatment on the hosted invoice page (services/photoInvoice.js)
/// so the app and the client-facing payment page read as one product.
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
            return LinearGradient(
                colors: [Color(hex: "#ff8a4c"), FlynnColor.primary, Color(hex: "#d94e1c")],
                startPoint: .top, endPoint: .bottom
            )
        case .neutral:
            return LinearGradient(
                colors: [Color.white, Color(hex: "#f4f5f7")],
                startPoint: .top, endPoint: .bottom
            )
        case .dark:
            return LinearGradient(
                colors: [Color(hex: "#3b3b42"), Color(hex: "#1c1c21")],
                startPoint: .top, endPoint: .bottom
            )
        }
    }

    var foreground: Color {
        switch self {
        case .primary, .dark: return .white
        case .neutral: return FlynnColor.textPrimary
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

    private let corner: CGFloat = 16
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
            .clipShape(RoundedRectangle(cornerRadius: corner, style: .continuous))
            // Coloured glow sits outside the clip so it can bloom.
            .shadow(color: isPressed ? .clear : variant.glow, radius: 18, x: 0, y: 8)
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
            RoundedRectangle(cornerRadius: corner, style: .continuous)
                .strokeBorder(Color.white.opacity(variant.strokeOpacity), lineWidth: 1)
        )
    }
}

/// Frosted translucent surface for cards and bars — the same material language
/// as the button, for panels that sit over content.
struct FlynnGlassCard<Content: View>: View {
    var cornerRadius: CGFloat = 18
    @ViewBuilder var content: Content

    var body: some View {
        content
            .background(.ultraThinMaterial)
            .background(Color.white.opacity(0.35))
            .clipShape(RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                    .strokeBorder(
                        LinearGradient(
                            colors: [.white.opacity(0.7), .white.opacity(0.15)],
                            startPoint: .top, endPoint: .bottom
                        ),
                        lineWidth: 1
                    )
            )
            .shadow(color: .black.opacity(0.08), radius: 16, x: 0, y: 6)
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
    .background(Color(hex: "#f6f7f9"))
}
