import Foundation

/// A calendar booking the backend detected as genuinely-free and agreed in a
/// conversation, staged by the keyboard (App Group) for the MAIN APP to write to
/// the user's calendar. The keyboard and the screenshot intent both run in
/// sandboxes that cannot touch EventKit — only the foreground app can — so the
/// hand-off mirrors `StagedScreenshotDraft`: write atomically, pick up on the
/// app's next foreground.
///
/// The user always confirms before anything is written; nothing is ever booked
/// silently.
struct PendingCalendarEvent: Codable, Sendable, Identifiable {
    let id: UUID
    let title: String
    /// ISO8601 instant (e.g. "2025-06-03T04:00:00.000Z"). Absolute, so it writes
    /// at the correct moment regardless of device timezone.
    let startISO: String
    let durationMin: Int
    let location: String?
    let customer: String?
    let createdAt: Date
    /// Set once the app has shown/handled it so a re-foreground can't replay it.
    var consumed: Bool

    init(
        id: UUID = UUID(),
        title: String,
        startISO: String,
        durationMin: Int,
        location: String? = nil,
        customer: String? = nil,
        createdAt: Date = Date(),
        consumed: Bool = false
    ) {
        self.id = id
        self.title = title
        self.startISO = startISO
        self.durationMin = durationMin
        self.location = location
        self.customer = customer
        self.createdAt = createdAt
        self.consumed = consumed
    }

    /// The parsed start instant, or nil if the ISO string is malformed.
    var startDate: Date? { PendingCalendarEvent.parseISO(startISO) }

    var endDate: Date? { startDate?.addingTimeInterval(TimeInterval(durationMin * 60)) }

    /// Parse an ISO8601 instant, tolerating both fractional-seconds and plain forms.
    static func parseISO(_ s: String) -> Date? {
        let withFraction = ISO8601DateFormatter()
        withFraction.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let d = withFraction.date(from: s) { return d }
        let plain = ISO8601DateFormatter()
        plain.formatOptions = [.withInternetDateTime]
        return plain.date(from: s)
    }
}
