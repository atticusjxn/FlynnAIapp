import SwiftUI

// MARK: - Mid-century motifs
//
// The atomic-age shape vocabulary that carries Flynn's brand: outlined circles
// and pie wedges bleeding off the frame, and starburst sparkles. These are the
// same motifs the landing page draws with bordered `<span>`s and an inline SVG
// starburst, so app and web read as one product.
//
// These live in the design system rather than in Onboarding because they are
// brand assets, not onboarding-local decoration.

/// A filled pie wedge — the workhorse of the mid-century backdrop (arcs in corners).
struct Wedge: Shape {
    var start: Angle
    var end: Angle
    func path(in r: CGRect) -> Path {
        var p = Path()
        let c = CGPoint(x: r.midX, y: r.midY)
        p.move(to: c)
        p.addArc(center: c, radius: r.width / 2, startAngle: start, endAngle: end, clockwise: false)
        p.closeSubpath()
        return p
    }
}

/// A radiating starburst — the atomic-age sparkle accent.
struct Starburst: View {
    var color: Color
    var spokes: Int = 12
    var body: some View {
        GeometryReader { geo in
            let s = min(geo.size.width, geo.size.height)
            ZStack {
                ForEach(0..<spokes, id: \.self) { i in
                    Capsule()
                        .fill(color)
                        .frame(width: s * 0.06, height: s)
                        .rotationEffect(.degrees(Double(i) / Double(spokes) * 180))
                }
            }
            .frame(width: s, height: s)
            .position(x: geo.size.width / 2, y: geo.size.height / 2)
        }
    }
}

private struct OutlinedCircle: View {
    var color: Color
    var body: some View {
        Circle()
            .fill(color)
            .overlay(Circle().stroke(FlynnColor.border, lineWidth: FlynnStroke.outline))
    }
}

private struct OutlinedWedge: View {
    var color: Color
    var start: Double
    var end: Double
    var body: some View {
        Wedge(start: .degrees(start), end: .degrees(end))
            .fill(color)
            .overlay(
                Wedge(start: .degrees(start), end: .degrees(end))
                    .stroke(FlynnColor.border, lineWidth: FlynnStroke.outline)
            )
    }
}

/// Cream field scattered with mid-century geometric motifs. `variant` rotates the
/// arrangement per screen so consecutive screens feel related but not identical.
/// Shapes anchor to corners/edges so the centre stays clear for content.
struct MidCenturyBackdrop: View {
    var variant: Int

    var body: some View {
        GeometryReader { geo in
            let w = geo.size.width, h = geo.size.height
            ZStack {
                FlynnColor.background.ignoresSafeArea()
                Group {
                    // Shapes hug the top-right corner (mostly off-screen) and the
                    // bottom half only — the top-left text zone stays clear cream so
                    // headlines never sit on a dark shape.
                    switch variant % 4 {
                    case 0:
                        OutlinedCircle(color: FlynnColor.teal).frame(width: w * 0.34).position(x: w * 1.04, y: h * 0.02)
                        OutlinedWedge(color: FlynnColor.olive, start: 180, end: 320)
                            .frame(width: w * 0.5, height: w * 0.5).position(x: 0, y: h * 1.02)
                        OutlinedCircle(color: FlynnColor.mustard).frame(width: w * 0.34).position(x: w, y: h * 0.97)
                        OutlinedCircle(color: FlynnColor.primary).frame(width: w * 0.09).position(x: w * 0.84, y: h * 0.74)
                    case 1:
                        OutlinedCircle(color: FlynnColor.mustard).frame(width: w * 0.3).position(x: w * 1.05, y: 0)
                        OutlinedCircle(color: FlynnColor.terra).frame(width: w * 0.4).position(x: 0, y: h * 1.02)
                        OutlinedWedge(color: FlynnColor.teal, start: 200, end: 340)
                            .frame(width: w * 0.48, height: w * 0.48).position(x: w, y: h * 0.93)
                        OutlinedCircle(color: FlynnColor.primary).frame(width: w * 0.08).position(x: w * 0.14, y: h * 0.74)
                    case 2:
                        OutlinedCircle(color: FlynnColor.terra).frame(width: w * 0.32).position(x: w * 1.04, y: h * 0.03)
                        OutlinedWedge(color: FlynnColor.teal, start: 30, end: 170)
                            .frame(width: w * 0.48, height: w * 0.48).position(x: 0, y: h)
                        OutlinedCircle(color: FlynnColor.mustard).frame(width: w * 0.3).position(x: w, y: h * 1.0)
                        Starburst(color: FlynnColor.terra).frame(width: w * 0.13).position(x: w * 0.22, y: h * 0.88)
                    default:
                        OutlinedCircle(color: FlynnColor.olive).frame(width: w * 0.32).position(x: w * 1.04, y: h * 0.02)
                        OutlinedCircle(color: FlynnColor.mustard).frame(width: w * 0.36).position(x: 0, y: h)
                        OutlinedCircle(color: FlynnColor.terra).frame(width: w * 0.3).position(x: w, y: h * 0.96)
                        OutlinedCircle(color: FlynnColor.teal).frame(width: w * 0.08).position(x: w * 0.86, y: h * 0.72)
                    }
                }
                .clipped()
            }
        }
        .ignoresSafeArea()
    }
}

// MARK: - Mascot hero

/// Mascot with a spring entrance — used at the top of hero moments.
struct MascotHero: View {
    var pose: MascotPose
    var size: CGFloat = 180
    @State private var appeared = false

    var body: some View {
        Image(pose.assetName)
            .resizable().scaledToFit()
            .frame(width: size, height: size)
            .scaleEffect(appeared ? 1 : 0.6)
            .rotationEffect(.degrees(appeared ? 0 : -8))
            .opacity(appeared ? 1 : 0)
            .onAppear {
                withAnimation(.spring(response: 0.55, dampingFraction: 0.6).delay(0.05)) { appeared = true }
            }
            .accessibilityHidden(true)
    }
}

#Preview {
    ZStack {
        MidCenturyBackdrop(variant: 2)
        VStack(spacing: FlynnSpacing.md) {
            Text("Mid-century motifs")
                .flynnType(FlynnTypography.h1)
                .foregroundColor(FlynnColor.textPrimary)
            Starburst(color: FlynnColor.terra).frame(width: 60, height: 60)
        }
    }
}
