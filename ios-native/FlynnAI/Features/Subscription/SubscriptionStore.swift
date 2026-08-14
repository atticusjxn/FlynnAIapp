import Foundation
import StoreKit
import FBSDKCoreKit
import Observation

/// StoreKit 2 subscription runtime.
///
/// Responsibilities:
/// - Fetch the Flynn `plans` catalog from Supabase.
/// - Resolve each plan's App Store `Product` via `Product.products(for:)`.
/// - Run `product.purchase()` on user tap and forward the JWS to the backend
///   so the `subscriptions` Supabase row is written via server-side verification.
/// - Keep `currentEntitlement` up to date from `Transaction.currentEntitlements`.
/// - Listen to `Transaction.updates` for renewals / expires / revocations.
@MainActor
@Observable
final class SubscriptionStore {
    enum LoadState: Equatable { case idle, loading, loaded, error(String) }
    enum PurchaseState: Equatable { case idle, purchasing(productId: String), failed(String), success }
    /// Outcome of the last "Restore purchases" tap. Reviewers press this button on
    /// every submission, and silence reads as a broken app, so the result is
    /// observable state rather than a fire-and-forget task.
    enum RestoreState: Equatable { case idle, restoring, restored, nothingToRestore, failed(String) }

    private(set) var loadState: LoadState = .idle
    private(set) var purchaseState: PurchaseState = .idle
    private(set) var restoreState: RestoreState = .idle
    private(set) var products: [SubscriptionProduct] = []
    private(set) var currentEntitlement: SubscriptionEntitlement?

    private let plansRepository: PlansRepositoryType
    private var plansCatalog: [PlanDTO] = []
    /// Stand-in plans for verified entitlements the catalog can't name, keyed by
    /// App Store product id. Cached so `currentEntitlement` stays stable (and
    /// Equatable-equal) across refreshes instead of churning a fresh UUID each time.
    private var fallbackPlans: [String: PlanDTO] = [:]
    private var transactionListenerTask: Task<Void, Never>?

    init(plansRepository: PlansRepositoryType = PlansRepository()) {
        self.plansRepository = plansRepository
    }

    // MARK: - Boot

    /// Call once from `FlynnAIApp.init`/`.task`. Kicks off the transaction
    /// listener and loads the product catalog.
    func bootstrap() async {
        if transactionListenerTask == nil {
            transactionListenerTask = Task.detached { [weak self] in
                for await result in Transaction.updates {
                    await self?.handleTransactionResult(result, source: .update)
                }
            }
        }
        await load()
        await refreshEntitlement()
    }

    func load() async {
        loadState = .loading
        do {
            plansCatalog = try await plansRepository.list()

            let productIds = plansCatalog.compactMap(\.appleProductId)
            guard !productIds.isEmpty else {
                products = []
                loadState = .loaded
                return
            }

            let storeKitProducts = try await Product.products(for: productIds)
            // `Dictionary(uniqueKeysWithValues:)` TRAPS on a duplicate key, and
            // this runs on paywall appear — a duplicate apple_product_id in the
            // plans table would take the whole app down at the exact moment the
            // user tries to pay. Last-one-wins instead.
            let byId = Dictionary(storeKitProducts.map { ($0.id, $0) }, uniquingKeysWith: { _, latest in latest })

            products = plansCatalog.compactMap { plan in
                guard
                    let productId = plan.appleProductId,
                    let product = byId[productId]
                else { return nil }
                return SubscriptionProduct(plan: plan, product: product)
            }
            loadState = .loaded
        } catch {
            loadState = .error(error.localizedDescription)
            FlynnLog.network.error("SubscriptionStore.load failed: \(error.localizedDescription, privacy: .public)")
        }
    }

    // MARK: - Purchase

    @discardableResult
    func purchase(_ subscriptionProduct: SubscriptionProduct) async -> Bool {
        purchaseState = .purchasing(productId: subscriptionProduct.product.id)
        do {
            // Stamp the Supabase user id as the appAccountToken. The backend's
            // userIdForTransaction() reads exactly this to map an App Store
            // Server Notification back to a Flynn user; without it the only
            // fallback is a `subscriptions` row lookup, and that row is written
            // by the very verify call this token is needed for — so a purchase
            // could never be attributed by either route.
            var options: Set<Product.PurchaseOption> = []
            if let session = try? await FlynnSupabase.client.auth.session {
                options.insert(.appAccountToken(session.user.id))
            }
            let result = try await subscriptionProduct.product.purchase(options: options)
            switch result {
            case .success(let verification):
                let transaction = try checkVerified(verification)
                await handleTransactionResult(verification, source: .purchase)
                await transaction.finish()
                purchaseState = .success
                // `subscription_purchased` was declared and never fired, so the
                // funnel had no paid step at all — trial_started was the last
                // thing it could see.
                let isTrial = transaction.offerType == .introductory
                Analytics.capture(.subscriptionPurchased, [
                    "product_id": subscriptionProduct.product.id,
                    "plan": subscriptionProduct.plan.name,
                    "price": NSDecimalNumber(decimal: subscriptionProduct.product.price).doubleValue,
                    "currency": subscriptionProduct.product.priceFormatStyle.currencyCode,
                    "is_trial": isTrial,
                ])
                Analytics.setPersonProperties([
                    "plan": subscriptionProduct.plan.name,
                    "is_paying": true,
                ], onceOnly: ["first_purchase_at": ISO8601DateFormatter().string(from: Date())])
                logAdConversion(product: subscriptionProduct, isTrial: isTrial)
                // The single most valuable event in the app. Don't leave it
                // sitting in a batch queue waiting on a timer.
                Analytics.flush()
                return true
            case .userCancelled:
                purchaseState = .idle
                // Abandoning at the Apple sheet is a different failure from
                // never tapping the CTA, and only this tells them apart.
                Analytics.capture(.purchaseCancelled, ["product_id": subscriptionProduct.product.id])
                return false
            case .pending:
                purchaseState = .idle
                Analytics.capture(.purchaseFailed, [
                    "product_id": subscriptionProduct.product.id,
                    "reason": "pending_approval",
                ])
                return false
            @unknown default:
                purchaseState = .idle
                return false
            }
        } catch {
            purchaseState = .failed(error.localizedDescription)
            Analytics.capture(.purchaseFailed, [
                "product_id": subscriptionProduct.product.id,
                "reason": error.localizedDescription,
            ])
            FlynnLog.network.error("Purchase failed: \(error.localizedDescription, privacy: .public)")
            return false
        }
    }

    /// Restores from the App Store and reports what happened via `restoreState`.
    ///
    /// `AppStore.sync()` succeeding does not mean anything was restored, so the
    /// entitlement is what decides between "restored" and "nothing to restore".
    func restorePurchases() async {
        restoreState = .restoring
        do {
            try await AppStore.sync()
            await refreshEntitlement()
            restoreState = currentEntitlement == nil ? .nothingToRestore : .restored
        } catch {
            FlynnLog.network.error("AppStore.sync failed: \(error.localizedDescription, privacy: .public)")
            restoreState = .failed(error.localizedDescription)
        }
    }

    /// Clear the restore result once a view has shown it.
    func acknowledgeRestore() {
        restoreState = .idle
    }

    // MARK: - Entitlement

    /// A verified StoreKit entitlement is the source of truth for "is this user
    /// paying" — the Supabase `plans` catalog only supplies the label.
    ///
    /// This used to require both: if the catalog fetch failed, or the user held a
    /// grandfathered product id that is no longer `is_active` (and so is filtered
    /// out of the catalog), a genuinely paying customer was treated as unentitled
    /// and stranded on the paywall with no way past it. Now the entitlement always
    /// stands and the plan degrades to a stand-in when we can't name it.
    func refreshEntitlement() async {
        for await result in Transaction.currentEntitlements {
            if case let .verified(transaction) = result {
                currentEntitlement = SubscriptionEntitlement(
                    plan: plan(forProductID: transaction.productID)
                        ?? fallbackPlan(forProductID: transaction.productID),
                    transactionId: transaction.id,
                    originalTransactionId: transaction.originalID,
                    expiresAt: transaction.expirationDate,
                    isInIntroOffer: transaction.offerType == .introductory
                )
                return
            }
        }
        currentEntitlement = nil
    }

    // MARK: - Internals

    private enum TransactionSource { case update, purchase }

    private func handleTransactionResult(_ result: VerificationResult<Transaction>, source: TransactionSource) async {
        switch result {
        case .verified(let transaction):
            // Pass the ORIGINAL signed JWS through — see forwardToBackend.
            await forwardToBackend(transaction: transaction, jws: result.jwsRepresentation)
            if source == .update {
                await transaction.finish()
                reportLifecycle(transaction)
            }
            await refreshEntitlement()
        case .unverified(_, let error):
            FlynnLog.network.error("Unverified transaction: \(error.localizedDescription, privacy: .public)")
        }
    }

    /// Report the conversion to Meta's **app** dataset via the Facebook SDK.
    ///
    /// This lives here, not in the view, because `isTrial` is only knowable from
    /// the verified transaction, and the view had no way to see it — so a 7-day
    /// trial (which charges nothing today) was logged as a full-price `Purchase`.
    ///
    /// Why an SDK app event rather than the server CAPI call that already
    /// exists: Meta attributes an **app-install campaign** through the app
    /// dataset (SDK / SKAdNetwork / Aggregated Event Measurement). The
    /// server-side `trackStartTrial` in telephony/subscriptionService.js posts
    /// to a *web pixel* with `action_source: "website"`, so it lands in the
    /// wrong dataset to ever line up with app-install ads. The two are
    /// complementary, not duplicates: the server call stays as the
    /// Apple-verified record of truth (it can't be lost to the app being
    /// killed mid-purchase), and this is the one an app campaign can read.
    ///
    /// Firing it now — while the campaign still optimises for installs — is
    /// deliberate. Meta needs roughly 50 conversions a week to leave the
    /// learning phase, which trial starts won't reach at A$40/day. But an event
    /// with weeks of history behind it can be switched to as the optimisation
    /// target the moment volume supports it, instead of starting from cold.
    private func logAdConversion(product: SubscriptionProduct, isTrial: Bool) {
        // Renewals arrive through Transaction.updates and must not re-fire the
        // acquisition event.
        let key = "ads.conversion.logged.\(product.product.id)"
        guard !UserDefaults.standard.bool(forKey: key) else { return }
        UserDefaults.standard.set(true, forKey: key)

        let amount = NSDecimalNumber(decimal: product.product.price).doubleValue
        let currency = product.product.priceFormatStyle.currencyCode

        if isTrial {
            // Value is the plan price as the *predicted* worth of the trial, not
            // money taken today — which is what StartTrial means to Meta.
            AppEvents.shared.logEvent(
                .startTrial,
                valueToSum: amount,
                parameters: [.currency: currency, .contentID: product.product.id]
            )
        } else {
            AppEvents.shared.logPurchase(amount: amount, currency: currency)
        }
    }

    /// Turn a `Transaction.updates` delivery into a churn-side event.
    ///
    /// Everything after "paid" was invisible: the funnel ended at purchase and
    /// nothing recorded a renewal, an expiry, or a refund, which makes week-4
    /// retention — the north-star metric — unanswerable from the client.
    ///
    /// StoreKit doesn't hand over a typed reason, so these are inferred from the
    /// transaction itself, and the inference is deliberately conservative:
    ///
    /// - `revocationDate` set → Apple took the money back. Refund, not churn.
    /// - expiry in the past → the subscription lapsed.
    /// - an introductory-offer transaction being replaced by a standard one →
    ///   the trial converted, which is the single most important number in the
    ///   plan and is otherwise indistinguishable from an ordinary renewal.
    /// - anything else with a future expiry → a renewal.
    ///
    /// Apple's Server Notifications remain the authority for billing; this is
    /// the product-analytics view, and the two can disagree at the margins
    /// (a device offline through an expiry reports it late).
    private func reportLifecycle(_ transaction: Transaction) {
        var props: [String: Any] = [
            "product_id": transaction.productID,
            "original_transaction_id": String(transaction.originalID),
        ]

        if transaction.revocationDate != nil {
            Analytics.capture(.subscriptionRefunded, props)
            Analytics.setPersonProperties(["is_paying": false, "churn_reason": "refunded"])
            return
        }

        if let expiry = transaction.expirationDate, expiry <= Date() {
            props["expired_at"] = ISO8601DateFormatter().string(from: expiry)
            Analytics.capture(.subscriptionExpired, props)
            Analytics.setPersonProperties(["is_paying": false, "churn_reason": "expired"])
            return
        }

        // A renewal that is NOT on the intro offer, for someone who was on it,
        // is the trial converting to paid.
        let wasOnTrial = currentEntitlement?.isInIntroOffer ?? false
        if wasOnTrial && transaction.offerType != .introductory {
            Analytics.capture(.trialConverted, props)
            Analytics.setPersonProperties(["is_paying": true, "converted_from_trial": true])
            return
        }

        Analytics.capture(.subscriptionRenewed, props)
        Analytics.setPersonProperties(["is_paying": true])
    }

    /// Post the purchase to the backend so it can write the `subscriptions`
    /// row that gates number assignment.
    ///
    /// `jws` must be the SIGNED representation. This previously sent
    /// `transaction.jsonRepresentation` — the already-DECODED payload — which
    /// the server rejected outright (`verifyAndDecodeJWS` needs three
    /// dot-separated parts and a verifiable x5c chain), so every purchase
    /// 400'd, no subscription row was ever written, and the next onboarding
    /// step then refused to allocate a number to a user who had just paid.
    /// `VerificationResult.jwsRepresentation` is the signed form; it contains
    /// dots, so the server takes it as-is with no base64 wrapping.
    private func forwardToBackend(transaction: Transaction, jws: String) async {
        var request = URLRequest(url: FlynnEnv.flynnAPIBaseURL.appendingPathComponent("webhooks/appstore/verify"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        do {
            let session = try await FlynnSupabase.client.auth.session
            request.setValue("Bearer \(session.accessToken)", forHTTPHeaderField: "Authorization")

            let payload: [String: String] = [
                "signedTransactionInfo": jws,
                "originalTransactionId": String(transaction.originalID)
            ]
            request.httpBody = try JSONSerialization.data(withJSONObject: payload)

            let (_, response) = try await URLSession.shared.data(for: request)
            if let http = response as? HTTPURLResponse, !(200..<300).contains(http.statusCode) {
                FlynnLog.network.error("AppStore verify returned \(http.statusCode, privacy: .public)")
            }
        } catch {
            // Non-fatal — StoreKit remains source of truth; backend will catch up via ASSN2.
            FlynnLog.network.error("AppStore verify forward failed: \(error.localizedDescription, privacy: .public)")
        }
    }

    private func plan(forProductID productID: String) -> PlanDTO? {
        plansCatalog.first { $0.appleProductId == productID }
    }

    /// A minimal plan for an entitlement the catalog can't name.
    ///
    /// `SubscriptionEntitlement.plan` is non-optional and read all over the app,
    /// so a stand-in beats making it optional and half-migrating every caller.
    /// The name is deliberately generic: we know they're paying, we just don't
    /// know which tier, and guessing a tier name would be worse than saying so.
    /// `aiMinutesMonthly` matches the Receptionist allowance (250, see the
    /// two_tier_plans migration) so an unnamed but verified subscriber is never
    /// shown less than they've paid for. Metering itself is server-side.
    private func fallbackPlan(forProductID productID: String) -> PlanDTO {
        if let cached = fallbackPlans[productID] { return cached }
        let plan = PlanDTO(
            id: UUID(),
            name: "unknown",
            displayName: "Flynn subscription",
            appleProductId: productID,
            priceMonthlyAud: 0,
            aiMinutesMonthly: 250,
            includesVoiceClone: false,
            isActive: true
        )
        fallbackPlans[productID] = plan
        FlynnLog.network.error("Entitled to \(productID, privacy: .public) but no matching plan in the catalog; using a stand-in")
        return plan
    }

    private func checkVerified<T>(_ result: VerificationResult<T>) throws -> T {
        switch result {
        case .verified(let value): return value
        case .unverified(_, let error): throw error
        }
    }
}
