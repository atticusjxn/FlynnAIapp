import Foundation

/// Inbound booking request captured from the SMS link flow, AI receptionist, or a
/// public booking page. Users triage these in the UI; confirming converts the row
/// into a `jobs` row.
struct BookingDTO: Identifiable, Codable, Hashable, Sendable {
    let id: UUID
    let userId: UUID?
    let source: String
    let sourceCallId: UUID?
    let callerName: String?
    let callerPhone: String?
    let callerEmail: String?
    let serviceType: String?
    let requestedDate: Date?
    let requestedTime: String?
    let location: String?
    let notes: String?
    let photos: [String]
    let status: String
    let jobId: UUID?
    let createdAt: Date?
    let updatedAt: Date?

    enum CodingKeys: String, CodingKey {
        case id
        case userId = "user_id"
        case source
        case sourceCallId = "source_call_id"
        case callerName = "caller_name"
        case callerPhone = "caller_phone"
        case callerEmail = "caller_email"
        case serviceType = "service_type"
        case requestedDate = "requested_date"
        case requestedTime = "requested_time"
        case location
        case notes
        case photos
        case status
        case jobId = "job_id"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }

    enum Source: String {
        case smsLinkBooking = "sms_link_booking"
        case smsLinkQuote = "sms_link_quote"
        case aiReceptionist = "ai_receptionist"
        case voicemail
        case bookingPage = "booking_page"
    }

    enum Status: String {
        case pendingReview = "pending_review"
        case confirmed
        case declined
        case convertedToJob = "converted_to_job"
    }

    var sourceEnum: Source? { Source(rawValue: source) }
    var statusEnum: Status? { Status(rawValue: status) }
}
