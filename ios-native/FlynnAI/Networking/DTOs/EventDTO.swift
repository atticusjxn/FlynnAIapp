import Foundation

// Mirrors the `jobs` table used by JobsContext in the RN app.
// Extend as we port screens; keep property names aligned with the Postgres columns
// so PostgREST decoding "just works."
struct EventDTO: Identifiable, Codable, Hashable, Sendable {
    let id: UUID
    let clientName: String?
    let serviceType: String?
    let status: String?
    let scheduledDate: Date?
    let scheduledTime: String?
    let location: String?
    let notes: String?
    let createdAt: Date?

    enum CodingKeys: String, CodingKey {
        case id
        case clientName = "client_name"
        case serviceType = "service_type"
        case status
        case scheduledDate = "scheduled_date"
        case scheduledTime = "scheduled_time"
        case location
        case notes
        case createdAt = "created_at"
    }
}
