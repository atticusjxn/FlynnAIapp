import Foundation
import StoreKit
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

    private(set) var loadState: LoadState = .idle
    private(set) var purchaseState: PurchaseState = .idle
    private(set) var products: [SubscriptionProduct] = []
    private(set) var currentEntitlement: SubscriptionEntitlement?

    private let plansRepository: PlansRepositoryType
    private var plansCatalog: [PlanDTO] = []
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
            let byId = Dictionary(uniqueKeysWithValues: storeKitProducts.map { ($0.id, $0) })

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

    func purchase(_ subscriptionProduct: SubscriptionProduct) async {
        purchaseState = .purchasing(productId: subscriptionProduct.product.id)
        do {
            let result = try await subscriptionProduct.product.purchase()
            switch result {
            case .success(let verification):
                let transaction = try checkVerified(verification)
                await handleTransactionResult(.verified(transaction), source: .purchase)
                await transaction.finish()
                purchaseState = .success
            case .userCancelled:
                purchaseState = .idle
            case .pending:
                purchaseState = .idle
            @unknown default:
                purchaseState = .idle
            }
        } catch {
            purchaseState = .failed(error.localizedDescription)
            FlynnLog.network.error("Purchase failed: \(error.localizedDescription, privacy: .public)")
        }
    }

    func restorePurchases() async {
        do {
            try await AppStore.sync()
            await refreshEntitlement()
        } catch {
            FlynnLog.network.error("AppStore.sync failed: \(error.localizedDescription, privacy: .public)")
        }
    }

    // MARK: - Entitlement

    func refreshEntitlement() async {
        for await result in Transaction.currentEntitlements {
            if case let .verified(transaction) = result,
               let plan = plan(forProductID: transaction.productID)
            {
                currentEntitlement = SubscriptionEntitlement(
                    plan: plan,
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
            await forwardToBackend(transaction: transaction)
            if source == .update {
                await transaction.finish()
            }
            await refreshEntitlement()
        case .unverified(_, let error):
            FlynnLog.network.error("Unverified transaction: \(error.localizedDescription, privacy: .public)")
        }
    }

    private func forwardToBackend(transaction: Transaction) async {
        var request = URLRequest(url: FlynnEnv.flynnAPIBaseURL.appendingPathComponent("webhooks/appstore/verify"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        do {
            let session = try await FlynnSupabase.client.auth.session
            request.setValue("Bearer \(session.accessToken)", forHTTPHeaderField: "Authorization")

            let payload: [String: String] = [
                "signedTransactionInfo": transaction.jsonRepresentation.base64EncodedString(),
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

    private func checkVerified<T>(_ result: VerificationResult<T>) throws -> T {
        switch result {
        case .verified(let value): return value
        case .unverified(_, let error): throw error
        }
    }
}
