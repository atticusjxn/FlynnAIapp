import SwiftUI

/// TIER 2 of the Flynn design rule — *structure*.
///
/// The outline is deliberately dialled back on dense content. A full 3pt ink
/// border on every invoice row makes a list of forty jobs unreadable, so pick
/// the style by how much the surface needs to be separated from the page:
///
/// - `.raised`  hero and detail cards — outline + hard offset shadow
/// - `.flat`    grids and stacked cards — outline, no shadow
/// - `.quiet`   dense list rows — fill only, separated by a hairline
enum FlynnCardStyle {
    case raised
    case flat
    case quiet
}

struct FlynnCard<Content: View>: View {
    var style: FlynnCardStyle = .raised
    var padding: CGFloat = FlynnSpacing.md
    var shadow: BrutalistShadowSize = .md
    var cornerRadius: CGFloat = FlynnRadii.lg
    let content: Content

    init(
        style: FlynnCardStyle = .raised,
        padding: CGFloat = FlynnSpacing.md,
        shadow: BrutalistShadowSize = .md,
        cornerRadius: CGFloat = FlynnRadii.lg,
        @ViewBuilder content: () -> Content
    ) {
        self.style = style
        self.padding = padding
        self.shadow = shadow
        self.cornerRadius = cornerRadius
        self.content = content()
    }

    var body: some View {
        content
            .padding(padding)
            .frame(maxWidth: .infinity, alignment: .leading)
            .flynnCardSurface(style, cornerRadius: cornerRadius, shadow: shadow)
    }
}

struct FlynnCardSurface: ViewModifier {
    let style: FlynnCardStyle
    let cornerRadius: CGFloat
    let shadow: BrutalistShadowSize
    var borderColor: Color = FlynnColor.border

    func body(content: Content) -> some View {
        switch style {
        case .raised:
            content
                .brutalistBorder(cornerRadius: cornerRadius, color: borderColor)
                .brutalistShadow(shadow, cornerRadius: cornerRadius)
        case .flat:
            content
                .brutalistBorder(cornerRadius: cornerRadius, color: borderColor)
        case .quiet:
            content
                .brutalistBorder(
                    cornerRadius: cornerRadius,
                    color: FlynnColor.borderSubtle,
                    lineWidth: FlynnStroke.hairline
                )
        }
    }
}

extension View {
    /// The `FlynnCard` surface treatment, for views that already own their own
    /// layout and only need the card's fill + outline + elevation. Use this
    /// instead of hand-rolling `.background(RoundedRectangle…).brutalistBorder(…)`
    /// — that duplication is how Home ended up with a different card radius and
    /// elevation from Jobs and Clients.
    func flynnCardSurface(
        _ style: FlynnCardStyle = .raised,
        cornerRadius: CGFloat = FlynnRadii.lg,
        shadow: BrutalistShadowSize = .md,
        fill: Color = FlynnColor.backgroundSecondary,
        borderColor: Color = FlynnColor.border
    ) -> some View {
        self
            .background(
                RoundedRectangle(cornerRadius: cornerRadius, style: .continuous).fill(fill)
            )
            .modifier(FlynnCardSurface(
                style: style,
                cornerRadius: cornerRadius,
                shadow: shadow,
                borderColor: borderColor
            ))
    }
}

#Preview {
    VStack(spacing: FlynnSpacing.md) {
        FlynnCard {
            VStack(alignment: .leading, spacing: FlynnSpacing.xs) {
                Text("Roof repair")
                    .flynnType(FlynnTypography.h3)
                Text("Jane Doe • Tuesday, 2:00pm")
                    .flynnType(FlynnTypography.bodyMedium)
                    .foregroundColor(FlynnColor.textSecondary)
            }
        }
        FlynnCard(style: .flat) {
            Text("Flat card — outline, no shadow")
                .flynnType(FlynnTypography.bodyLarge)
        }
        VStack(spacing: FlynnSpacing.xs) {
            FlynnCard(style: .quiet) {
                Text("Quiet row — for dense lists")
                    .flynnType(FlynnTypography.bodyLarge)
            }
            FlynnCard(style: .quiet) {
                Text("Quiet row — stays scannable")
                    .flynnType(FlynnTypography.bodyLarge)
            }
        }
    }
    .padding(FlynnSpacing.lg)
    .background(FlynnColor.background)
}
