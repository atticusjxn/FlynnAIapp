import Foundation

/// The result of a successful accessibility or browser capture.
struct ConversationContext: Sendable {
    enum SourceType: String, Sendable {
        case native      // AXUIElement read from a native app
        case browser     // DOM read via Chrome extension
        case iMessage    // Pre-drafted from iMessage lane
    }

    let appName: String
    let messages: [String]
    let sourceType: SourceType
    /// The bundle ID of the source app (nil for browser/iMessage sources).
    let sourceBundleID: String?
    /// For iMessage pre-drafts: the thread identifier used to look up cached drafts.
    let threadIdentifier: String?

    var isEmpty: Bool { messages.isEmpty }

    init(
        appName: String,
        messages: [String],
        sourceType: SourceType,
        sourceBundleID: String? = nil,
        threadIdentifier: String? = nil
    ) {
        self.appName = appName
        self.messages = messages.map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
        self.sourceType = sourceType
        self.sourceBundleID = sourceBundleID
        self.threadIdentifier = threadIdentifier
    }
}
