import Foundation

/// One thing Flynn remembers about a customer/property/job. Mirrors a
/// `customer_context` row returned by `/api/memory`.
struct MemoryFact: Decodable, Identifiable, Equatable {
    let id: UUID
    let subjectLabel: String?
    let subjectHandle: String?
    let fact: String
    let confidence: Double?
    let status: String
    let source: String?
    /// Raw ISO timestamp; we only need it for stable ordering, not display.
    let createdAt: String?

    enum CodingKeys: String, CodingKey {
        case id, fact, confidence, status, source
        case subjectLabel = "subject_label"
        case subjectHandle = "subject_handle"
        case createdAt = "created_at"
    }

    var isUnconfirmed: Bool { status == "unconfirmed" }
    /// Display name for the subject this fact is about.
    var subjectTitle: String { (subjectLabel?.isEmpty == false ? subjectLabel : nil) ?? "General" }
}
