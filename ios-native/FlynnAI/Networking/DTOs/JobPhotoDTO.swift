import Foundation

/// A photo in a job's persistent gallery (`job_photos` table, org-spine
/// migration 20260718000000) — distinct from `job_photo_buffer`, the transient
/// inbound landing zone for photos texted to Flynn before they're attached to
/// a job or claimed by an invoice.
///
/// Read-only from the app for now: this repository lists what the agent (or,
/// later, an in-app capture flow) has already attached to a job. Capturing a
/// NEW photo from the app (camera/library picker -> Supabase Storage upload)
/// is intentionally out of scope here — no Storage-upload pattern exists yet
/// in the Swift codebase to build on, and getting that pipeline right
/// (compression, progress, permissions) deserves its own focused pass rather
/// than being bolted on unverified alongside the notes thread.
struct JobPhotoDTO: Identifiable, Codable, Hashable, Sendable {
    let id: UUID
    let jobId: UUID
    let publicURL: String
    let uploadedBy: UUID?
    let createdAt: Date

    enum CodingKeys: String, CodingKey {
        case id
        case jobId = "job_id"
        case publicURL = "public_url"
        case uploadedBy = "uploaded_by"
        case createdAt = "created_at"
    }
}
