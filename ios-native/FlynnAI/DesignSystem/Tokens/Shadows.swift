import SwiftUI

// SwiftUI's .shadow is Gaussian-blurred. Flynn's design calls for hard-offset solid
// shadows — we reproduce those by layering an ink rounded rectangle behind the view,
// offset diagonally. This is applied AFTER size is defined, so the shadow sits behind
// the rendered content.
//
// TIER 2 of the Flynn design rule (structure). Both the fill and the border resolve
// through FlynnColor.border so they invert in dark mode; they must never be literal
// black, which previously made every card lose its border AND its shadow against the
// dark background.

enum BrutalistShadowSize: CGFloat {
    case xs = 2
    case sm = 3
    case md = 4
    case lg = 6
}

struct BrutalistShadowModifier: ViewModifier {
    let size: BrutalistShadowSize
    let cornerRadius: CGFloat

    func body(content: Content) -> some View {
        content.background(
            RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                .fill(FlynnColor.border)
                .offset(x: size.rawValue, y: size.rawValue)
        )
    }
}

struct BrutalistBorderModifier: ViewModifier {
    let cornerRadius: CGFloat
    let color: Color
    let lineWidth: CGFloat

    func body(content: Content) -> some View {
        content.overlay(
            RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                .stroke(color, lineWidth: lineWidth)
        )
    }
}

extension View {
    /// Applies the Flynn brutalist hard-offset shadow.
    func brutalistShadow(
        _ size: BrutalistShadowSize = .md,
        cornerRadius: CGFloat = FlynnRadii.md
    ) -> some View {
        modifier(BrutalistShadowModifier(size: size, cornerRadius: cornerRadius))
    }

    /// Applies the signature 3pt ink outline.
    func brutalistBorder(
        cornerRadius: CGFloat = FlynnRadii.md,
        color: Color = FlynnColor.border,
        lineWidth: CGFloat = FlynnStroke.outline
    ) -> some View {
        modifier(BrutalistBorderModifier(
            cornerRadius: cornerRadius,
            color: color,
            lineWidth: lineWidth
        ))
    }
}
