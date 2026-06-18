import AppKit
import EventKit

/// EventKit wrapper for creating booking events on macOS.
/// API is identical to the iOS AppleCalendarService — direct port.
final class CalendarService: @unchecked Sendable {
    static let shared = CalendarService()

    enum CalendarError: Error, LocalizedError {
        case accessDenied, noEventCalendar, eventNotFound

        var errorDescription: String? {
            switch self {
            case .accessDenied: return "Calendar access is disabled in System Settings"
            case .noEventCalendar: return "No writable calendar is configured"
            case .eventNotFound: return "Calendar event no longer exists"
            }
        }
    }

    private let store = EKEventStore()
    private init() {}

    // MARK: - Authorization

    var isAuthorized: Bool {
        EKEventStore.authorizationStatus(for: .event) == .fullAccess ||
        EKEventStore.authorizationStatus(for: .event) == .authorized
    }

    func requestAccess() async throws -> Bool {
        switch EKEventStore.authorizationStatus(for: .event) {
        case .authorized, .fullAccess: return true
        case .denied, .restricted: throw CalendarError.accessDenied
        case .notDetermined, .writeOnly:
            return try await store.requestFullAccessToEvents()
        @unknown default:
            return try await store.requestFullAccessToEvents()
        }
    }

    static func openSystemSettings() {
        if let url = URL(string: "x-apple.systempreferences:com.apple.preference.security?Privacy_Calendars") {
            NSWorkspace.shared.open(url)
        }
    }

    // MARK: - Create / delete events

    @discardableResult
    func createEvent(
        title: String,
        startDate: Date,
        durationMinutes: Int = 60,
        location: String? = nil,
        notes: String? = nil
    ) async throws -> String {
        guard try await requestAccess() else { throw CalendarError.accessDenied }
        guard let calendar = store.defaultCalendarForNewEvents else {
            throw CalendarError.noEventCalendar
        }
        let event = EKEvent(eventStore: store)
        event.calendar = calendar
        event.title = title
        event.startDate = startDate
        event.endDate = startDate.addingTimeInterval(TimeInterval(durationMinutes * 60))
        if let loc = location { event.location = loc }
        if let n = notes { event.notes = n }
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

    // MARK: - Fetch events for slot finding

    func fetchEvents(from start: Date, to end: Date) async throws -> [EKEvent] {
        guard try await requestAccess() else { throw CalendarError.accessDenied }
        let predicate = store.predicateForEvents(withStart: start, end: end, calendars: nil)
        return store.events(matching: predicate)
    }
}
