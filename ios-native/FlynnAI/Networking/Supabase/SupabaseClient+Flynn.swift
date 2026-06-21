import Foundation
import Supabase

/// Shared Supabase client. The SDK caches the session internally and also lets us
/// hand it back session JSON from Keychain on cold start.
enum FlynnSupabase {
    static let client: SupabaseClient = {
        SupabaseClient(
            supabaseURL: FlynnEnv.supabaseURL,
            supabaseKey: FlynnEnv.supabaseAnonKey,
            options: SupabaseClientOptions(
                db: SupabaseClientOptions.DatabaseOptions(decoder: flexibleDateDecoder)
            )
        )
    }()
}

/// supabase-swift's default decoder only accepts ISO8601 *timestamps* and throws
/// "The data couldn't be read because it isn't in the correct format" on the
/// date-only (`yyyy-MM-dd`) strings that Postgres `date` columns return —
/// e.g. jobs.scheduled_date, invoices.issued_date/due_date. This decoder keeps
/// the SDK's exact timestamp parsing and adds a date-only fallback so those
/// screens (Bookings, Money) decode.
private let flexibleDateDecoder: JSONDecoder = {
    let decoder = JSONDecoder()

    let dateOnly = DateFormatter()
    dateOnly.calendar = Calendar(identifier: .iso8601)
    dateOnly.locale = Locale(identifier: "en_US_POSIX")
    dateOnly.timeZone = TimeZone(secondsFromGMT: 0)
    dateOnly.dateFormat = "yyyy-MM-dd"

    decoder.dateDecodingStrategy = .custom { decoder in
        let container = try decoder.singleValueContainer()
        let string = try container.decode(String.self)

        // Full timestamps — same logic as the SDK default (fractional, then whole).
        if let date = try? Date(
            string,
            strategy: .iso8601.year().month().day()
                .dateTimeSeparator(.standard).time(includingFractionalSeconds: true)
        ) {
            return date
        }
        if let date = try? Date(
            string,
            strategy: .iso8601.year().month().day()
                .dateTimeSeparator(.standard).time(includingFractionalSeconds: false)
        ) {
            return date
        }
        // Date-only columns.
        if let date = dateOnly.date(from: string) {
            return date
        }

        throw DecodingError.dataCorruptedError(
            in: container,
            debugDescription: "Invalid date format: \(string)"
        )
    }
    return decoder
}()
