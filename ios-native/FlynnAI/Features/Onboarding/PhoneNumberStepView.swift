import SwiftUI

/// Step 6: Forward your calls. If the demo account already has a provisioned
/// phone (`users.has_provisioned_phone = true`), show a pre-verified badge
/// and enable the CTA immediately. Otherwise show carrier instructions.
struct PhoneNumberStepView: View {
    let store: OnboardingStore
    let onFinish: () -> Void

    @Environment(FlashStore.self) private var flash

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: FlynnSpacing.md) {
                stepHeader(
                    eyebrow: "Step 6 of 6",
                    title: "Forward your calls to Flynn",
                    subtitle: "Set up call forwarding on your regular mobile so Flynn answers when you're busy."
                )

                if store.hasProvisionedPhone {
                    preVerifiedCard
                } else {
                    ForwardingSetupView()
                }

                FlynnButton(
                    title: store.hasProvisionedPhone ? "I'm ready — go live" : "I've set up forwarding",
                    action: { Task { await store.markForwardingVerified(); onFinish() } },
                    fullWidth: true
                )
                .safeAreaInset(edge: .bottom) { Color.clear.frame(height: 0) }
            }
            .padding(FlynnSpacing.lg)
        }
    }

    private var preVerifiedCard: some View {
        HStack(spacing: FlynnSpacing.sm) {
            Image(systemName: "checkmark.circle.fill")
                .foregroundColor(FlynnColor.success)
                .font(.title2)
            VStack(alignment: .leading, spacing: FlynnSpacing.xxs) {
                Text("Already connected")
                    .flynnType(FlynnTypography.bodyMedium)
                    .foregroundColor(FlynnColor.textPrimary)
                Text("Your Flynn number is active and ready to handle calls.")
                    .flynnType(FlynnTypography.caption)
                    .foregroundColor(FlynnColor.textSecondary)
            }
            Spacer()
        }
        .padding(FlynnSpacing.md)
        .background(
            RoundedRectangle(cornerRadius: FlynnRadii.md, style: .continuous)
                .fill(FlynnColor.successLight)
        )
        .brutalistBorder(cornerRadius: FlynnRadii.md)
    }
}

@MainActor
@ViewBuilder
private func stepHeader(eyebrow: String, title: String, subtitle: String) -> some View {
    VStack(alignment: .leading, spacing: FlynnSpacing.xs) {
        Text(eyebrow)
            .flynnType(FlynnTypography.overline)
            .foregroundColor(FlynnColor.textSecondary)
        Text(title)
            .flynnType(FlynnTypography.h2)
            .foregroundColor(FlynnColor.textPrimary)
        Text(subtitle)
            .flynnType(FlynnTypography.bodyMedium)
            .foregroundColor(FlynnColor.textSecondary)
            .fixedSize(horizontal: false, vertical: true)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
}
