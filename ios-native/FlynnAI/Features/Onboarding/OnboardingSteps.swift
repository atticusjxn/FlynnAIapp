import SwiftUI
import UIKit

// Brain setup now happens entirely over iMessage (services/flynnSMS.js), so the old
// onboarding wizard is gone. The only step that survives is the one-off keyboard
// install, relocated into KeyboardSetupFlow (reachable from Home + Settings) — it's a
// power-user add-on, not an entry gate. This file keeps that step on the shared cream
// surface defined in OnboardingDesign.swift.

// MARK: - Install keyboard (one-off ask, surfaced after the user is already in)

struct InstallKeyboardStepView: View {
    let onContinue: () -> Void

    var body: some View {
        OnboardingScaffold(variant: 2) {
            HStack(alignment: .top) {
                OnboardingHeadline(
                    eyebrow: "Optional add-on",
                    title: "Add the",
                    accentTitle: "Flynn keyboard",
                    subtitle: "Draft replies right inside Messages. One-time setup, copy a message, switch to the Flynn keyboard, tap a reply."
                )
                Mascot(.phone, size: 88).padding(.top, 18)
            }

            instructionRow("1", "Open Settings → General → Keyboard → Keyboards.")
            instructionRow("2", "Tap “Add New Keyboard…” and choose Flynn.")
            instructionRow("3", "Tap Flynn and turn on “Allow Full Access” so it can draft from your copied message.")
        } footer: {
            RetroButton(title: "Open Settings", action: openSettings)
            RetroButton(title: "I've added it, next", variant: .secondary, action: onContinue)
        }
    }

    private func instructionRow(_ number: String, _ text: String) -> some View {
        HStack(alignment: .top, spacing: 14) {
            Text(number)
                .font(.custom(FlynnFontName.spaceGroteskBold, size: 16))
                .foregroundColor(OB.card)
                .frame(width: 30, height: 30)
                .background(Circle().fill(OB.orange))
                .overlay(Circle().stroke(OB.ink, lineWidth: OB.outline))
            Text(text)
                .font(.custom(FlynnFontName.interRegular, size: 15))
                .foregroundColor(OB.ink)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func openSettings() {
        if let url = URL(string: UIApplication.openSettingsURLString) { UIApplication.shared.open(url) }
    }
}
