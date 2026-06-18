import SwiftUI

/// Picks up a booking the keyboard staged (an agreed, calendar-verified time) and
/// — only after the user confirms — writes it to their Apple Calendar. The
/// keyboard/intent sandboxes can't touch EventKit, so the write always lands here,
/// in the foreground app. Nothing is ever written silently.
@MainActor
@Observable
final class PendingCalendarStore {
    enum WriteState: Equatable {
        case idle
        case writing
        case written
        case failed(String)
    }

    /// The booking awaiting confirmation. Drives the confirm sheet (Identifiable).
    var pending: PendingCalendarEvent?
    var writeState: WriteState = .idle

    private let calendar = AppleCalendarService()

    /// Read any staged booking. Call on app foreground / the calendar deep link.
    /// Won't interrupt a confirm already on screen.
    func checkForPending() {
        guard pending == nil else { return }
        guard let event = SharedStore.freshPendingCalendarEvent() else { return }
        writeState = .idle
        pending = event
    }

    /// Present an event that came from somewhere other than the App Group (e.g. a
    /// voice command) using the same confirm card.
    func present(event: PendingCalendarEvent) {
        writeState = .idle
        pending = event
    }

    /// Write the pending booking after the user taps Add. Surfaces a contextual
    /// permission prompt the first time (the write is user-initiated, never silent).
    func confirm() async {
        guard let event = pending, let start = event.startDate else {
            dismiss()
            return
        }
        writeState = .writing
        do {
            var notes: [String] = []
            if let customer = event.customer, !customer.isEmpty { notes.append("Customer: \(customer)") }
            notes.append("Booked with Flynn")
            let eventId = try await calendar.createEvent(
                title: event.title,
                start: start,
                durationMinutes: event.durationMin,
                location: event.location,
                notes: notes.joined(separator: "\n")
            )
            SharedStore.markPendingCalendarEventConsumed()
            writeState = .written
            // Confirmation notification + mirror it into the Bookings list. Both
            // best-effort — the calendar write already succeeded.
            await LocalNotifier.calendarAdded(title: event.title, at: start)
            await persistJob(event: event, start: start, calendarEventId: eventId)
        } catch let error as AppleCalendarService.CalendarError {
            writeState = .failed(error.errorDescription ?? "Couldn't add it to your calendar.")
        } catch {
            writeState = .failed("Couldn't add it to your calendar.")
        }
    }

    /// Mirror a confirmed booking into the Bookings/jobs list with a back-reference
    /// to the Apple Calendar event. Best-effort — failures never undo the calendar
    /// write the user just confirmed.
    private func persistJob(event: PendingCalendarEvent, start: Date, calendarEventId: String) async {
        let timeFormatter = DateFormatter()
        timeFormatter.locale = .current
        timeFormatter.dateFormat = "h:mm a"
        let input = EventInput(
            clientName: event.customer,
            serviceType: event.title,
            status: "scheduled",
            scheduledDate: start,
            scheduledTime: timeFormatter.string(from: start),
            location: event.location,
            notes: "Booked with Flynn"
        )
        do {
            let job = try await EventsRepository().insert(input)
            struct JobCalendarPatch: Encodable { let apple_calendar_event_id: String }
            _ = try? await FlynnSupabase.client
                .from("jobs")
                .update(JobCalendarPatch(apple_calendar_event_id: calendarEventId))
                .eq("id", value: job.id.uuidString)
                .execute()
        } catch {
            // Calendar event is written; the Bookings mirror is a nice-to-have.
        }
    }

    /// User dismissed or finished — clear and mark consumed so it won't reappear.
    func dismiss() {
        SharedStore.markPendingCalendarEventConsumed()
        pending = nil
        writeState = .idle
    }

    /// Called after the sheet closes (incl. a swipe-down that bypasses the buttons)
    /// so a staged booking is never re-offered. Idempotent.
    func handleSheetDismissed() {
        SharedStore.markPendingCalendarEventConsumed()
        writeState = .idle
    }
}
