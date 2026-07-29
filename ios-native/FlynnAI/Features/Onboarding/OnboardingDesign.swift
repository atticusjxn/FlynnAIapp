import SwiftUI
import UIKit

// MARK: - Onboarding design shims
//
// Onboarding used to carry its own complete design system — its own palette, its
// own orange, its own outline weight, its own button and field. That system was
// the *right* one; it was just scoped to five files while the rest of the app ran
// something else.
//
// It has been promoted to the global theme (`FlynnColor`, `FlynnStroke`,
// `FlynnRadii`, `FlynnButton`, `FlynnTextField`, `MidCenturyBackdrop`). What's
// left here is a thin compatibility layer so onboarding's screens keep compiling
// while they migrate — it can no longer drift from the global tokens, because
// every member below forwards to them.
//
// Prefer the global tokens in new code; these will be removed once the five
// onboarding screens are migrated.

enum OB {
    static let cream = FlynnColor.background
    static let card = FlynnColor.backgroundSecondary
    static let ink = FlynnColor.textPrimary
    static let inkSoft = FlynnColor.textSecondary
    static let inkFaint = FlynnColor.textTertiary
    static let orange = FlynnColor.primary
    static let mustard = FlynnColor.mustard
    static let teal = FlynnColor.teal
    static let terra = FlynnColor.terra
    static let olive = FlynnColor.olive

    static let outline: CGFloat = FlynnStroke.outline
}

// MARK: - Buttons

/// Compatibility shim. `FlynnButton` now carries this exact geometry (pill
/// radius, 58pt height, 3pt ink outline, sentence-case Space Grotesk).
struct RetroButton: View {
    var title: String
    var variant: Variant = .primary
    var isLoading: Bool = false
    var action: () -> Void

    enum Variant { case primary, secondary }

    var body: some View {
        FlynnButton(
            title: title,
            action: action,
            variant: variant == .primary ? .primary : .secondary,
            size: .medium,
            fullWidth: true,
            isLoading: isLoading
        )
    }
}

/// A quiet text button (e.g. "Skip for now").
struct RetroTextButton: View {
    var title: String
    var action: () -> Void
    var body: some View {
        Button(action: action) {
            Text(title)
                .flynnType(FlynnTypography.label)
                .foregroundColor(FlynnColor.textTertiary)
                .frame(maxWidth: .infinity, minHeight: 44)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Inputs

/// Compatibility shim over `FlynnTextField`, which now matches this styling.
struct RetroField: View {
    var label: String?
    @Binding var text: String
    var placeholder: String = ""
    var axis: Axis = .horizontal
    var textContentType: UITextContentType? = nil
    var autocapitalization: TextInputAutocapitalization = .sentences

    var body: some View {
        FlynnTextField(
            label: label ?? "",
            text: $text,
            placeholder: placeholder,
            textContentType: textContentType,
            autocapitalization: autocapitalization
        )
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
                Text(eyebrow)
                    .flynnType(FlynnTypography.overline)
                    .foregroundColor(FlynnColor.primary)
            }
            VStack(alignment: alignment, spacing: 0) {
                Text(title)
                    .flynnType(FlynnTypography.displayMedium)
                    .foregroundColor(FlynnColor.textPrimary)
                if let accentTitle {
                    Text(accentTitle)
                        .flynnType(FlynnTypography.displayMedium)
                        .foregroundColor(FlynnColor.primary)
                }
            }
            .fixedSize(horizontal: false, vertical: true)
            if let subtitle {
                Text(subtitle)
                    .flynnType(FlynnTypography.bodyLarge)
                    .foregroundColor(FlynnColor.textSecondary)
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
                .padding(.horizontal, FlynnSpacing.lg)
                .padding(.top, 12)
                .padding(.bottom, FlynnSpacing.lg)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            // Interactive drag-to-dismiss replaces the Done button; the footer
            // pins above the keyboard via safeAreaInset so focused fields scroll
            // into the right place instead of landing behind the keyboard.
            .scrollDismissesKeyboard(.interactively)
            .safeAreaInset(edge: .bottom, spacing: 0) {
                VStack(spacing: 8) { footer() }
                    .padding(.horizontal, FlynnSpacing.lg)
                    .padding(.top, 10)
                    .padding(.bottom, 12)
                    .background(
                        LinearGradient(
                            colors: [
                                FlynnColor.background.opacity(0),
                                FlynnColor.background,
                                FlynnColor.background
                            ],
                            startPoint: .top, endPoint: .bottom
                        )
                        .ignoresSafeArea(edges: .bottom)
                    )
            }
        }
        // Onboarding still pins to light so the mascot's cartoon world stays
        // intact. Now that the global theme is warm in both modes this force can
        // be dropped — deferred so the palette change lands on its own first.
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
                .tint(FlynnColor.primary)
            }
        }
    }
}
