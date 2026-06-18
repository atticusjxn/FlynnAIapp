import Foundation
import EventKit

/// Finds the next N genuinely-free 1-hour slots for the user.
/// Combines EventKit (Apple Calendar) with optional Google Calendar data from the backend.
final class SlotFinder {
    static let shared = SlotFinder()
    private init() {}

    // Working hours considered when proposing slots
    private let workdayStartHour = 8
    private let workdayEndHour = 18
    private let slotDurationMinutes = 60

    // MARK: - Intent detection

    static let timeIntentPattern = try! NSRegularExpression(
        pattern: #"when|available|free|time|schedule|book|appointment|meet|slot|come|visit|can you|are you"#,
        options: .caseInsensitive
    )

    static func conversationHasTimeIntent(_ messages: [String]) -> Bool {
        let combined = messages.joined(separator: " ")
        let range = NSRange(combined.startIndex..., in: combined)
        return timeIntentPattern.firstMatch(in: combined, range: range) != nil
    }

    // MARK: - Find slots

    func nextFreeSlots(count: Int = 3, windowDays: Int = 7) async -> [String] {
        var slots: [String] = []

        // Try EventKit first
        if let eventKitSlots = try? await findViaEventKit(count: count, windowDays: windowDays) {
            slots = eventKitSlots
        }

        // Top up from backend Google Calendar if not enough
        if slots.count < count {
            if let googleSlots = try? await DraftAPIClient.freeBusySlots(windowDays: windowDays) {
                let needed = count - slots.count
                slots += Array(googleSlots.prefix(needed))
            }
        }

        return Array(slots.prefix(count))
    }

    // MARK: - EventKit slot finding

    private func findViaEventKit(count: Int, windowDays: Int) async throws -> [String] {
        guard CalendarService.shared.isAuthorized else { return [] }

        let cal = Calendar.current
        let now = Date()
        let windowEnd = cal.date(byAdding: .day, value: windowDays, to: now)!

        let events = try await CalendarService.shared.fetchEvents(from: now, to: windowEnd)

        // Build busy intervals
        let busyIntervals = events.map { ($0.startDate!, $0.endDate!) }

        // Walk forward in 1-hour increments through working hours
        var slots: [String] = []
        var candidate = nextWorkdayHour(after: now)

        while candidate < windowEnd && slots.count < count {
            let candidateEnd = candidate.addingTimeInterval(TimeInterval(slotDurationMinutes * 60))
            if !overlapsAny(start: candidate, end: candidateEnd, busyIntervals: busyIntervals) {
                slots.append(formatSlot(candidate))
            }
            candidate = candidate.addingTimeInterval(3600) // advance 1 hour
            // Skip to next morning if past workday end
            let hour = cal.component(.hour, from: candidate)
            if hour >= workdayEndHour {
                candidate = nextWorkdayHour(after: candidate)
            }
        }

        return slots
    }

    private func overlapsAny(start: Date, end: Date, busyIntervals: [(Date, Date)]) -> Bool {
        busyIntervals.contains { busyStart, busyEnd in
            start < busyEnd && end > busyStart
        }
    }

    private func nextWorkdayHour(after date: Date) -> Date {
        let cal = Calendar.current
        var components = cal.dateComponents([.year, .month, .day], from: date)
        components.hour = workdayStartHour
        components.minute = 0
        components.second = 0
        var candidate = cal.date(from: components)!
        if candidate <= date {
            candidate = cal.date(byAdding: .day, value: 1, to: candidate)!
        }
        // Skip weekends
        while cal.isDateInWeekend(candidate) {
            candidate = cal.date(byAdding: .day, value: 1, to: candidate)!
        }
        return candidate
    }

    private func formatSlot(_ date: Date) -> String {
        let cal = Calendar.current
        let formatter = DateFormatter()
        formatter.locale = Locale.current

        let isThisWeek = cal.isDate(date, equalTo: Date(), toGranularity: .weekOfYear)
        let isToday = cal.isDateInToday(date)
        let isTomorrow = cal.isDateInTomorrow(date)

        let dayPart: String
        if isToday { dayPart = "today" }
        else if isTomorrow { dayPart = "tomorrow" }
        else if isThisWeek {
            formatter.dateFormat = "EEEE" // "Wednesday"
            dayPart = formatter.string(from: date)
        } else {
            formatter.dateFormat = "EEEE d MMM"
            dayPart = formatter.string(from: date)
        }

        formatter.dateFormat = "h:mma"
        formatter.amSymbol = "am"
        formatter.pmSymbol = "pm"
        let timePart = formatter.string(from: date)
            .replacingOccurrences(of: ":00", with: "")

        return "\(dayPart) \(timePart)"
    }
}
