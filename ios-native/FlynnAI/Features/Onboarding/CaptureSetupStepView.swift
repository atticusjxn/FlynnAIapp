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
                title: "One tap and",
                accentTitle: "you're set"
            )

            gestureCard

            if FlynnConfig.captureShortcutURL != nil {
                RetroButton(title: "Add the Flynn shortcut", action: addShortcut)
            } else {
                manualShortcutSteps
            }

            Text(gesturePlan.assign)
                .font(.custom(FlynnFontName.interRegular, size: 14))
                .foregroundColor(OB.inkFaint)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 2)
        } footer: {
            RetroButton(title: "Done — finish setup", action: onFinish)
            RetroTextButton(title: "Back", action: { withAnimation { mode = .choose } })
        }
    }

    /// The recommended gesture, chosen by hardware: Action Button when present,
    /// otherwise Back Tap. Drives the single card, button, and the one-line assign hint.
    private struct GesturePlan {
        let icon: String
        let title: String
        let pitch: String
        let assign: String
    }

    private var gesturePlan: GesturePlan {
        if DeviceCapability.hasActionButton {
            return GesturePlan(
                icon: "button.programmable",
                title: "Use your Action Button",
                pitch: "One press over any message — Flynn reads the screen and your replies are waiting in the keyboard. Nothing is saved to your camera roll.",
                assign: "Then set it once: Settings → Action Button → “\(FlynnConfig.captureIntentName)”."
            )
        } else {
            return GesturePlan(
                icon: "hand.tap",
                title: "Triple-tap the back",
                pitch: "Triple-tap the back of your phone over any message — Flynn reads the screen and your replies are waiting in the keyboard. Nothing is saved to your camera roll.",
                assign: "Then set it once: Settings → Accessibility → Touch → Back Tap → Triple Tap → “\(FlynnConfig.captureIntentName)”."
            )
        }
    }

    private var gestureCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 10) {
                Image(systemName: gesturePlan.icon)
                    .font(.system(size: 22, weight: .semibold))
                    .foregroundColor(OB.orange)
                Text(gesturePlan.title)
                    .font(.custom(FlynnFontName.spaceGroteskBold, size: 20))
                    .foregroundColor(OB.ink)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Text(gesturePlan.pitch)
                .font(.custom(FlynnFontName.interRegular, size: 15))
                .foregroundColor(OB.inkSoft)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 20, style: .continuous).fill(OB.card))
        .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).stroke(OB.ink, lineWidth: OB.outline))
    }

    private var manualShortcutSteps: some View {
        VStack(alignment: .leading, spacing: 6) {
            stepText("Open the Shortcuts app → New Shortcut, then:")
            bullet("Add the “Take Screenshot” action.")
            bullet("Add the “\(FlynnConfig.captureIntentName)” action and pass the screenshot into it.")
        }
    }

    // MARK: Small building blocks

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
}
