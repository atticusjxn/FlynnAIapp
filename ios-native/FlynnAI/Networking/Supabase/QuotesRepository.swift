import Foundation
import Supabase

protocol QuotesRepositoryType: Sendable {
    func list(orgId: UUID, limit: Int) async throws -> [QuoteDTO]
    func fetch(id: UUID) async throws -> QuoteDTO
    func create(orgId: UUID, title: String, clientId: UUID?, clientName: String?,
                clientPhone: String?, lineItems: [LineItem],
                taxRate: Double, notes: String?, validUntil: Date?) async throws -> QuoteDTO
    func update(id: UUID, title: String, clientPhone: String?, lineItems: [LineItem],
                taxRate: Double, notes: String?, validUntil: Date?) async throws -> QuoteDTO
    func delete(id: UUID) async throws
    func generatePDF(quoteId: UUID) async throws -> Data
    func sendViaSMS(quoteId: UUID, toPhone: String) async throws -> Data
    func convertToInvoice(quoteId: UUID) async throws -> InvoiceDTO
}

final class QuotesRepository: QuotesRepositoryType {
    private let client: SupabaseClient

    init(client: SupabaseClient = FlynnSupabase.client) {
        self.client = client
    }

    func list(orgId: UUID, limit: Int = 100) async throws -> [QuoteDTO] {
        try await client
            .from("quotes")
            .select()
            .eq("org_id", value: orgId.uuidString)
            .order("created_at", ascending: false)
            .limit(limit)
            .execute()
            .value
    }

    func fetch(id: UUID) async throws -> QuoteDTO {
        try await client
            .from("quotes")
            .select()
            .eq("id", value: id.uuidString)
            .single()
            .execute()
            .value
    }

    func create(orgId: UUID, title: String, clientId: UUID?, clientName: String?,
                clientPhone: String?, lineItems: [LineItem],
                taxRate: Double, notes: String?, validUntil: Date?) async throws -> QuoteDTO {
        // Generate auto-number via Supabase RPC
        struct NumberResult: Decodable { let generate_quote_number: String }
        let numResult: String = try await client
            .rpc("generate_quote_number", params: ["p_org_id": orgId.uuidString])
            .execute()
            .value

        let totals = Self.calcTotals(items: lineItems, taxRate: taxRate)
        let encoder = JSONEncoder()
        let itemsJSON = try encoder.encode(lineItems)
        let itemsAny = try JSONSerialization.jsonObject(with: itemsJSON)

        struct Row: Encodable {
            let org_id: String; let quote_number: String; let title: String
            let client_id: String?; let client_phone: String?; let client_name: String?
            let line_items: AnyEncodable; let subtotal: Double; let tax_rate: Double
            let tax_amount: Double; let total: Double
            let notes: String?; let valid_until: String?; let status: String
        }
        let row = Row(
            org_id: orgId.uuidString,
            quote_number: numResult,
            title: title,
            client_id: clientId?.uuidString,
            client_phone: clientPhone,
            client_name: clientName,
            line_items: AnyEncodable(itemsAny),
            subtotal: totals.subtotal,
            tax_rate: taxRate,
            tax_amount: totals.taxAmount,
            total: totals.total,
            notes: notes,
            valid_until: validUntil.map { ISO8601DateFormatter().string(from: $0) },
            status: "draft"
        )
        return try await client.from("quotes").insert(row).select().single().execute().value
    }

    func update(id: UUID, title: String, clientPhone: String?, lineItems: [LineItem],
                taxRate: Double, notes: String?, validUntil: Date?) async throws -> QuoteDTO {
        let totals = Self.calcTotals(items: lineItems, taxRate: taxRate)
        let itemsJSON = try JSONEncoder().encode(lineItems)
        let itemsAny = try JSONSerialization.jsonObject(with: itemsJSON)

        struct Patch: Encodable {
            let title: String; let client_phone: String?
            let line_items: AnyEncodable; let subtotal: Double; let tax_rate: Double
            let tax_amount: Double; let total: Double
            let notes: String?; let valid_until: String?
        }
        let patch = Patch(
            title: title, client_phone: clientPhone,
            line_items: AnyEncodable(itemsAny),
            subtotal: totals.subtotal, tax_rate: taxRate,
            tax_amount: totals.taxAmount, total: totals.total,
            notes: notes,
            valid_until: validUntil.map { ISO8601DateFormatter().string(from: $0) }
        )
        return try await client.from("quotes").update(patch)
            .eq("id", value: id.uuidString).select().single().execute().value
    }

    func delete(id: UUID) async throws {
        try await client.from("quotes").delete().eq("id", value: id.uuidString).execute()
    }

    func generatePDF(quoteId: UUID) async throws -> Data {
        try await callPDFEndpoint(path: "api/quotes/\(quoteId.uuidString)/pdf", body: [:])
    }

    func sendViaSMS(quoteId: UUID, toPhone: String) async throws -> Data {
        try await callPDFEndpoint(path: "api/quotes/\(quoteId.uuidString)/send", body: ["toPhone": toPhone])
    }

    func convertToInvoice(quoteId: UUID) async throws -> InvoiceDTO {
        let session = try await client.auth.session
        var req = URLRequest(url: FlynnEnv.flynnAPIBaseURL.appendingPathComponent("api/quotes/\(quoteId.uuidString)/convert"))
        req.httpMethod = "POST"
        req.setValue("Bearer \(session.accessToken)", forHTTPHeaderField: "Authorization")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONEncoder().encode([String: String]())
        let (data, _) = try await URLSession.shared.data(for: req)
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return try decoder.decode(InvoiceDTO.self, from: data)
    }

    // MARK: – Helpers

    private func callPDFEndpoint(path: String, body: [String: String]) async throws -> Data {
        let session = try await client.auth.session
        var req = URLRequest(url: FlynnEnv.flynnAPIBaseURL.appendingPathComponent(path))
        req.httpMethod = "POST"
        req.setValue("Bearer \(session.accessToken)", forHTTPHeaderField: "Authorization")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONEncoder().encode(body)
        let (data, response) = try await URLSession.shared.data(for: req)
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            throw URLError(.badServerResponse)
        }
        struct Resp: Decodable { let pdfData: String? }
        if let resp = try? JSONDecoder().decode(Resp.self, from: data),
           let b64 = resp.pdfData,
           let pdfBytes = Data(base64Encoded: b64) {
            return pdfBytes
        }
        return data
    }

    static func calcTotals(items: [LineItem], taxRate: Double) -> (subtotal: Double, taxAmount: Double, total: Double) {
        let subtotal = items.reduce(0) { $0 + $1.total }
        let taxAmount = subtotal * (taxRate / 100)
        return (subtotal, taxAmount, subtotal + taxAmount)
    }
}

// Lightweight type-erased Encodable wrapper for JSONB values.
struct AnyEncodable: Encodable {
    private let value: Any
    init(_ value: Any) { self.value = value }
    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch value {
        case let v as [Any]:     try container.encode(v.map { AnyEncodable($0) })
        case let v as [String: Any]: try container.encode(v.mapValues { AnyEncodable($0) })
        case let v as String:    try container.encode(v)
        case let v as Double:    try container.encode(v)
        case let v as Int:       try container.encode(v)
        case let v as Bool:      try container.encode(v)
        default: try container.encodeNil()
        }
    }
}
