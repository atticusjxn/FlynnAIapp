import Foundation

/// Wire models shared by the app and keyboard for the drafting endpoints.
struct DraftRequest: Encodable {
    let messages: [String]
    let draftCount: Int?
    let proposedSlots: [String]?

    init(messages: [String], draftCount: Int? = 4, proposedSlots: [String]? = nil) {
        self.messages = messages
        self.draftCount = draftCount
        self.proposedSlots = proposedSlots
    }
}

struct DraftResponse: Decodable {
    let drafts: [String]
}

struct AcceptDraftRequest: Encodable {
    let text: String
}
