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
    // Added by the payments-first org-spine migration (20260718000000). A job
    // may have a linked `clients` row (clientId) in addition to the free-text
    // clientName above — the text field is what's shown/edited today; the FK
    // is what JobDetailView's client-link section resolves against.
    let clientId: UUID?
    let title: String?
    let scheduledAt: Date?

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
        case clientId = "client_id"
        case title
        case scheduledAt = "scheduled_at"
    }
}
