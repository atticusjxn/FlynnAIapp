import Foundation

struct ClientDTO: Identifiable, Codable, Hashable, Sendable {
    let id: UUID
    let userId: UUID?
    let name: String
    let phone: String?
    let email: String?
    let address: String?
    let notes: String?
    let businessType: String?
    let preferredContactMethod: String?
    let totalJobs: Int?
    let lastJobDate: Date?
    let lastJobType: String?
    let createdAt: Date?
    let updatedAt: Date?

    enum CodingKeys: String, CodingKey {
        case id
        case userId = "user_id"
        case name
        case phone
        case email
        case address
        case notes
        case businessType = "business_type"
        case preferredContactMethod = "preferred_contact_method"
        case totalJobs = "total_jobs"
        case lastJobDate = "last_job_date"
        case lastJobType = "last_job_type"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}
