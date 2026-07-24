import Foundation

/// A single threaded note on a job (`job_notes` table, org-spine migration
/// 20260718000000). Append-only from the app's point of view — replaces the
/// single `jobs.notes` text field with a real thread multiple people (boss +
/// crew) can add to over time.
struct JobNoteDTO: Identifiable, Codable, Hashable, Sendable {
    let id: UUID
    let jobId: UUID
    let authorMemberId: UUID?
    let body: String
    let createdAt: Date

    enum CodingKeys: String, CodingKey {
        case id
        case jobId = "job_id"
        case authorMemberId = "author_member_id"
        case body
        case createdAt = "created_at"
    }
}

struct JobNoteInput: Codable, Sendable {
    var jobId: UUID
    /// NOT NULL on job_notes — stamped from OrgResolver.current() by the
    /// repository, same pattern as ClientsRepository.insert.
    var orgId: UUID?
    var body: String

    enum CodingKeys: String, CodingKey {
        case jobId = "job_id"
        case orgId = "org_id"
        case body
    }
}
