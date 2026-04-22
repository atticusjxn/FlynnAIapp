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
        self.status = dto.status ?? "pending"
        self.scheduledDate = dto.scheduledDate
        self.scheduledTime = dto.scheduledTime
        self.location = dto.location
        self.notes = dto.notes
    }

    static var newDraft: EventInput {
        EventInput(
            clientName: nil,
            serviceType: nil,
            status: "pending",
            scheduledDate: nil,
            scheduledTime: nil,
            location: nil,
            notes: nil
        )
    }
}

enum EventStatus: String, CaseIterable, Identifiable {
    case pending
    case inProgress = "in-progress"
    case complete

    var id: String { rawValue }

    var label: String {
        switch self {
        case .pending: return "Pending"
        case .inProgress: return "In Progress"
        case .complete: return "Complete"
        }
    }
}
