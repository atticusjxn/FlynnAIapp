import SwiftUI
import UIKit

// MARK: - Onboarding design language (mid-century cartoon, cream hero surface)
//
// Onboarding is a fixed-light *branded* surface — it always renders on warm cream
// with ink-brown text regardless of system appearance, so the mascot's cartoon
// world stays intact. These constants are intentionally scoped here rather than in
// the global FlynnColor ramp (which is cool-toned + dark-mode aware).

enum OB {
    static let cream = Color(hex: "#F4E6CE")
    static let card = Color(hex: "#FFFBF4")
    static let ink = Color(hex: "#2C2018")      // text + the signature outline
    static let inkSoft = Color(hex: "#5A4A3C")  // secondary text
    static let inkFaint = Color(hex: "#8C7B6A") // captions / placeholders
    static let orange = Color(hex: "#FB5B1E")   // brand / primary CTA
    static let mustard = Color(hex: "#E0A436")
    static let teal = Color(hex: "#3C8A86")
    static let terra = Color(hex: "#C5532B")
    static let olive = Color(hex: "#7E8B4F")

    static let outline: CGFloat = 3
}

// MARK: - Shapes

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
        Circle().fill(color).overlay(Circle().stroke(OB.ink, lineWidth: OB.outline))
    }
}

private struct OutlinedWedge: View {
    var color: Color
    var start: Double
    var end: Double
    var body: some View {
        Wedge(start: .degrees(start), end: .degrees(end))
            .fill(color)
            .overlay(Wedge(start: .degrees(start), end: .degrees(end)).stroke(OB.ink, lineWidth: OB.outline))
    }
}

// MARK: - Backdrop

/// Cream field scattered with mid-century geometric motifs. `variant` rotates the
/// arrangement per step so consecutive screens feel related but not identical.
/// Shapes anchor to corners/edges so the centre stays clear for content.
struct MidCenturyBackdrop: View {
    var variant: Int

    var body: some View {
        GeometryReader { geo in
            let w = geo.size.width, h = geo.size.height
            ZStack {
                OB.cream.ignoresSafeArea()
                Group {
                    // Shapes hug the top-right corner (mostly off-screen) and the
                    // bottom half only — the top-left text zone stays clear cream so
                    // headlines never sit on a dark shape.
                    switch variant % 4 {
                    case 0:
                        OutlinedCircle(color: OB.teal).frame(width: w * 0.34).position(x: w * 1.04, y: h * 0.02)
                        OutlinedWedge(color: OB.olive, start: 180, end: 320)
                            .frame(width: w * 0.5, height: w * 0.5).position(x: 0, y: h * 1.02)
                        OutlinedCircle(color: OB.mustard).frame(width: w * 0.34).position(x: w, y: h * 0.97)
                        OutlinedCircle(color: OB.orange).frame(width: w * 0.09).position(x: w * 0.84, y: h * 0.74)
                    case 1:
                        OutlinedCircle(color: OB.mustard).frame(width: w * 0.3).position(x: w * 1.05, y: 0)
                        OutlinedCircle(color: OB.terra).frame(width: w * 0.4).position(x: 0, y: h * 1.02)
                        OutlinedWedge(color: OB.teal, start: 200, end: 340)
                            .frame(width: w * 0.48, height: w * 0.48).position(x: w, y: h * 0.93)
                        OutlinedCircle(color: OB.orange).frame(width: w * 0.08).position(x: w * 0.14, y: h * 0.74)
                    case 2:
                        OutlinedCircle(color: OB.terra).frame(width: w * 0.32).position(x: w * 1.04, y: h * 0.03)
                        OutlinedWedge(color: OB.teal, start: 30, end: 170)
                            .frame(width: w * 0.48, height: w * 0.48).position(x: 0, y: h)
                        OutlinedCircle(color: OB.mustard).frame(width: w * 0.3).position(x: w, y: h * 1.0)
                        Starburst(color: OB.terra).frame(width: w * 0.13).position(x: w * 0.22, y: h * 0.88)
                    default:
                        OutlinedCircle(color: OB.olive).frame(width: w * 0.32).position(x: w * 1.04, y: h * 0.02)
                        OutlinedCircle(color: OB.mustard).frame(width: w * 0.36).position(x: 0, y: h)
                        OutlinedCircle(color: OB.terra).frame(width: w * 0.3).position(x: w, y: h * 0.96)
                        OutlinedCircle(color: OB.teal).frame(width: w * 0.08).position(x: w * 0.86, y: h * 0.72)
                    }
                }
                .clipped()
            }
        }
        .ignoresSafeArea()
    }
}

// MARK: - Mascot hero (mascot on an outlined cream/white disc, with entrance)

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

// MARK: - Buttons

/// The chunky cartoon CTA — orange fill, thick ink outline, big radius.
struct RetroButton: View {
    var title: String
    var variant: Variant = .primary
    var isLoading: Bool = false
    var action: () -> Void

    enum Variant { case primary, secondary }

    @State private var pressed = false

    var body: some View {
        Button(action: action) {
            ZStack {
                if isLoading {
                    ProgressView().tint(variant == .primary ? OB.card : OB.ink)
                } else {
                    Text(title)
                        .font(.custom(FlynnFontName.spaceGroteskBold, size: 18))
                        .foregroundColor(variant == .primary ? OB.card : OB.ink)
                }
            }
            .frame(maxWidth: .infinity).frame(height: 58)
            .background(
                RoundedRectangle(cornerRadius: 30, style: .continuous)
                    .fill(variant == .primary ? OB.orange : OB.card)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 30, style: .continuous)
                    .stroke(OB.ink, lineWidth: OB.outline)
            )
            .scaleEffect(pressed ? 0.97 : 1)
        }
        .buttonStyle(.plain)
        .disabled(isLoading)
        .simultaneousGesture(DragGesture(minimumDistance: 0)
            .onChanged { _ in withAnimation(.easeOut(duration: 0.12)) { pressed = true } }
            .onEnded { _ in withAnimation(.easeOut(duration: 0.12)) { pressed = false } })
    }
}

/// A quiet text button (e.g. "Skip for now").
struct RetroTextButton: View {
    var title: String
    var action: () -> Void
    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.custom(FlynnFontName.interMedium, size: 14))
                .foregroundColor(OB.inkFaint)
                .frame(maxWidth: .infinity, minHeight: 44)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Inputs

/// A cream-world text field — outlined card, ink text, universal styling.
struct RetroField: View {
    var label: String?
    @Binding var text: String
    var placeholder: String = ""
    var axis: Axis = .horizontal
    var textContentType: UITextContentType? = nil
    var autocapitalization: TextInputAutocapitalization = .sentences
    @FocusState private var focused: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            if let label {
                Text(label)
                    .font(.custom(FlynnFontName.interMedium, size: 13))
                    .foregroundColor(OB.inkSoft)
            }
            Group {
                if axis == .vertical {
                    TextField(placeholder, text: $text, axis: .vertical).lineLimit(3...6)
                } else {
                    TextField(placeholder, text: $text)
                }
            }
            .font(.custom(FlynnFontName.interRegular, size: 16))
            .foregroundColor(OB.ink)
            .tint(OB.orange)
            .textInputAutocapitalization(autocapitalization)
            .textContentType(textContentType)
            .focused($focused)
            .padding(.horizontal, 16).padding(.vertical, 15)
            .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(OB.card))
            .overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .stroke(focused ? OB.orange : OB.ink, lineWidth: focused ? OB.outline + 1 : OB.outline)
            )
        }
    }
}

// MARK: - Headline block

struct OnboardingHeadline: View {
    var eyebrow: String?
    var title: String
    var accentTitle: String?
    var subtitle: String?
    var alignment: HorizontalAlignment = .leading

    var body: some View {
        VStack(alignment: alignment, spacing: 10) {
            if let eyebrow {
                Text(eyebrow.uppercased())
                    .font(.custom(FlynnFontName.spaceGroteskBold, size: 12))
                    .tracking(1.5)
                    .foregroundColor(OB.orange)
            }
            VStack(alignment: alignment, spacing: 0) {
                Text(title)
                    .font(.custom(FlynnFontName.spaceGroteskBold, size: 34))
                    .foregroundColor(OB.ink)
                if let accentTitle {
                    Text(accentTitle)
                        .font(.custom(FlynnFontName.spaceGroteskBold, size: 34))
                        .foregroundColor(OB.orange)
                }
            }
            .fixedSize(horizontal: false, vertical: true)
            if let subtitle {
                Text(subtitle)
                    .font(.custom(FlynnFontName.interRegular, size: 16))
                    .foregroundColor(OB.inkSoft)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .frame(maxWidth: .infinity, alignment: alignment == .center ? .center : .leading)
        .multilineTextAlignment(alignment == .center ? .center : .leading)
    }
}

// MARK: - Scaffold

/// Wraps a step in the cream backdrop with consistent padding and a pinned CTA
/// zone. Scrolls when content is tall; keeps the footer reachable.
struct OnboardingScaffold<Content: View, Footer: View>: View {
    var variant: Int
    @ViewBuilder var content: () -> Content
    @ViewBuilder var footer: () -> Footer

    var body: some View {
        ZStack {
            MidCenturyBackdrop(variant: variant)
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    content()
                }
                .padding(.horizontal, 24)
                .padding(.top, 12)
                .padding(.bottom, 24)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            // Interactive drag-to-dismiss replaces the Done button; the footer
            // pins above the keyboard via safeAreaInset so focused fields scroll
            // into the right place instead of landing behind the keyboard.
            .scrollDismissesKeyboard(.interactively)
            .safeAreaInset(edge: .bottom, spacing: 0) {
                VStack(spacing: 8) { footer() }
                    .padding(.horizontal, 24)
                    .padding(.top, 10)
                    .padding(.bottom, 12)
                    .background(
                        LinearGradient(
                            colors: [OB.cream.opacity(0), OB.cream, OB.cream],
                            startPoint: .top, endPoint: .bottom
                        )
                        .ignoresSafeArea(edges: .bottom)
                    )
            }
        }
        .environment(\.colorScheme, .light)
    }
}

// MARK: - Keyboard "Done" toolbar (app-wide fix for missing dismiss affordance)

extension View {
    /// Adds a "Done" button above the keyboard that resigns the first responder.
    /// Works without a bound FocusState, so it can be applied once high in a screen.
    func keyboardDoneToolbar() -> some View {
        toolbar {
            ToolbarItemGroup(placement: .keyboard) {
                Spacer()
                Button("Done") {
                    UIApplication.shared.sendAction(
                        #selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
                }
                .font(.custom(FlynnFontName.spaceGroteskBold, size: 16))
                .tint(OB.orange)
            }
        }
    }
}
