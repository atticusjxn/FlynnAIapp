import SwiftUI
import StoreKit
import FBSDKCoreKit

/// Paywall — lists the Flynn plans with App Store-resolved prices and a
/// "Start 7-day free trial" CTA. Auto-renewable fine print follows Apple's
/// required disclosures (Apple Guideline 3.1.2).
struct SubscriptionView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(FlashStore.self) private var flash
    @Environment(SubscriptionStore.self) private var store

    @State private var selectedProductId: String?
    /// Purchase failures shown inline, not only as a flash. This screen is
    /// presented as a sheet, and for a long time the flash banner lived only in
    /// RootView underneath it — so a failed purchase produced no visible
    /// feedback at all. The sheet now carries its own banner too, but the CTA
    /// is the thing a reviewer taps, so it states its own errors directly.
    @State private var purchaseError: String?

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
                            if let purchaseError {
                                Text(purchaseError)
                                    .flynnType(FlynnTypography.bodyMedium)
                                    .foregroundColor(FlynnColor.error)
                                    .multilineTextAlignment(.center)
                                    .frame(maxWidth: .infinity)
                                    .fixedSize(horizontal: false, vertical: true)
                            }
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
            // Nothing was ever selected by default, so the very first tap of the
            // CTA fell through startPurchase()'s guard and did nothing visible —
            // the exact "app didn't respond when tapped on start free trial"
            // Apple rejected build 3.0.3 for. Default to the featured plan (or
            // the first available) the moment products resolve, so the primary
            // action is always live.
            .onChange(of: store.products.map(\.product.id)) { _, ids in
                guard selectedProductId == nil, !ids.isEmpty else { return }
                selectedProductId = store.products.first(where: { $0.isMostPopular })?.product.id ?? ids.first
            }
        }
    }

    // MARK: Sections

    private var header: some View {
        VStack(alignment: .leading, spacing: FlynnSpacing.xs) {
            Text("Never miss a job. Never chase a payment.")
                .flynnType(FlynnTypography.h2)
                .foregroundColor(FlynnColor.textPrimary)
            Text("Pick a plan and start your 7-day free trial. Cancel anytime before it ends and you won't be charged.")
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
        // Paywall is a hero moment — glass treatment, matching the invoice page.
        FlynnGlassButton(
            title: ctaTitle,
            action: startPurchase,
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
        return "Start 7-day free trial"
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
            restoreAndLinks
                .padding(.top, FlynnSpacing.xs)
        }
        .padding(FlynnSpacing.md)
    }

    /// Shown when StoreKit resolves no products — most likely the IAPs aren't
    /// approved/live yet. This used to print "Check your App Store Connect
    /// product configuration", an internal instruction shipped as user copy,
    /// and rendered without the Terms/Privacy links (which live in
    /// `restoreAndLinks`, only reachable on the loaded branch), leaving a
    /// reviewer on a dead screen with no legal links. Now it says something a
    /// customer can act on, offers a retry, and always carries the links.
    private var emptyState: some View {
        VStack(spacing: FlynnSpacing.sm) {
            Text("Plans aren't available right now")
                .flynnType(FlynnTypography.h4)
                .foregroundColor(FlynnColor.textPrimary)
            Text("This is usually a temporary App Store hiccup. Try again in a moment.")
                .flynnType(FlynnTypography.bodyMedium)
                .foregroundColor(FlynnColor.textSecondary)
                .multilineTextAlignment(.center)
            FlynnButton(title: "Try again", action: { Task { await store.load() } })
            restoreAndLinks
                .padding(.top, FlynnSpacing.xs)
        }
        .padding(FlynnSpacing.md)
    }

    // MARK: Actions

    private func startPurchase() {
        purchaseError = nil
        // Fall back to the first available product rather than bailing: the CTA
        // must never be a no-op tap. A selection is normally set as soon as
        // products resolve (see .onChange above); this covers the window before
        // that lands and any state where it somehow didn't.
        guard
            let product = store.products.first(where: { $0.product.id == selectedProductId })
                ?? store.products.first
        else {
            purchaseError = "Plans are still loading — give it a second and try again."
            return
        }
        selectedProductId = product.product.id
        Task {
            await store.purchase(product)
            if case .success = store.purchaseState {
                // Log paid-conversion event for Meta + TikTok ad attribution.
                // Deduped via UserDefaults so renewals don't fire it again.
                let key = "ads.purchase.logged.\(product.product.id)"
                if !UserDefaults.standard.bool(forKey: key) {
                    let amount = NSDecimalNumber(decimal: product.product.price)
                    let currency = product.product.priceFormatStyle.currencyCode
                    AppEvents.shared.logPurchase(amount: amount.doubleValue, currency: currency)
                    UserDefaults.standard.set(true, forKey: key)
                }
                flash.success("Welcome to \(product.plan.displayName)")
                dismiss()
            } else if case .failed(let message) = store.purchaseState {
                purchaseError = message
                flash.error(message)
            }
        }
    }
}
