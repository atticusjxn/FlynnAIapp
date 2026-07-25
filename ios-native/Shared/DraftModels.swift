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

/// An agreed, calendar-verified booking the backend surfaces alongside drafts so
/// the keyboard can offer a one-tap "add to calendar". Present only when the
/// customer named a time that's genuinely free in the owner's real calendar.
struct AgreedEvent: Decodable {
    let title: String
    let startISO: String
    let durationMin: Int
    let location: String?
    let customer: String?
}

struct DraftResponse: Decodable {
    let drafts: [String]
    /// Optional/back-compatible: null or absent when no firm time was agreed.
    let agreedEvent: AgreedEvent?
}

/// What the draft client hands back: the reply options plus an optional booking.
struct DraftResult {
    let drafts: [String]
    let agreedEvent: AgreedEvent?
}

// MARK: - Quick context (chips)

/// One open invoice the keyboard can offer as a one-tap pay-link insert.
/// `insertText` is composed server-side so the extension does no formatting.
struct QuickInvoice: Codable {
    let clientName: String?
    let amountLabel: String
    let status: String?
    let payUrl: String
    let insertText: String
}

/// One priced service the keyboard can offer as a one-tap rate insert.
struct QuickRate: Codable {
    let label: String
    let insertText: String
}

/// Everything the chips row needs, fetched in one no-LLM call and cached in the
/// App Group so chips render instantly on the keyboard's frequent relaunches.
struct QuickContext: Codable {
    let invoices: [QuickInvoice]
    let slots: [String]
    /// Ready-to-insert prose for the free-slots chip; nil when no calendar.
    let slotsInsertText: String?
    let rates: [QuickRate]

    static let empty = QuickContext(invoices: [], slots: [], slotsInsertText: nil, rates: [])

    /// True when there is nothing worth showing a chip for.
    var isEmpty: Bool {
        invoices.isEmpty && slotsInsertText == nil && rates.isEmpty
    }
}

// MARK: - Compose (typed shorthand -> send-ready text)

struct ComposeRequest: Encodable {
    let text: String
    let candidateCount: Int?

    init(text: String, candidateCount: Int? = 3) {
        self.text = text
        self.candidateCount = candidateCount
    }
}

struct ComposeResponse: Decodable {
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
