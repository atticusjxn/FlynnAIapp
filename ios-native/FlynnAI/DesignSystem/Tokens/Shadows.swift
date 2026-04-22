import SwiftUI

// SwiftUI's .shadow is Gaussian-blurred. The Flynn brutalist design calls for hard-offset
// solid shadows — we reproduce those by layering a black rounded rectangle behind the
// view, offset diagonally. This is applied AFTER size is defined, so the shadow sits
// behind the rendered content.

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
                .fill(Color.black)
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

    /// Applies the signature 2pt black border.
    func brutalistBorder(
        cornerRadius: CGFloat = FlynnRadii.md,
        color: Color = .black,
        lineWidth: CGFloat = 2
    ) -> some View {
        modifier(BrutalistBorderModifier(
            cornerRadius: cornerRadius,
            color: color,
            lineWidth: lineWidth
        ))
    }
}
