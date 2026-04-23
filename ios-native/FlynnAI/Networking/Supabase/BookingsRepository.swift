import Foundation
import Supabase

/// Triage API for inbound bookings. Status changes + conversion to a job row.
protocol BookingsRepositoryType: Sendable {
    func list(status: BookingDTO.Status?, limit: Int) async throws -> [BookingDTO]
    func fetch(id: UUID) async throws -> BookingDTO
    func insert(_ input: BookingInput) async throws -> BookingDTO
    func setStatus(id: UUID, status: BookingDTO.Status) async throws -> BookingDTO
    /// Converts the booking into a `jobs` row and marks the booking as
    /// `converted_to_job` with a back-reference. Returns the created job id.
    func convertToJob(bookingId: UUID) async throws -> (booking: BookingDTO, jobId: UUID)
    func delete(id: UUID) async throws
}

final class BookingsRepository: BookingsRepositoryType {
    private let client: SupabaseClient

    init(client: SupabaseClient = FlynnSupabase.client) {
        self.client = client
    }

    func list(status: BookingDTO.Status? = nil, limit: Int = 50) async throws -> [BookingDTO] {
        var query = client.from("bookings").select()
        if let status {
            query = query.eq("status", value: status.rawValue)
        }
        return try await query
            .order("created_at", ascending: false)
            .limit(limit)
            .execute()
            .value
    }

    func fetch(id: UUID) async throws -> BookingDTO {
        try await client
            .from("bookings")
            .select()
            .eq("id", value: id.uuidString)
            .single()
            .execute()
            .value
    }

    func insert(_ input: BookingInput) async throws -> BookingDTO {
        try await client
            .from("bookings")
            .insert(input, returning: .representation)
            .select()
            .single()
            .execute()
            .value
    }

    func setStatus(id: UUID, status: BookingDTO.Status) async throws -> BookingDTO {
        struct StatusPatch: Encodable { let status: String }
        return try await client
            .from("bookings")
            .update(StatusPatch(status: status.rawValue), returning: .representation)
            .eq("id", value: id.uuidString)
            .select()
            .single()
            .execute()
            .value
    }

    func convertToJob(bookingId: UUID) async throws -> (booking: BookingDTO, jobId: UUID) {
        let booking = try await fetch(id: bookingId)

        // Build a job row from the booking's fields.
        let jobInput = EventInput(
            clientName: booking.callerName,
            serviceType: booking.serviceType,
            status: "pending",
            scheduledDate: booking.requestedDate,
            scheduledTime: booking.requestedTime,
            location: booking.location,
            notes: booking.notes
        )
        let job: EventDTO = try await client
            .from("jobs")
            .insert(jobInput, returning: .representation)
            .select()
            .single()
            .execute()
            .value

        // If the user opted into Apple Calendar, mirror the booking as an
        // EKEvent and back-reference the identifier so later updates/deletes
        // can find it. Failures here must not roll back the job creation.
        let calendarEventId = await Self.maybeCreateCalendarEvent(for: booking, client: client)
        if let calendarEventId {
            struct JobCalendarPatch: Encodable { let apple_calendar_event_id: String }
            _ = try? await client
                .from("jobs")
                .update(JobCalendarPatch(apple_calendar_event_id: calendarEventId))
                .eq("id", value: job.id.uuidString)
                .execute()
        }

        // Back-reference the booking to the new job and mark it converted.
        struct Patch: Encodable {
            let status: String
            let job_id: String
        }
        let updated: BookingDTO = try await client
            .from("bookings")
            .update(
                Patch(status: BookingDTO.Status.convertedToJob.rawValue, job_id: job.id.uuidString),
                returning: .representation
            )
            .eq("id", value: bookingId.uuidString)
            .select()
            .single()
            .execute()
            .value

        return (updated, job.id)
    }

    /// Check `users.apple_calendar_connected` and create an EKEvent if so.
    /// Swallows errors — calendar sync is best-effort.
    private static func maybeCreateCalendarEvent(
        for booking: BookingDTO,
        client: SupabaseClient
    ) async -> String? {
        do {
            struct Row: Decodable { let apple_calendar_connected: Bool }
            let session = try await client.auth.session
            let row: Row = try await client
                .from("users")
                .select("apple_calendar_connected")
                .eq("id", value: session.user.id.uuidString)
                .single()
                .execute()
                .value
            guard row.apple_calendar_connected else { return nil }

            let service = AppleCalendarService()
            return try await service.createEvent(for: booking)
        } catch {
            FlynnLog.network.error("Apple Calendar sync failed: \(error.localizedDescription, privacy: .public)")
            return nil
        }
    }

    func delete(id: UUID) async throws {
        try await client
            .from("bookings")
            .delete()
            .eq("id", value: id.uuidString)
            .execute()
    }
}
