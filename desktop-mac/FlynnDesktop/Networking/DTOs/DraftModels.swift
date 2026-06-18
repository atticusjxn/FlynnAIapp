import Foundation

/// Wire models for the drafting endpoints. Identical to the iOS version.
struct DraftRequest: Encodable {
    let messages: [String]
    let draftCount: Int?
    let proposedSlots: [String]?
    /// Where messages came from: "accessibility", "browser", "imessage_lane".
    let source: String?

    init(
        messages: [String],
        draftCount: Int? = 3,
        proposedSlots: [String]? = nil,
        source: String? = nil
    ) {
        self.messages = messages
        self.draftCount = draftCount
        self.proposedSlots = proposedSlots
        self.source = source
    }
}

struct DraftResponse: Decodable {
    let drafts: [String]
}

struct AcceptDraftRequest: Encodable {
    let text: String
    let candidates: [String]?
    let pickedIndex: Int?
    let source: String?
    let messages: [String]?

    init(
        text: String,
        candidates: [String]? = nil,
        pickedIndex: Int? = nil,
        source: String? = nil,
        messages: [String]? = nil
    ) {
        self.text = text
        self.candidates = candidates
        self.pickedIndex = pickedIndex
        self.source = source
        self.messages = messages
    }
}

struct FreeBusyRequest: Encodable {
    let windowDays: Int
    let timezone: String
}

struct FreeBusyResponse: Decodable {
    let slots: [String]
}
