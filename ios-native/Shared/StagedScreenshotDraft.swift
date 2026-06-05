import Foundation

/// A capture staged by the screenshot `ScreenshotDraftIntent` (app process) for the
/// keyboard extension to pick up on its next appearance. Written to the App Group as
/// a single JSON blob so the hand-off is atomic across processes.
///
/// The intent runs on a tight background budget, so it never blocks: on success it
/// stages finished `drafts`; if the draft call can't run it stages the OCR'd
/// `messages` with `needsDraft = true` and the keyboard generates them instead.
struct StagedScreenshotDraft: Codable, Sendable {
    /// The OCR'd customer message(s) extracted from the screenshot.
    let messages: [String]
    /// Finished replies. Empty when `needsDraft` or `limitReached`.
    let drafts: [String]
    /// Always "screenshot" — tags pick-logging so the backend learns by source.
    let source: String
    let capturedAt: Date
    /// Set once the keyboard has shown this capture so a re-appear can't replay it.
    var consumed: Bool
    /// The keyboard should call the draft API itself (token/network was unavailable).
    let needsDraft: Bool
    /// The free-tier daily cap was hit (HTTP 402); the keyboard shows the limit copy.
    let limitReached: Bool

    init(
        messages: [String],
        drafts: [String] = [],
        source: String = "screenshot",
        capturedAt: Date = Date(),
        consumed: Bool = false,
        needsDraft: Bool = false,
        limitReached: Bool = false
    ) {
        self.messages = messages
        self.drafts = drafts
        self.source = source
        self.capturedAt = capturedAt
        self.consumed = consumed
        self.needsDraft = needsDraft
        self.limitReached = limitReached
    }
}
