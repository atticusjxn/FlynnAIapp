import SwiftUI

// MARK: - Liquid Glass
//
// iOS 26's real Liquid Glass — the material that refracts and reacts to the
// content moving behind it — used for genuinely floating chrome (the agent bar,
// the mic). This is distinct from FlynnGlassButton, which is a hand-painted
// gradient "glass" shared with the landing page for in-flow CTAs. Rule of thumb:
//   • FlynnGlassButton → a CTA that sits *in* the layout (Login, invoice page).
//   • flynnGlass()      → chrome that *floats over* scrolling content.
//
// Everything is gated on iOS 26 with a warm-material fallback, so the app still
// builds and runs on the 17/18 deployment floor.

extension View {
    /// Apply real Liquid Glass in the given shape. Falls back to a tinted warm
    /// material on older systems.
    @ViewBuilder
    func flynnGlass(in shape: some Shape, tint: Color? = nil, interactive: Bool = false) -> some View {
        if #available(iOS 26.0, *) {
            self.glassEffect(glassConfig(tint: tint, interactive: interactive), in: shape)
        } else {
            self.background {
                ZStack {
                    shape.fill(.ultraThinMaterial)
                    if let tint { shape.fill(tint.opacity(0.85)) }
                }
            }
        }
    }

    @available(iOS 26.0, *)
    private func glassConfig(tint: Color?, interactive: Bool) -> Glass {
        var glass = Glass.regular
        if let tint { glass = glass.tint(tint) }
        if interactive { glass = glass.interactive() }
        return glass
    }
}

/// Groups adjacent glass shapes so they blend and share lighting instead of
/// each rendering its own edge — the difference between two glass blobs and one
/// unified control. A no-op passthrough before iOS 26.
struct FlynnGlassGroup<Content: View>: View {
    var spacing: CGFloat = FlynnSpacing.xs
    @ViewBuilder var content: Content

    var body: some View {
        if #available(iOS 26.0, *) {
            GlassEffectContainer(spacing: spacing) { content }
        } else {
            content
        }
    }
}
