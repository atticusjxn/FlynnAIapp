import Foundation

/// Sellable plan catalog row. Mirrors `public.plans`.
struct PlanDTO: Codable, Identifiable, Hashable, Sendable {
    let id: UUID
    let name: String          // "starter" | "growth" | "pro"
    let displayName: String
    let appleProductId: String?
    let priceMonthlyAud: Double
    let aiMinutesMonthly: Int
    let includesVoiceClone: Bool
    let isActive: Bool

    // Convenience aliases / defaults for fields not in the current DB schema
    var slug: String { name }
    var seats: Int { 1 }

    /// Feature bullets for the paywall. Not a DB column — the two-tier catalog
    /// (`link` / `receptionist`, see services/pricing.js) is small and stable
    /// enough that keeping this in Swift beats a schema migration for two rows.
    var features: [String] {
        switch name {
        case "receptionist":
            return [
                "Flynn answers your calls and books the job",
                "Everything in Flynn Link",
            ]
        case "link":
            return [
                "Missed-call booking link sent automatically",
                // Deliberately not "with photos": there is no way to attach a
                // photo to an invoice from iOS today, and this string is sold
                // on both the paywall and the onboarding pricing step.
                "Invoices and quotes, drafted by voice",
                "Chased automatically until they're paid",
            ]
        default:
            return []
        }
    }
    // Legacy alias — callers that used priceAudCents get cents approximation
    var priceAudCents: Int { Int(priceMonthlyAud * 100) }

    enum CodingKeys: String, CodingKey {
        case id
        case name
        case displayName      = "display_name"
        case appleProductId   = "apple_product_id"
        case priceMonthlyAud  = "price_monthly_aud"
        case aiMinutesMonthly = "ai_minutes_monthly"
        case includesVoiceClone = "includes_voice_clone"
        case isActive         = "is_active"
    }
}
