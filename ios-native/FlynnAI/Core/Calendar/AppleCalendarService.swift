import Foundation
import EventKit

/// Thin wrapper around EventKit for Flynn's booking → Apple Calendar sync.
///
/// Usage:
/// ```
/// let calendar = AppleCalendarService()
/// guard try await calendar.requestAccess() else { return }
/// let eventId = try await calendar.createEvent(for: booking)
/// ```
///
/// We only write to the user's *default* calendar for new events. Users can
/// always move a Flynn-created event to a different calendar inside the
/// Calendar app without breaking our reference — we store the EKEvent's
/// `eventIdentifier` (a UUID string) in `jobs.apple_calendar_event_id` so
/// later updates/deletes still resolve correctly.
final class AppleCalendarService: @unchecked Sendable {
    enum CalendarError: Error, LocalizedError {
        case accessDenied
        case noEventCalendar
        case eventNotFound

        var errorDescription: String? {
            switch self {
            case .accessDenied: return "Calendar access is disabled in Settings"
            case .noEventCalendar: return "No writable calendar is configured"
            case .eventNotFound: return "Calendar event no longer exists"
            }
        }
    }

    private let store = EKEventStore()

    /// Requests full access to Calendar events (iOS 17+ API).
    /// Returns `true` if the user has granted access (previously or just now).
    func requestAccess() async throws -> Bool {
        let current = EKEventStore.authorizationStatus(for: .event)
        switch current {
        case .authorized, .fullAccess:
            return true
        case .denied, .restricted:
            throw CalendarError.accessDenied
        case .notDetermined, .writeOnly:
            return try await store.requestFullAccessToEvents()
        @unknown default:
            return try await store.requestFullAccessToEvents()
        }
    }

    /// Creates an event for the given booking. Returns the EKEvent identifier
    /// — store this in `jobs.apple_calendar_event_id`.
    @discardableResult
    func createEvent(for booking: BookingDTO, durationMinutes: Int = 60) async throws -> String {
        guard try await requestAccess() else { throw CalendarError.accessDenied }
        guard let calendar = store.defaultCalendarForNewEvents else {
            throw CalendarError.noEventCalendar
        }

        let event = EKEvent(eventStore: store)
        event.calendar = calendar
        event.title = booking.serviceType ?? "Flynn booking"
        event.location = booking.location

        let start = Self.composeDate(date: booking.requestedDate, time: booking.requestedTime) ?? Date()
        event.startDate = start
        event.endDate = start.addingTimeInterval(TimeInterval(durationMinutes * 60))

        var noteLines: [String] = []
        if let name = booking.callerName { noteLines.append("Client: \(name)") }
        if let phone = booking.callerPhone { noteLines.append("Phone: \(phone)") }
        if let email = booking.callerEmail { noteLines.append("Email: \(email)") }
        if let existing = booking.notes { noteLines.append(existing) }
        event.notes = noteLines.joined(separator: "\n")

        try store.save(event, span: .thisEvent, commit: true)
        return event.eventIdentifier
    }

    func deleteEvent(identifier: String) async throws {
        guard try await requestAccess() else { throw CalendarError.accessDenied }
        guard let event = store.event(withIdentifier: identifier) else {
            throw CalendarError.eventNotFound
        }
        try store.remove(event, span: .thisEvent, commit: true)
    }

    // MARK: Helpers

    /// Combine a `Date` (treated as midnight in the user's calendar) with a
    /// loose time string like "2:30 PM" or "14:30". If time parsing fails, we
    /// fall back to the start of day.
    private static func composeDate(date: Date?, time: String?) -> Date? {
        guard let date else { return nil }
        guard let time, !time.isEmpty else { return date }

        let formatters: [DateFormatter] = [
            {
                let f = DateFormatter()
                f.dateFormat = "h:mm a"
                f.locale = Locale(identifier: "en_US_POSIX")
                return f
            }(),
            {
                let f = DateFormatter()
                f.dateFormat = "HH:mm"
                f.locale = Locale(identifier: "en_US_POSIX")
                return f
            }(),
        ]

        for formatter in formatters {
            if let parsedTime = formatter.date(from: time) {
                let cal = Calendar.current
                let timeParts = cal.dateComponents([.hour, .minute], from: parsedTime)
                return cal.date(bySettingHour: timeParts.hour ?? 0,
                                minute: timeParts.minute ?? 0,
                                second: 0,
                                of: date)
            }
        }
        return date
    }
}
