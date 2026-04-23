import Foundation

/// Append-only event log entry for a call (DTMF press, SMS sent, AI turn start/end,
/// latency measurement, cost snapshot, outcome). Written by the backend; Swift UI
/// reads these for analytics / cost widgets.
struct CallEventDTO: Identifiable, Codable, Hashable, Sendable {
    let id: UUID
    let callId: UUID
    let userId: UUID
    let eventType: String
    let eventData: [String: JSONValue]?
    let latencyMs: Int?
    let costCents: Int?
    let createdAt: Date

    enum CodingKeys: String, CodingKey {
        case id
        case callId = "call_id"
        case userId = "user_id"
        case eventType = "event_type"
        case eventData = "event_data"
        case latencyMs = "latency_ms"
        case costCents = "cost_cents"
        case createdAt = "created_at"
    }
}

/// Minimal JSONB container usable for typed decoding while the full schema for
/// `event_data` evolves. Backed by the Supabase SDK's JSONValue if available, else a
/// local representation that round-trips common primitive/object/array shapes.
enum JSONValue: Codable, Hashable, Sendable {
    case string(String)
    case int(Int)
    case double(Double)
    case bool(Bool)
    case null
    case array([JSONValue])
    case object([String: JSONValue])

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() { self = .null; return }
        if let v = try? container.decode(Bool.self) { self = .bool(v); return }
        if let v = try? container.decode(Int.self) { self = .int(v); return }
        if let v = try? container.decode(Double.self) { self = .double(v); return }
        if let v = try? container.decode(String.self) { self = .string(v); return }
        if let v = try? container.decode([JSONValue].self) { self = .array(v); return }
        if let v = try? container.decode([String: JSONValue].self) { self = .object(v); return }
        throw DecodingError.typeMismatch(
            JSONValue.self,
            .init(codingPath: decoder.codingPath, debugDescription: "Unsupported JSON value")
        )
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.singleValueContainer()
        switch self {
        case .null: try c.encodeNil()
        case .bool(let v): try c.encode(v)
        case .int(let v): try c.encode(v)
        case .double(let v): try c.encode(v)
        case .string(let v): try c.encode(v)
        case .array(let v): try c.encode(v)
        case .object(let v): try c.encode(v)
        }
    }

    var stringValue: String? { if case .string(let v) = self { return v } else { return nil } }
    var intValue: Int? {
        switch self {
        case .int(let v): return v
        case .double(let v): return Int(v)
        default: return nil
        }
    }
    var doubleValue: Double? {
        switch self {
        case .double(let v): return v
        case .int(let v): return Double(v)
        default: return nil
        }
    }
}
