import SwiftUI
import StoreKit

/// Step 5: Paywall shown after the live voice demo, so users have already
/// experienced real value before being asked to pay.
struct PaywallStepView: View {
    let onSubscribe: () -> Void
    let onSkip: () -> Void

    @Environment(FlashStore.self) private var flash
    @Environment(SubscriptionStore.self) private var subStore
    @State private var selectedProductId: String?
    @State private var isPurchasing = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: FlynnSpacing.md) {
                stepHeader(
                    eyebrow: "Step 5 of 6",
                    title: "Your agent is ready — unlock it",
                    subtitle: "14-day free trial. Cancel any time. No charge today."
                )

                switch subStore.loadState {
                case .idle, .loading:
                    VStack(spacing: FlynnSpacing.sm) {
                        ProgressView().tint(FlynnColor.primary)
                        Text("Loading plans…")
                            .flynnType(FlynnTypography.caption)
                            .foregroundColor(FlynnColor.textSecondary)
                    }
                    .frame(maxWidth: .infinity, minHeight: 200)
                case .error:
                    loadFailedState
                case .loaded:
                    if subStore.products.isEmpty {
                        loadFailedState
                    } else {
                        planCards
                        ctaButton
                    }
                }

                Button("Skip for now — use SMS links (free)") { onSkip() }
                    .flynnType(FlynnTypography.caption)
                    .foregroundColor(FlynnColor.textSecondary)
                    .frame(maxWidth: .infinity, minHeight: 44)
                    .contentShape(Rectangle())
                    .multilineTextAlignment(.center)
            }
            .padding(FlynnSpacing.lg)
        }
        .task { await subStore.bootstrap() }
    }

    private var planCards: some View {
        VStack(spacing: FlynnSpacing.sm) {
            ForEach(subStore.products) { item in
                let isSelected = selectedProductId == item.product.id
                Button(action: { selectedProductId = item.product.id }) {
                    HStack {
                        VStack(alignment: .leading, spacing: FlynnSpacing.xxs) {
                            Text(item.plan.displayName)
                                .flynnType(FlynnTypography.bodyMedium)
                                .foregroundColor(FlynnColor.textPrimary)
                            Text("\(item.plan.aiMinutesMonthly) min AI / month")
                                .flynnType(FlynnTypography.caption)
                                .foregroundColor(FlynnColor.textSecondary)
                        }
                        Spacer()
                        Text(item.displayPrice + "/mo")
                            .flynnType(FlynnTypography.bodyMedium)
                            .foregroundColor(FlynnColor.textPrimary)
                        Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                            .foregroundColor(isSelected ? FlynnColor.primary : FlynnColor.gray300)
                    }
                    .padding(FlynnSpacing.md)
                    .background(
                        RoundedRectangle(cornerRadius: FlynnRadii.md, style: .continuous)
                            .fill(isSelected ? FlynnColor.primaryLight : FlynnColor.backgroundSecondary)
                    )
                    .brutalistBorder(cornerRadius: FlynnRadii.md)
                }
                .buttonStyle(.plain)
            }
        }
    }

    private var loadFailedState: some View {
        VStack(spacing: FlynnSpacing.sm) {
            Image(systemName: "wifi.exclamationmark")
                .font(.system(size: 32))
                .foregroundColor(FlynnColor.textTertiary)
            Text("Couldn't reach the App Store")
                .flynnType(FlynnTypography.h4)
                .foregroundColor(FlynnColor.textPrimary)
            Text("Check your connection and try again.")
                .flynnType(FlynnTypography.caption)
                .foregroundColor(FlynnColor.textSecondary)
                .multilineTextAlignment(.center)
            FlynnButton(
                title: "Retry",
                action: { Task { await subStore.bootstrap() } }
            )
        }
        .frame(maxWidth: .infinity, minHeight: 220)
    }

    private var ctaButton: some View {
        FlynnButton(
            title: "Start free trial — continue setup",
            action: purchase,
            fullWidth: true,
            isLoading: isPurchasing
        )
        .disabled(selectedProductId == nil || isPurchasing)
    }

    private func purchase() {
        guard let id = selectedProductId,
              let item = subStore.products.first(where: { $0.product.id == id }) else { return }
        isPurchasing = true
        Task {
            await subStore.purchase(item)
            isPurchasing = false
            flash.success("Trial started — welcome to Flynn")
            onSubscribe()
        }
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
