import Foundation

/// Helpers for read-merge-write against a loosely-typed jsonb column.
///
/// `users.business_brain` is written by three different surfaces — the SMS
/// agent, the voice-funnel claim, and the app — each knowing about a different
/// subset of keys. So the app has to preserve the keys it doesn't understand:
/// decode the whole object, change only what it owns, write the whole thing
/// back. `JSONValue` itself lives in `Networking/DTOs/CallEventDTO.swift`.
extension JSONValue {
    /// The wrapped dictionary, or an empty one for any other kind of value.
    var objectValue: [String: JSONValue] {
        if case .object(let dict) = self { return dict }
        return [:]
    }

    /// A string for display or editing. Numbers come back as strings too, since
    /// jsonb happily holds `"120"` or `120` for the same logical field
    /// depending on which surface wrote it.
    var displayString: String? {
        switch self {
        case .string(let value): return value
        case .int(let value): return String(value)
        case .double(let value):
            return value == value.rounded() ? String(Int(value)) : String(value)
        default: return nil
        }
    }
}

extension Dictionary where Key == String, Value == JSONValue {
    /// Set a trimmed string key, or remove it entirely when blank — so clearing
    /// a field in the app actually clears it on the invoice rather than leaving
    /// an empty string behind that still reads as "configured".
    mutating func setTrimmed(_ key: String, _ value: String) {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty {
            removeValue(forKey: key)
        } else {
            self[key] = .string(trimmed)
        }
    }
}
