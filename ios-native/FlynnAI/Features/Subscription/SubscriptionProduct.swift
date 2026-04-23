import Foundation
import StoreKit

/// Cross-joins a Supabase `plans` row with its resolved StoreKit `Product`.
/// Stored and rendered in that combined form so the paywall can show the
/// correct localized price from StoreKit while keeping Flynn-side metadata
/// (features, seat count, voice-clone flag) in sync with the catalog.
struct SubscriptionProduct: Identifiable, Hashable, Sendable {
    let plan: PlanDTO
    let product: Product

    var id: UUID { plan.id }

    var displayPrice: String { product.displayPrice }

    /// Localised intro offer copy, e.g. "14-day free trial".
    var introOfferDescription: String? {
        guard let intro = product.subscription?.introductoryOffer else { return nil }
        switch intro.paymentMode {
        case .freeTrial:
            return "\(formattedPeriod(intro.period)) free trial"
        case .payAsYouGo, .payUpFront:
            return "Intro \(intro.displayPrice)"
        default:
            return nil
        }
    }

    var isMostPopular: Bool { plan.slug == "growth" }

    private func formattedPeriod(_ period: Product.SubscriptionPeriod) -> String {
        let value = period.value
        switch period.unit {
        case .day:   return "\(value)-day"
        case .week:  return "\(value)-week"
        case .month: return "\(value)-month"
        case .year:  return "\(value)-year"
        @unknown default: return "\(value)"
        }
    }

    static func == (lhs: SubscriptionProduct, rhs: SubscriptionProduct) -> Bool {
        lhs.plan.id == rhs.plan.id && lhs.product.id == rhs.product.id
    }

    func hash(into hasher: inout Hasher) {
        hasher.combine(plan.id)
        hasher.combine(product.id)
    }
}

/// Local entitlement snapshot derived from `Transaction.currentEntitlements`
/// and cross-referenced with the Supabase `plans` catalog so other features
/// can gate UI off things like "is this user on Pro?" without hitting the DB.
struct SubscriptionEntitlement: Equatable, Sendable {
    let plan: PlanDTO
    let transactionId: UInt64
    let originalTransactionId: UInt64
    let expiresAt: Date?
    let isInIntroOffer: Bool

    /// All paid tiers allow AI. No paid tier means SMS-Links only.
    var allowsAI: Bool { true }
    var allowsVoiceClone: Bool { plan.includesVoiceClone }
    var seats: Int { plan.seats }
}
