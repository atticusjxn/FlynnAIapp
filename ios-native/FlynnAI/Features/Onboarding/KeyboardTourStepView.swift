import SwiftUI

/// Final keyboard-setup step: a short tour of the two ways the Flynn keyboard is
/// used, shown once Full Access is on.
///
/// Replaces the old CaptureSetupStepView, which was entirely a choice between
/// screenshot capture and copy-and-paste. Both are gone: an iOS keyboard extension
/// can only read the text field the cursor is in, so Flynn now works from what the
/// operator types plus the real data in their account, and never touches the
/// clipboard or the screen.
struct KeyboardTourStepView: View {
    let onFinish: () -> Void

    var body: some View {
        OnboardingScaffold(variant: 3) {
            OnboardingHeadline(
                eyebrow: "Last thing",
                title: "Two ways to use",
                accentTitle: "the keyboard",
                subtitle: "Switch to the Flynn keyboard in any app - HiPages, WhatsApp, Messages - and it brings your real numbers with it."
            )

            tourCard(
                icon: "bolt.fill",
                title: "Tap a chip",
                description: "Your next free slots, a pay link for an open invoice, or your rate. One tap and it's in the message, no typing."
            )

            tourCard(
                icon: "sparkles",
                title: "Or type rough and tap Polish",
                description: "Type \"quote 450 deck, free thurs\" on your normal keyboard, switch to Flynn, tap Polish. You'll get a few proper versions to pick from, with your real prices and times filled in."
            )

            Text("Flynn never sends anything. It writes it, you hit send.")
                .font(.custom(FlynnFontName.interMedium, size: 14, relativeTo: .subheadline))
                .foregroundColor(OB.inkFaint)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 2)
        } footer: {
            RetroButton(title: "Done, finish setup", action: onFinish)
        }
    }

    private func tourCard(icon: String, title: String, description: String) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 10) {
                Image(systemName: icon)
                    .font(.system(size: 20, weight: .semibold))
                    .foregroundColor(OB.orange)
                Text(title)
                    .font(.custom(FlynnFontName.spaceGroteskBold, size: 20, relativeTo: .title3))
                    .foregroundColor(OB.ink)
                Spacer(minLength: 6)
            }
            Text(description)
                .font(.custom(FlynnFontName.interRegular, size: 15, relativeTo: .body))
                .foregroundColor(OB.inkSoft)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: FlynnRadii.xl, style: .continuous).fill(OB.card))
        .overlay(RoundedRectangle(cornerRadius: FlynnRadii.xl, style: .continuous).stroke(OB.ink, lineWidth: OB.outline))
    }
}
