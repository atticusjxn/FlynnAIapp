import Foundation

/// Payload for creating and updating a job row (`jobs` table).
struct EventInput: Codable, Sendable {
    var clientName: String?
    var serviceType: String?
    var status: String
    var scheduledDate: Date?
    var scheduledTime: String?
    var location: String?
    var notes: String?

    enum CodingKeys: String, CodingKey {
        case clientName = "client_name"
        case serviceType = "service_type"
        case status
        case scheduledDate = "scheduled_date"
        case scheduledTime = "scheduled_time"
        case location
        case notes
    }
}

extension EventInput {
    init(from dto: EventDTO) {
        self.clientName = dto.clientName
        self.serviceType = dto.serviceType
        self.status = dto.status ?? "new"
        self.scheduledDate = dto.scheduledDate
        self.scheduledTime = dto.scheduledTime
        self.location = dto.location
        self.notes = dto.notes
    }

    static var newDraft: EventInput {
        EventInput(
            clientName: nil,
            serviceType: nil,
            status: "new",
            scheduledDate: nil,
            scheduledTime: nil,
            location: nil,
            notes: nil
        )
    }
}

/// Mirrors the `jobs_status_check` constraint EXACTLY.
///
/// This enum used to be `pending` / `in-progress` / `complete` — and the
/// database allows `new`, `in_progress`, `completed`, `lead`, `quoted`,
/// `scheduled`, `invoiced`, `paid`. Not one of the three matched (note the
/// hyphen), so every status write was rejected outright and changing a job's
/// status had never once worked.
///
/// Covering all eight is deliberate rather than just fixing the spelling of
/// three. `EventFormView` seeds this from the stored status and `submit()`
/// writes it back unconditionally, so any value the enum can't represent used
/// to collapse to the default — meaning that the moment the constraint stopped
/// rejecting writes, editing an invoiced or paid job's address would silently
/// reset it. A total mapping makes that impossible by construction.
enum EventStatus: String, CaseIterable, Identifiable {
    case new
    case lead
    case quoted
    case scheduled
    case inProgress = "in_progress"
    case completed
    case invoiced
    case paid

    var id: String { rawValue }

    var label: String {
        switch self {
        case .new:        return "New"
        case .lead:       return "Lead"
        case .quoted:     return "Quoted"
        case .scheduled:  return "Booked in"
        case .inProgress: return "In progress"
        case .completed:  return "Done"
        case .invoiced:   return "Invoiced"
        case .paid:       return "Paid"
        }
    }
}
