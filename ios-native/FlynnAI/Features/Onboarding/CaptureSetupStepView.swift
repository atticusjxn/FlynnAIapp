import SwiftUI
import UIKit

/// Final onboarding step. Presents the two capture options — screenshot capture
/// (recommended) and copy → keyboard (the universal fallback) — and, when the user
/// picks screenshot, walks them through adding the shortcut and binding a gesture
/// (Action Button or Back Tap, chosen by device).
struct CaptureSetupStepView: View {
    let onFinish: () -> Void

    private enum Mode { case choose, screenshot }
    @State private var mode: Mode = .choose
    @State private var showBackTapAlt = false

    var body: some View {
        switch mode {
        case .choose:     chooseView
        case .screenshot: screenshotView
        }
    }

    // MARK: Choose

    private var chooseView: some View {
        OnboardingScaffold(variant: 3) {
            OnboardingHeadline(
                eyebrow: "One last thing",
                title: "Pick how you",
                accentTitle: "capture messages",
                subtitle: "Both work great and you can use either anytime. We recommend the screenshot way — it's one tap and never touches your clipboard."
            )

            captureCard(
                badge: "RECOMMENDED",
                icon: "text.viewfinder",
                title: "Screenshot capture",
                description: "Tap your gesture over any message — Flynn reads the screen and your replies are waiting in the keyboard. Nothing is saved to your camera roll.",
                buttonTitle: "Set up screenshot capture",
                variant: .primary
            ) { withAnimation { mode = .screenshot } }

            captureCard(
                badge: nil,
                icon: "doc.on.clipboard",
                title: "Copy & paste",
                description: "Works everywhere. Copy a message, open the Flynn keyboard, and tap a reply to insert it.",
                buttonTitle: "Use copy & paste",
                variant: .secondary
            ) { onFinish() }
        } footer: {
            RetroTextButton(title: "I'll set this up later", action: onFinish)
        }
    }

    private func captureCard(
        badge: String?,
        icon: String,
        title: String,
        description: String,
        buttonTitle: String,
        variant: RetroButton.Variant,
        action: @escaping () -> Void
    ) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 10) {
                Image(systemName: icon)
                    .font(.system(size: 20, weight: .semibold))
                    .foregroundColor(OB.orange)
                Text(title)
                    .font(.custom(FlynnFontName.spaceGroteskBold, size: 20))
                    .foregroundColor(OB.ink)
                Spacer(minLength: 6)
                if let badge {
                    Text(badge)
                        .font(.custom(FlynnFontName.spaceGroteskBold, size: 10))
                        .tracking(1)
                        .foregroundColor(OB.card)
                        .padding(.horizontal, 8).padding(.vertical, 4)
                        .background(Capsule().fill(OB.orange))
                }
            }
            Text(description)
                .font(.custom(FlynnFontName.interRegular, size: 15))
                .foregroundColor(OB.inkSoft)
                .fixedSize(horizontal: false, vertical: true)
            RetroButton(title: buttonTitle, variant: variant, action: action)
                .padding(.top, 2)
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 20, style: .continuous).fill(OB.card))
        .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).stroke(OB.ink, lineWidth: OB.outline))
    }

    // MARK: Screenshot setup

    private var screenshotView: some View {
        OnboardingScaffold(variant: 0) {
            OnboardingHeadline(
                eyebrow: "Screenshot capture",
                title: "Two taps to",
                accentTitle: "set it up"
            )

            sectionTitle("1  Add the Flynn shortcut")
            stepText("Adds a one-tap “\(FlynnConfig.captureIntentName)” shortcut that screenshots your screen and gets replies ready — without saving to your camera roll.")
            if FlynnConfig.captureShortcutURL != nil {
                RetroButton(title: "Add the Flynn shortcut", action: addShortcut)
            } else {
                manualShortcutSteps
            }

            sectionTitle("2  Choose your gesture")
            gestureSection

            RetroButton(title: "Open Settings", variant: .secondary, action: openSettings)
                .padding(.top, 4)
        } footer: {
            RetroButton(title: "Done — finish setup", action: onFinish)
            RetroTextButton(title: "Back", action: { withAnimation { mode = .choose } })
        }
    }

    @ViewBuilder private var gestureSection: some View {
        if DeviceCapability.hasActionButton {
            stepText("Open Settings → Action Button, swipe to Shortcut, and choose “\(FlynnConfig.captureIntentName)”. A single press now triggers Flynn.")
            Text("Heads up: this replaces your Action Button's current action (like Camera).")
                .font(.custom(FlynnFontName.interRegular, size: 13))
                .foregroundColor(OB.inkFaint)
                .fixedSize(horizontal: false, vertical: true)
            Button { withAnimation { showBackTapAlt.toggle() } } label: {
                Text(showBackTapAlt ? "Hide Back Tap option" : "Want to keep your Action Button? Use Back Tap →")
                    .font(.custom(FlynnFontName.interMedium, size: 14))
                    .foregroundColor(OB.orange)
            }
            .buttonStyle(.plain)
            if showBackTapAlt {
                stepText(backTapInstruction)
            }
        } else {
            stepText(backTapInstruction)
        }
    }

    private var backTapInstruction: String {
        "Open Settings → Accessibility → Touch → Back Tap → Triple Tap, then choose “\(FlynnConfig.captureIntentName)”. Triple-tap the back of your phone to trigger Flynn."
    }

    private var manualShortcutSteps: some View {
        VStack(alignment: .leading, spacing: 6) {
            stepText("Open the Shortcuts app → New Shortcut, then:")
            bullet("Add the “Take Screenshot” action.")
            bullet("Add the “\(FlynnConfig.captureIntentName)” action and pass the screenshot into it.")
        }
    }

    // MARK: Small building blocks

    private func sectionTitle(_ s: String) -> some View {
        Text(s)
            .font(.custom(FlynnFontName.spaceGroteskBold, size: 17))
            .foregroundColor(OB.ink)
            .padding(.top, 6)
    }

    private func stepText(_ s: String) -> some View {
        Text(s)
            .font(.custom(FlynnFontName.interRegular, size: 15))
            .foregroundColor(OB.inkSoft)
            .fixedSize(horizontal: false, vertical: true)
    }

    private func bullet(_ s: String) -> some View {
        HStack(alignment: .top, spacing: 8) {
            Text("•").foregroundColor(OB.orange)
            Text(s)
                .font(.custom(FlynnFontName.interRegular, size: 15))
                .foregroundColor(OB.inkSoft)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    // MARK: Actions

    private func addShortcut() {
        if let url = FlynnConfig.captureShortcutURL { UIApplication.shared.open(url) }
    }

    private func openSettings() {
        if let url = URL(string: UIApplication.openSettingsURLString) { UIApplication.shared.open(url) }
    }
}
