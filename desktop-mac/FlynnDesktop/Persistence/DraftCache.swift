import Foundation

/// Short-lived in-memory cache for pre-drafted replies (iMessage power lane).
/// Keyed by `threadIdentifier + ":" + latestMessageROWID`.
final class DraftCache: @unchecked Sendable {
    static let shared = DraftCache()

    private struct Entry {
        let drafts: [String]
        let timestamp: Date
    }

    private var cache: [String: Entry] = [:]
    private let queue = DispatchQueue(label: "com.flynnai.desktop.draftcache")
    private let ttl: TimeInterval = 300 // 5 minutes

    init() {}

    func store(drafts: [String], threadID: String) {
        queue.sync {
            cache[threadID] = Entry(drafts: drafts, timestamp: Date())
        }
    }

    func get(threadID: String) -> [String]? {
        queue.sync {
            guard let entry = cache[threadID] else { return nil }
            if Date().timeIntervalSince(entry.timestamp) > ttl {
                cache.removeValue(forKey: threadID)
                return nil
            }
            return entry.drafts
        }
    }

    func invalidate(threadID: String) {
        queue.sync { _ = cache.removeValue(forKey: threadID) }
    }

    func purgeExpired() {
        queue.sync {
            let now = Date()
            cache = cache.filter { now.timeIntervalSince($0.value.timestamp) <= ttl }
        }
    }
}
