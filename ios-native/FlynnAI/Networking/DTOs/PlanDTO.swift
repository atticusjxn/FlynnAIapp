import Foundation

/// Sellable plan catalog row. Mirrors `public.plans`.
struct PlanDTO: Codable, Identifiable, Hashable, Sendable {
    let id: UUID
    let slug: String
    let displayName: String
    let appleProductId: String?
    let priceAudCents: Int
    let aiMinutesMonthly: Int
    let seats: Int
    let includesVoiceClone: Bool
    let features: [String]
    let isActive: Bool
    let sortOrder: Int

    enum CodingKeys: String, CodingKey {
        case id, slug
        case displayName = "display_name"
        case appleProductId = "apple_product_id"
        case priceAudCents = "price_aud_cents"
        case aiMinutesMonthly = "ai_minutes_monthly"
        case seats
        case includesVoiceClone = "includes_voice_clone"
        case features
        case isActive = "is_active"
        case sortOrder = "sort_order"
    }
}
