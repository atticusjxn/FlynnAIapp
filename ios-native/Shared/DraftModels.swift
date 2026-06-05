import Foundation

/// Wire models shared by the app and keyboard for the drafting endpoints.
struct DraftRequest: Encodable {
    let messages: [String]
    let draftCount: Int?
    let proposedSlots: [String]?
    /// Where the customer messages came from: "clipboard" (copy→keyboard) or
    /// "screenshot" (gesture capture). Used for analytics only; optional/back-compatible.
    let source: String?

    init(messages: [String], draftCount: Int? = 4, proposedSlots: [String]? = nil, source: String? = nil) {
        self.messages = messages
        self.draftCount = draftCount
        self.proposedSlots = proposedSlots
        self.source = source
    }
}

struct DraftResponse: Decodable {
    let drafts: [String]
}

/// Records which draft the user inserted, plus the full candidate set and pick
/// index so the backend can learn substance preferences (not just voice). All
/// fields except `text` are optional to keep the clipboard path back-compatible.
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
