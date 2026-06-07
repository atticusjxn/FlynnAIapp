import Foundation

/// Decoded result of `POST /api/voice/command`. The backend transcribes the held
/// mic clip, classifies the intent, and returns the fields the matching action
/// needs. Only the fields for the chosen `intent` are populated.
struct VoiceCommandResult: Decodable, Equatable {
    let intent: String
    let transcript: String
    let summary: String?
    /// For `unknown` / "didn't catch that".
    let message: String?

    // calendar — reuses the same AgreedEvent shape as the keyboard booking.
    let event: AgreedEvent?
    let needsTime: Bool?

    // quote
    let quoteId: String?
    let quote: VoiceQuoteSummary?

    // reply
    let drafts: [String]?
    let recipient: String?

    // note
    let noteId: String?
    let note: String?
    let subject: String?

    struct VoiceQuoteSummary: Decodable, Equatable {
        let number: String?
        let title: String?
        let clientName: String?
        let total: Double?
    }
}

extension AgreedEvent: Equatable {
    static func == (lhs: AgreedEvent, rhs: AgreedEvent) -> Bool {
        lhs.startISO == rhs.startISO && lhs.title == rhs.title && lhs.durationMin == rhs.durationMin
    }
}
