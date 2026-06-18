import Foundation

/// Message types exchanged between the macOS app and the Chrome/Edge extension
/// over the local WebSocket at 127.0.0.1:9741.
enum BrowserMessageType: String, Codable {
    /// App → Extension: request the active tab's conversation
    case requestConversation = "REQUEST_CONVERSATION"
    /// Extension → App: the captured conversation
    case conversation = "CONVERSATION"
    /// Extension → App: connected / disconnected status
    case status = "STATUS"
}

struct BrowserOutgoingMessage: Encodable {
    let type: BrowserMessageType
}

struct BrowserIncomingMessage: Decodable {
    let type: BrowserMessageType
    let messages: [String]?
    let sourceSite: String?
    let status: String?
}
