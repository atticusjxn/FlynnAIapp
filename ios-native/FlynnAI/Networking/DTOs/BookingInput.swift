import Foundation

/// Create payload for `bookings`. Typically used when the user adds a booking
/// manually from the UI; server-originated rows (SMS link flow, AI agent) are
/// written by the backend using the service role.
struct BookingInput: Codable, Sendable {
    var source: String
    var sourceCallId: UUID?
    var callerName: String?
    var callerPhone: String?
    var callerEmail: String?
    var serviceType: String?
    var requestedDate: Date?
    var requestedTime: String?
    var location: String?
    var notes: String?
    var photos: [String]
    var status: String

    enum CodingKeys: String, CodingKey {
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
    }
}
