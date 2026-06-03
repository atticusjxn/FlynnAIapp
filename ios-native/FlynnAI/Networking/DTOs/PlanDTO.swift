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
    var features: [String] { [] }
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
