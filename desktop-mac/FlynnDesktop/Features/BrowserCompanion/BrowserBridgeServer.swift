import Network
import Foundation

/// A lightweight WebSocket server on 127.0.0.1:9741.
/// The Chrome/Edge extension connects here and exchanges JSON messages
/// so the desktop app can request conversation text from the active tab.
@MainActor
final class BrowserBridgeServer: @unchecked Sendable {
    static let shared = BrowserBridgeServer()

    private var listener: NWListener?
    private var connections: [NWConnection] = []
    private(set) var isExtensionConnected = false

    /// Called when the extension sends a conversation capture.
    var onConversationReceived: ((ConversationContext) -> Void)?

    private init() {}

    // MARK: - Lifecycle

    func start() {
        let params = NWParameters.tcp
        params.allowLocalEndpointReuse = true

        guard let port = NWEndpoint.Port(rawValue: 9741) else { return }
        guard let l = try? NWListener(using: params, on: port) else { return }
        listener = l

        l.stateUpdateHandler = { [weak self] state in
            switch state {
            case .ready: break
            case .failed(let err): print("[BrowserBridge] listener failed: \(err)")
            default: break
            }
        }

        l.newConnectionHandler = { [weak self] connection in
            Task { @MainActor in self?.handleNewConnection(connection) }
        }

        l.start(queue: .global(qos: .utility))
    }

    func stop() {
        listener?.cancel()
        listener = nil
        connections.forEach { $0.cancel() }
        connections.removeAll()
        isExtensionConnected = false
    }

    // MARK: - Request conversation from active tab

    func requestConversation() {
        let msg = BrowserOutgoingMessage(type: .requestConversation)
        guard let data = try? JSONEncoder().encode(msg) else { return }
        let frame = makeWebSocketFrame(data: data)
        connections.forEach { $0.send(content: frame, completion: .idempotent) }
    }

    // MARK: - Connection handling

    private func handleNewConnection(_ connection: NWConnection) {
        connections.append(connection)
        isExtensionConnected = true

        connection.stateUpdateHandler = { [weak self, weak connection] state in
            if case .cancelled = state, let conn = connection {
                Task { @MainActor in
                    self?.connections.removeAll { $0 === conn }
                    self?.isExtensionConnected = !(self?.connections.isEmpty ?? true)
                }
            }
        }

        connection.start(queue: .global(qos: .utility))
        receiveNext(from: connection)
    }

    private nonisolated func receiveNext(from connection: NWConnection) {
        connection.receive(minimumIncompleteLength: 1, maximumLength: 65536) { [weak self] data, _, isComplete, error in
            if let data, !data.isEmpty {
                Task { @MainActor in self?.handleFrame(data, from: connection) }
            }
            if !isComplete, error == nil {
                self?.receiveNext(from: connection)
            }
        }
    }

    private func handleFrame(_ data: Data, from connection: NWConnection) {
        // Strip WebSocket framing (minimal parser for text frames)
        let payload = extractWebSocketPayload(data) ?? data
        guard let msg = try? JSONDecoder().decode(BrowserIncomingMessage.self, from: payload) else { return }

        Task { @MainActor in
            switch msg.type {
            case .conversation:
                let messages = msg.messages ?? []
                let site = msg.sourceSite ?? "browser"
                guard !messages.isEmpty else { return }
                let context = ConversationContext(
                    appName: site.capitalized,
                    messages: messages,
                    sourceType: .browser
                )
                self.onConversationReceived?(context)

            case .status:
                break

            case .requestConversation:
                break
            }
        }
    }

    // MARK: - Minimal WebSocket frame helpers

    private func makeWebSocketFrame(data: Data) -> Data {
        var frame = Data()
        frame.append(0x81) // FIN + text frame opcode
        let length = data.count
        if length < 126 {
            frame.append(UInt8(length))
        } else if length < 65536 {
            frame.append(0x7E)
            frame.append(UInt8((length >> 8) & 0xFF))
            frame.append(UInt8(length & 0xFF))
        }
        frame.append(contentsOf: data)
        return frame
    }

    private func extractWebSocketPayload(_ data: Data) -> Data? {
        guard data.count >= 2 else { return nil }
        let opcode = data[0] & 0x0F
        guard opcode == 0x01 || opcode == 0x02 else { return nil } // text or binary

        var offset = 1
        var payloadLength = Int(data[offset] & 0x7F)
        let masked = (data[offset] & 0x80) != 0
        offset += 1

        if payloadLength == 126 {
            guard data.count >= offset + 2 else { return nil }
            payloadLength = (Int(data[offset]) << 8) | Int(data[offset + 1])
            offset += 2
        }

        if masked {
            guard data.count >= offset + 4 + payloadLength else { return nil }
            let mask = Array(data[offset..<offset+4])
            offset += 4
            var payload = Data(data[offset..<offset + payloadLength])
            for i in 0..<payload.count { payload[i] ^= mask[i % 4] }
            return payload
        } else {
            guard data.count >= offset + payloadLength else { return nil }
            return Data(data[offset..<offset + payloadLength])
        }
    }
}
