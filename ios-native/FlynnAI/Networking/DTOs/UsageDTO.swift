import Foundation

/// Row returned by `public.v_current_usage` — joined summary of the user's
/// current billing period consumption. All fields are nullable because a user
/// without an active subscription still appears in the view (as a left join).
struct UsageDTO: Codable, Hashable, Sendable {
    let userId: UUID
    let planId: UUID?
    let planSlug: String?
    let planName: String?
    let aiMinutesMonthly: Int
    let subscriptionStatus: String?
    let trialEndAt: Date?
    let currentPeriodStart: Date?
    let currentPeriodEnd: Date?
    let aiMinutesUsed: Double
    let smsLinkCalls: Int
    let fallbackCalls: Int

    enum CodingKeys: String, CodingKey {
        case userId = "user_id"
        case planId = "plan_id"
        case planSlug = "plan_slug"
        case planName = "plan_name"
        case aiMinutesMonthly = "ai_minutes_monthly"
        case subscriptionStatus = "subscription_status"
        case trialEndAt = "trial_end_at"
        case currentPeriodStart = "current_period_start"
        case currentPeriodEnd = "current_period_end"
        case aiMinutesUsed = "ai_minutes_used"
        case smsLinkCalls = "sms_link_calls"
        case fallbackCalls = "fallback_calls"
    }

    var hasSubscription: Bool {
        guard let status = subscriptionStatus else { return false }
        return ["trialing", "active", "grace_period"].contains(status)
    }

    var usageFraction: Double {
        guard aiMinutesMonthly > 0 else { return 0 }
        return min(aiMinutesUsed / Double(aiMinutesMonthly), 1.0)
    }

    var remainingMinutes: Int {
        max(aiMinutesMonthly - Int(aiMinutesUsed.rounded()), 0)
    }
}
