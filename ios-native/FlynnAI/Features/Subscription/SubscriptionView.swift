import SwiftUI
import StoreKit

/// Paywall — lists the 3 Flynn plans with App Store-resolved prices and a
/// "Start 14-day free trial" CTA. Auto-renewable fine print follows Apple's
/// required disclosures (Apple Guideline 3.1.2).
struct SubscriptionView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(FlashStore.self) private var flash
    @Environment(SubscriptionStore.self) private var store

    @State private var selectedProductId: String?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: FlynnSpacing.lg) {
                    header

                    switch store.loadState {
                    case .idle, .loading:
                        ProgressView()
                            .frame(maxWidth: .infinity, minHeight: 260)
                    case .error(let message):
                        errorState(message)
                    case .loaded:
                        if store.products.isEmpty {
                            emptyState
                        } else {
                            planCards
                            ctaButton
                            restoreAndLinks
                        }
                    }

                    fineprint
                }
                .padding(FlynnSpacing.lg)
            }
            .background(FlynnColor.background)
            .navigationTitle("")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Close") { dismiss() }
                }
            }
            .task { await store.bootstrap() }
        }
    }

    // MARK: Sections

    private var header: some View {
        VStack(alignment: .leading, spacing: FlynnSpacing.xs) {
            Text("Never miss another booking")
                .flynnType(FlynnTypography.h2)
                .foregroundColor(FlynnColor.textPrimary)
            Text("Flynn answers every missed call, texts back a booking link, and — on paid plans — talks to your customers for you. Try free for 14 days.")
                .flynnType(FlynnTypography.bodyMedium)
                .foregroundColor(FlynnColor.textSecondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var planCards: some View {
        VStack(spacing: FlynnSpacing.md) {
            ForEach(store.products) { product in
                planCard(product)
            }
        }
    }

    private func planCard(_ item: SubscriptionProduct) -> some View {
        let isSelected = selectedProductId == item.product.id
        return Button(action: { selectedProductId = item.product.id }) {
            VStack(alignment: .leading, spacing: FlynnSpacing.sm) {
                HStack(alignment: .firstTextBaseline) {
                    Text(item.plan.displayName)
                        .flynnType(FlynnTypography.h3)
                        .foregroundColor(FlynnColor.textPrimary)
                    if item.isMostPopular {
                        FlynnBadge(label: "Most popular", variant: .primary)
                    }
                    Spacer()
                    VStack(alignment: .trailing, spacing: 0) {
                        Text(item.displayPrice)
                            .flynnType(FlynnTypography.h3)
                            .foregroundColor(FlynnColor.textPrimary)
                        Text("/month")
                            .flynnType(FlynnTypography.caption)
                            .foregroundColor(FlynnColor.textTertiary)
                    }
                }

                HStack(spacing: FlynnSpacing.xs) {
                    Image(systemName: "waveform")
                        .foregroundColor(FlynnColor.primary)
                    Text("\(item.plan.aiMinutesMonthly) min AI receptionist / month")
                        .flynnType(FlynnTypography.bodyMedium)
                        .foregroundColor(FlynnColor.textPrimary)
                }

                ForEach(item.plan.features, id: \.self) { line in
                    HStack(alignment: .top, spacing: FlynnSpacing.xs) {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundColor(FlynnColor.success)
                        Text(line)
                            .flynnType(FlynnTypography.bodyMedium)
                            .foregroundColor(FlynnColor.textSecondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }

                if let intro = item.introOfferDescription {
                    Text(intro)
                        .flynnType(FlynnTypography.caption)
                        .foregroundColor(FlynnColor.primary)
                }
            }
            .padding(FlynnSpacing.md)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: FlynnRadii.md, style: .continuous)
                    .fill(isSelected ? FlynnColor.primaryLight : FlynnColor.backgroundSecondary)
            )
            .brutalistBorder(
                cornerRadius: FlynnRadii.md,
                color: isSelected ? FlynnColor.primary : FlynnColor.border,
                lineWidth: isSelected ? 3 : 2
            )
        }
        .buttonStyle(.plain)
    }

    private var ctaButton: some View {
        FlynnButton(
            title: ctaTitle,
            action: startPurchase,
            fullWidth: true,
            isLoading: isPurchasing
        )
    }

    private var ctaTitle: String {
        guard let productId = selectedProductId,
              let item = store.products.first(where: { $0.product.id == productId }),
              item.introOfferDescription != nil
        else {
            return "Subscribe"
        }
        return "Start 14-day free trial"
    }

    private var isPurchasing: Bool {
        if case .purchasing = store.purchaseState { return true }
        return false
    }

    private var restoreAndLinks: some View {
        HStack {
            Button("Restore purchases") {
                Task { await store.restorePurchases() }
            }
            .flynnType(FlynnTypography.caption)
            .foregroundColor(FlynnColor.primary)
            Spacer()
            Link("Terms", destination: URL(string: "https://flynnai.app/terms")!)
                .flynnType(FlynnTypography.caption)
                .foregroundColor(FlynnColor.primary)
            Link("Privacy", destination: URL(string: "https://flynnai.app/privacy")!)
                .flynnType(FlynnTypography.caption)
                .foregroundColor(FlynnColor.primary)
        }
    }

    private var fineprint: some View {
        Text(
            "Payment is charged to your Apple ID at confirmation of purchase. " +
            "Subscription automatically renews at the price shown unless cancelled at least 24 hours before the end of the current period. " +
            "Manage or cancel in your Apple ID settings."
        )
        .flynnType(FlynnTypography.caption)
        .foregroundColor(FlynnColor.textTertiary)
        .multilineTextAlignment(.leading)
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func errorState(_ message: String) -> some View {
        VStack(spacing: FlynnSpacing.sm) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: 36))
                .foregroundColor(FlynnColor.error)
            Text("Couldn't load plans")
                .flynnType(FlynnTypography.h4)
                .foregroundColor(FlynnColor.textPrimary)
            Text(message)
                .flynnType(FlynnTypography.bodyMedium)
                .foregroundColor(FlynnColor.textSecondary)
                .multilineTextAlignment(.center)
            FlynnButton(title: "Retry", action: { Task { await store.load() } })
        }
        .padding(FlynnSpacing.md)
    }

    private var emptyState: some View {
        VStack(spacing: FlynnSpacing.sm) {
            Text("Plans not available")
                .flynnType(FlynnTypography.h4)
                .foregroundColor(FlynnColor.textPrimary)
            Text("Check your App Store Connect product configuration.")
                .flynnType(FlynnTypography.bodyMedium)
                .foregroundColor(FlynnColor.textSecondary)
                .multilineTextAlignment(.center)
        }
        .padding(FlynnSpacing.md)
    }

    // MARK: Actions

    private func startPurchase() {
        guard
            let productId = selectedProductId,
            let product = store.products.first(where: { $0.product.id == productId })
        else {
            flash.error("Select a plan first")
            return
        }
        Task {
            await store.purchase(product)
            if case .success = store.purchaseState {
                flash.success("Welcome to \(product.plan.displayName)")
                dismiss()
            } else if case .failed(let message) = store.purchaseState {
                flash.error(message)
            }
        }
    }
}
