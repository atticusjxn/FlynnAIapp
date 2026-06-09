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
                subtitle: "Both work great and you can use either anytime. We recommend the screenshot way, it's one tap and never touches your clipboard."
            )

            captureCard(
                badge: "RECOMMENDED",
                icon: "text.viewfinder",
                title: "Screenshot capture",
                description: "Tap your gesture over any message, Flynn reads the screen and your replies are waiting in the keyboard. Nothing is saved to your camera roll.",
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
                title: "Two quick",
                accentTitle: "steps"
            )

            // Step 1 — add the shortcut.
            sectionTitle("1  Add the Flynn shortcut")
            if FlynnConfig.captureShortcutURL != nil {
                stepText("Adds a one-tap \"\(FlynnConfig.captureIntentName)\" shortcut that screenshots your screen and gets replies ready, without saving to your camera roll.")
                RetroButton(title: "Add the Flynn shortcut", action: addShortcut)
            } else {
                manualShortcutSteps
            }

            // Step 2 — bind it to a gesture. Without this nothing runs the
            // shortcut. iOS gives third-party apps no way to deep-link into the
            // Action Button / Back Tap panes — the private `App-Prefs:`/`prefs:`
            // schemes only navigate from inside Shortcuts itself; from here they
            // just dump the user on Flynn's own Settings page. So we spell out the
            // exact path instead of shipping a button that lands in the wrong place.
            sectionTitle("2  Set up your gesture")
            gestureCard

            Text("Tip: press your gesture while looking at a real message, not inside the Shortcuts app, which would just screenshot Shortcuts itself.")
                .font(.custom(FlynnFontName.interRegular, size: 13))
                .foregroundColor(OB.inkFaint)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 2)
        } footer: {
            RetroButton(title: "Done, finish setup", action: onFinish)
            RetroTextButton(title: "Back", action: { withAnimation { mode = .choose } })
        }
    }

    private struct GestureOption {
        let icon: String
        let title: String
        let badge: String?
        let assign: String
    }

    private var gestureOptions: [GestureOption] {
        var options: [GestureOption] = []
        if DeviceCapability.hasActionButton {
            options.append(GestureOption(
                icon: "button.programmable",
                title: "Action Button",
                badge: "RECOMMENDED",
                assign: "Settings \u{2192} Action Button \u{2192} swipe to Shortcut \u{2192} \"\(FlynnConfig.captureIntentName)\""
            ))
        }
        options.append(GestureOption(
            icon: "hand.tap",
            title: "Back Tap (triple-tap)",
            badge: DeviceCapability.hasActionButton ? nil : "RECOMMENDED",
            assign: "Settings \u{2192} Accessibility \u{2192} Touch \u{2192} Back Tap \u{2192} Triple Tap \u{2192} \"\(FlynnConfig.captureIntentName)\""
        ))
        return options
    }

    private var gestureCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Pick one and set it up:")
                .font(.custom(FlynnFontName.interRegular, size: 15))
                .foregroundColor(OB.inkSoft)

            ForEach(Array(gestureOptions.enumerated()), id: \.offset) { _, option in
                HStack(alignment: .top, spacing: 12) {
                    Image(systemName: option.icon)
                        .font(.system(size: 20, weight: .semibold))
                        .foregroundColor(OB.orange)
                        .frame(width: 28)
                    VStack(alignment: .leading, spacing: 4) {
                        HStack(spacing: 8) {
                            Text(option.title)
                                .font(.custom(FlynnFontName.spaceGroteskBold, size: 16))
                                .foregroundColor(OB.ink)
                            if let badge = option.badge {
                                Text(badge)
                                    .font(.custom(FlynnFontName.spaceGroteskBold, size: 9))
                                    .tracking(1)
                                    .foregroundColor(OB.card)
                                    .padding(.horizontal, 6).padding(.vertical, 3)
                                    .background(Capsule().fill(OB.orange))
                            }
                        }
                        Text(option.assign)
                            .font(.custom(FlynnFontName.interMedium, size: 13))
                            .foregroundColor(OB.inkSoft)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
            }
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 20, style: .continuous).fill(OB.card))
        .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).stroke(OB.ink, lineWidth: OB.outline))
    }

    private var manualShortcutSteps: some View {
        VStack(alignment: .leading, spacing: 6) {
            stepText("Open the Shortcuts app → New Shortcut, then:")
            bullet("Add the \"Take Screenshot\" action.")
            bullet("Add the \"\(FlynnConfig.captureIntentName)\" action and pass the screenshot into it.")
        }
    }

    // MARK: Small building blocks

    private func sectionTitle(_ s: String) -> some View {
        Text(s)
            .font(.custom(FlynnFontName.spaceGroteskBold, size: 17))
            .foregroundColor(OB.ink)
            .frame(maxWidth: .infinity, alignment: .leading)
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
}
