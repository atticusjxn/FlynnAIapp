import Foundation

/// Per-thread rolling context window. Accumulates customer messages for up to
/// `windowSeconds` (default 10 minutes). Mimics iOS SharedStore thread logic
/// without the App Group — all in-process, not shared with a keyboard extension.
///
/// Thread-safe via a serial dispatch queue.
final class ConversationBuffer: @unchecked Sendable {
    static let shared = ConversationBuffer()

    private struct Entry {
        let message: String
        let timestamp: Date
    }

    private var threads: [String: [Entry]] = [:]
    private let queue = DispatchQueue(label: "com.flynnai.desktop.convbuffer")

    /// How long accumulated messages stay in the buffer for a thread.
    let windowSeconds: TimeInterval

    init(windowSeconds: TimeInterval = 600) {
        self.windowSeconds = windowSeconds
    }

    /// Append a message to a named thread buffer.
    func append(message: String, to threadKey: String) {
        queue.sync {
            let entry = Entry(message: message, timestamp: Date())
            threads[threadKey, default: []].append(entry)
            pruneExpired(for: threadKey)
        }
    }

    /// All non-expired messages in a thread, oldest first.
    func messages(for threadKey: String) -> [String] {
        queue.sync {
            pruneExpired(for: threadKey)
            return threads[threadKey]?.map(\.message) ?? []
        }
    }

    /// Clear a thread's buffer (e.g., after a draft is inserted).
    func reset(threadKey: String) {
        queue.sync { threads[threadKey] = nil }
    }

    /// Remove all entries older than `windowSeconds` from a thread.
    private func pruneExpired(for threadKey: String) {
        let cutoff = Date().addingTimeInterval(-windowSeconds)
        threads[threadKey] = threads[threadKey]?.filter { $0.timestamp > cutoff }
        if threads[threadKey]?.isEmpty == true { threads[threadKey] = nil }
    }
}
