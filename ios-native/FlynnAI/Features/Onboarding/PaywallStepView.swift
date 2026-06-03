import SwiftUI
import StoreKit
import FBSDKCoreKit

/// Paywall shown after the user has already felt the value (their voice, a real
/// draft). Rendered on the cream onboarding surface. Pro = unlimited drafts +
/// calendar booking + full voice tuning; Free keeps a daily draft cap.
struct PaywallStepView: View {
    let store: OnboardingStore
    let onSubscribe: () -> Void
    let onSkip: () -> Void

    @Environment(FlashStore.self) private var flash
    @Environment(SubscriptionStore.self) private var subStore
    @State private var selectedProductId: String?
    @State private var isPurchasing = false

    var body: some View {
        ZStack {
            MidCenturyBackdrop(variant: 3)
            VStack(spacing: 0) {
                ScrollView {
                    VStack(alignment: .leading, spacing: 20) {
                        OnboardingHeadline(
                            eyebrow: "Step 6",
                            title: "Go unlimited",
                            accentTitle: "with Pro",
                            subtitle: "Unlimited replies in your voice, calendar booking, and full voice tuning. 14-day free trial — cancel any time, no charge today."
                        )

                        switch subStore.loadState {
                        case .idle, .loading:
                            VStack(spacing: 12) {
                                ProgressView().tint(OB.orange)
                                Text("Loading plans…")
                                    .font(.custom(FlynnFontName.interMedium, size: 13))
                                    .foregroundColor(OB.inkSoft)
                            }
                            .frame(maxWidth: .infinity, minHeight: 200)
                        case .error(let msg):
                            loadFailedState(msg)
                        case .loaded:
                            if subStore.products.isEmpty { noPlansState }
                            else { planCards }
                        }
                    }
                    .padding(.horizontal, 24)
                    .padding(.top, 12)
                    .padding(.bottom, 16)
                }

                VStack(spacing: 8) {
                    if case .loaded = subStore.loadState, !subStore.products.isEmpty {
                        RetroButton(
                            title: "Start free trial",
                            isLoading: isPurchasing,
                            action: purchase
                        )
                        .opacity(selectedProductId == nil ? 0.55 : 1)
                        .disabled(selectedProductId == nil || isPurchasing)
                    }
                    RetroTextButton(title: "Maybe later — keep the free plan", action: onSkip)
                }
                .padding(.horizontal, 24)
                .padding(.top, 8)
                .padding(.bottom, 12)
            }
        }
        .environment(\.colorScheme, .light)
        .task { await subStore.bootstrap() }
    }

    private var planCards: some View {
        VStack(spacing: 10) {
            ForEach(subStore.products) { item in
                let isSelected = selectedProductId == item.product.id
                Button(action: { selectedProductId = item.product.id }) {
                    HStack {
                        VStack(alignment: .leading, spacing: 3) {
                            Text(item.plan.displayName)
                                .font(.custom(FlynnFontName.spaceGroteskSemiBold, size: 17))
                                .foregroundColor(OB.ink)
                            Text("Unlimited drafts · calendar booking")
                                .font(.custom(FlynnFontName.interRegular, size: 13))
                                .foregroundColor(OB.inkFaint)
                        }
                        Spacer()
                        Text(item.displayPrice + "/mo")
                            .font(.custom(FlynnFontName.spaceGroteskSemiBold, size: 16))
                            .foregroundColor(OB.ink)
                        Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                            .foregroundColor(isSelected ? OB.orange : OB.inkFaint.opacity(0.5))
                    }
                    .padding(16)
                    .background(
                        RoundedRectangle(cornerRadius: 18, style: .continuous)
                            .fill(isSelected ? OB.mustard.opacity(0.28) : OB.card)
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: 18, style: .continuous)
                            .stroke(OB.ink, lineWidth: isSelected ? OB.outline + 1 : OB.outline)
                    )
                }
                .buttonStyle(.plain)
            }
        }
    }

    private func loadFailedState(_ errorMessage: String) -> some View {
        VStack(spacing: 12) {
            Image(systemName: "wifi.exclamationmark").font(.system(size: 32)).foregroundColor(OB.inkFaint)
            Text("Couldn't reach the App Store")
                .font(.custom(FlynnFontName.spaceGroteskSemiBold, size: 18)).foregroundColor(OB.ink)
            Text("Check your connection and try again.")
                .font(.custom(FlynnFontName.interRegular, size: 13)).foregroundColor(OB.inkSoft)
                .multilineTextAlignment(.center)
            Text(errorMessage)
                .font(.custom(FlynnFontName.interRegular, size: 12)).foregroundColor(OB.inkFaint)
                .multilineTextAlignment(.center).padding(.horizontal, 8)
            RetroButton(title: "Retry", variant: .secondary, action: { Task { await subStore.bootstrap() } })
        }
        .frame(maxWidth: .infinity, minHeight: 220)
    }

    private var noPlansState: some View {
        VStack(spacing: 12) {
            Image(systemName: "creditcard.trianglebadge.exclamationmark").font(.system(size: 32)).foregroundColor(OB.inkFaint)
            Text("Plans not configured")
                .font(.custom(FlynnFontName.spaceGroteskSemiBold, size: 18)).foregroundColor(OB.ink)
            Text("In-app products haven't been set up in App Store Connect yet.")
                .font(.custom(FlynnFontName.interRegular, size: 13)).foregroundColor(OB.inkSoft)
                .multilineTextAlignment(.center)
            RetroButton(title: "Retry", variant: .secondary, action: { Task { await subStore.bootstrap() } })
        }
        .frame(maxWidth: .infinity, minHeight: 220)
    }

    private func purchase() {
        guard let id = selectedProductId,
              let item = subStore.products.first(where: { $0.product.id == id }) else { return }
        isPurchasing = true
        Task {
            let didPurchase = await subStore.purchase(item)
            isPurchasing = false

            guard didPurchase else {
                if case .failed(let message) = subStore.purchaseState { flash.error(message) }
                return
            }

            // Log the StartTrial conversion event for Meta ad attribution.
            AppEvents.shared.logEvent(.startTrial, parameters: [.currency: "AUD"])
            flash.success("Trial started — welcome to Flynn")
            onSubscribe()
        }
    }
}
