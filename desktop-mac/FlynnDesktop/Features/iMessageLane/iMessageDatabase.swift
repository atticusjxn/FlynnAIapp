import Foundation
import SQLite3

/// Reads the iMessage SQLite database at ~/Library/Messages/chat.db.
/// Requires Full Disk Access (TCC).
///
/// The iMessage schema has changed across macOS versions. We read the minimum
/// needed: recent inbound messages grouped by chat thread, sorted by time.
final class iMessageDatabase {
    private let dbPath: String

    init(dbPath: String = iMessagePermission.chatDBPath) {
        self.dbPath = dbPath
    }

    struct Message {
        let rowID: Int64
        let text: String
        let isFromMe: Bool
        let date: Date
        let chatIdentifier: String  // e.g., "+61412345678" or "user@example.com"
    }

    struct Thread {
        let chatIdentifier: String
        let messages: [Message]
        var latestRowID: Int64 { messages.map(\.rowID).max() ?? 0 }
    }

    // MARK: - Fetch recent threads

    /// Returns threads with new inbound messages since `watermarkRowID`.
    func fetchThreadsSince(rowID watermark: Int64, limit: Int = 30) throws -> [Thread] {
        var db: OpaquePointer?
        // Open read-only so we never corrupt the live DB
        guard sqlite3_open_v2(dbPath, &db, SQLITE_OPEN_READONLY | SQLITE_OPEN_NOMUTEX, nil) == SQLITE_OK else {
            throw iMessageError.cannotOpen
        }
        defer { sqlite3_close(db) }

        let sql = """
            SELECT m.ROWID, m.text, m.is_from_me,
                   -- iMessage stores dates as Mac absolute time (seconds since 2001-01-01)
                   CAST(m.date / 1000000000.0 AS REAL) AS date_secs,
                   h.id AS chat_id
            FROM message m
            JOIN handle h ON m.handle_id = h.ROWID
            JOIN chat_message_join cmj ON m.ROWID = cmj.message_id
            JOIN chat c ON cmj.chat_id = c.ROWID
            WHERE m.ROWID > ? AND m.text IS NOT NULL AND length(trim(m.text)) > 0
            ORDER BY m.date DESC
            LIMIT ?
            """

        var stmt: OpaquePointer?
        guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else {
            throw iMessageError.queryFailed
        }
        defer { sqlite3_finalize(stmt) }

        sqlite3_bind_int64(stmt, 1, watermark)
        sqlite3_bind_int(stmt, 2, Int32(limit * 10)) // over-fetch, group below

        var rawMessages: [Message] = []
        // Mac absolute time epoch: 2001-01-01
        let macEpoch = Date(timeIntervalSinceReferenceDate: 0)

        while sqlite3_step(stmt) == SQLITE_ROW {
            let rowID = sqlite3_column_int64(stmt, 0)
            let text = sqlite3_column_text(stmt, 1).map { String(cString: $0) } ?? ""
            let isFromMe = sqlite3_column_int(stmt, 2) != 0
            let dateSecs = sqlite3_column_double(stmt, 3)
            let chatID = sqlite3_column_text(stmt, 4).map { String(cString: $0) } ?? ""

            guard !text.isEmpty else { continue }
            let date = macEpoch.addingTimeInterval(dateSecs)
            rawMessages.append(Message(rowID: rowID, text: text, isFromMe: isFromMe, date: date, chatIdentifier: chatID))
        }

        // Group by chatIdentifier, most recent first
        var groups: [String: [Message]] = [:]
        for msg in rawMessages {
            groups[msg.chatIdentifier, default: []].append(msg)
        }

        return groups
            .map { Thread(chatIdentifier: $0.key, messages: $0.value.sorted { $0.date < $1.date }) }
            .filter { $0.messages.contains { !$0.isFromMe } } // only threads with inbound msgs
            .sorted { $0.latestRowID > $1.latestRowID }
            .prefix(limit)
            .map { $0 }
    }

    enum iMessageError: Error {
        case cannotOpen
        case queryFailed
    }
}
