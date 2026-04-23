import Foundation

/// Per-user active subscription row. Apple is source of truth; backend webhook writes this.
struct SubscriptionDTO: Codable, Identifiable, Hashable, Sendable {
    let id: UUID
    let userId: UUID
    let planId: UUID
    let status: String
    let trialEndAt: Date?
    let currentPeriodStart: Date
    let currentPeriodEnd: Date
    let appleOriginalTransactionId: String?
    let appleLatestTransactionId: String?
    let cancelledAt: Date?
    let updatedAt: Date

    enum CodingKeys: String, CodingKey {
        case id
        case userId = "user_id"
        case planId = "plan_id"
        case status
        case trialEndAt = "trial_end_at"
        case currentPeriodStart = "current_period_start"
        case currentPeriodEnd = "current_period_end"
        case appleOriginalTransactionId = "apple_original_transaction_id"
        case appleLatestTransactionId = "apple_latest_transaction_id"
        case cancelledAt = "cancelled_at"
        case updatedAt = "updated_at"
    }

    enum Status: String {
        case trialing, active, gracePeriod = "grace_period", expired, cancelled, refunded
    }

    var parsedStatus: Status? { Status(rawValue: status) }

    var isEntitled: Bool {
        guard let s = parsedStatus else { return false }
        return s == .trialing || s == .active || s == .gracePeriod
    }
}
