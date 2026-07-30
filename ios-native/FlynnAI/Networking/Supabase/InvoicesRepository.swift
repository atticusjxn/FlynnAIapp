import Foundation
import Supabase

private extension Double {
    /// Money arithmetic in `Double` leaves fractions of a cent behind, and a
    /// balance of 0.000000001 reads as "still owing". Round before comparing.
    func rounded(toPlaces places: Int) -> Double {
        let factor = pow(10.0, Double(places))
        return (self * factor).rounded() / factor
    }
}

protocol InvoicesRepositoryType: Sendable {
    func list(orgId: UUID, limit: Int) async throws -> [InvoiceDTO]
    func fetch(id: UUID) async throws -> InvoiceDTO
    func create(orgId: UUID, title: String, clientId: UUID?, clientName: String?,
                clientPhone: String?, lineItems: [LineItem],
                taxRate: Double, notes: String?, dueDate: Date?) async throws -> InvoiceDTO
    func update(id: UUID, title: String, clientPhone: String?, lineItems: [LineItem],
                taxRate: Double, notes: String?, dueDate: Date?) async throws -> InvoiceDTO
    func delete(id: UUID) async throws
    func markPaid(id: UUID, amount: Double, method: String?) async throws -> InvoiceDTO
    func generatePDF(invoiceId: UUID) async throws -> Data
    func sendViaSMS(invoiceId: UUID, toPhone: String) async throws -> Data
}

final class InvoicesRepository: InvoicesRepositoryType {
    private let client: SupabaseClient

    init(client: SupabaseClient = FlynnSupabase.client) {
        self.client = client
    }

    func list(orgId: UUID, limit: Int = 100) async throws -> [InvoiceDTO] {
        #if DEBUG
        if FlynnDemo.isOn { return FlynnDemo.invoicesWithPayments }
        #endif
        return try await client
            .from("invoices")
            .select()
            .eq("org_id", value: orgId.uuidString)
            .order("created_at", ascending: false)
            .limit(limit)
            .execute()
            .value
    }

    func fetch(id: UUID) async throws -> InvoiceDTO {
        #if DEBUG
        if FlynnDemo.isOn {
            guard let match = FlynnDemo.invoicesWithPayments.first(where: { $0.id == id }) else {
                throw FlynnDemoError.notFound
            }
            return match
        }
        #endif
        return try await client
            .from("invoices")
            .select()
            .eq("id", value: id.uuidString)
            .single()
            .execute()
            .value
    }

    func create(orgId: UUID, title: String, clientId: UUID?, clientName: String?,
                clientPhone: String?, lineItems: [LineItem],
                taxRate: Double, notes: String?, dueDate: Date?) async throws -> InvoiceDTO {
        struct NumberResult: Decodable { let generate_invoice_number: String }
        let numResult: String = try await client
            .rpc("generate_invoice_number", params: ["p_org_id": orgId.uuidString])
            .execute()
            .value

        let totals = QuotesRepository.calcTotals(items: lineItems, taxRate: taxRate)
        let itemsJSON = try JSONEncoder().encode(lineItems)
        let itemsAny = try JSONSerialization.jsonObject(with: itemsJSON)
        let iso = ISO8601DateFormatter()

        struct Row: Encodable {
            let org_id: String; let invoice_number: String; let title: String
            let client_id: String?; let client_phone: String?; let client_name: String?
            let line_items: AnyEncodable; let subtotal: Double; let tax_rate: Double
            let tax_amount: Double; let total: Double; let amount_paid: Double; let amount_due: Double
            let notes: String?; let due_date: String?; let issued_date: String; let status: String
        }
        let row = Row(
            org_id: orgId.uuidString, invoice_number: numResult, title: title,
            client_id: clientId?.uuidString, client_phone: clientPhone, client_name: clientName,
            line_items: AnyEncodable(itemsAny),
            subtotal: totals.subtotal, tax_rate: taxRate,
            tax_amount: totals.taxAmount, total: totals.total,
            amount_paid: 0, amount_due: totals.total,
            notes: notes,
            due_date: dueDate.map { iso.string(from: $0) },
            issued_date: iso.string(from: Date()),
            status: "draft"
        )
        return try await client.from("invoices").insert(row).select().single().execute().value
    }

    func update(id: UUID, title: String, clientPhone: String?, lineItems: [LineItem],
                taxRate: Double, notes: String?, dueDate: Date?) async throws -> InvoiceDTO {
        let totals = QuotesRepository.calcTotals(items: lineItems, taxRate: taxRate)
        let itemsJSON = try JSONEncoder().encode(lineItems)
        let itemsAny = try JSONSerialization.jsonObject(with: itemsJSON)

        struct Patch: Encodable {
            let title: String; let client_phone: String?
            let line_items: AnyEncodable; let subtotal: Double; let tax_rate: Double
            let tax_amount: Double; let total: Double; let amount_due: Double
            let notes: String?; let due_date: String?
        }
        let patch = Patch(
            title: title, client_phone: clientPhone,
            line_items: AnyEncodable(itemsAny),
            subtotal: totals.subtotal, tax_rate: taxRate,
            tax_amount: totals.taxAmount, total: totals.total,
            amount_due: totals.total,
            notes: notes,
            due_date: dueDate.map { ISO8601DateFormatter().string(from: $0) }
        )
        return try await client.from("invoices").update(patch)
            .eq("id", value: id.uuidString).select().single().execute().value
    }

    func delete(id: UUID) async throws {
        try await client.from("invoices").delete().eq("id", value: id.uuidString).execute()
    }

    /// Records a payment against an invoice.
    ///
    /// Writes the same columns as the SMS agent's `mark_invoice_paid`
    /// (`services/agent/toolRegistry.js`) so the two entry points can't drift into
    /// two different ideas of what "paid" means. `amount_paid`/`amount_due` are the
    /// canonical numeric pair; the `*_cents` columns belong to the future payment
    /// rail and are deliberately left alone here, because Flynn's fee comes out of
    /// the tradie's settlement rather than off the client's payment — nothing about
    /// recording a direct payment should touch them.
    ///
    /// A part payment leaves the invoice `partial` with the balance still owing, so
    /// the Home "owed" figure stays truthful instead of jumping to zero on a deposit.
    func markPaid(id: UUID, amount: Double, method: String?) async throws -> InvoiceDTO {
        #if DEBUG
        if FlynnDemo.isOn { return try FlynnDemo.markInvoicePaid(id: id, amount: amount, method: method) }
        #endif
        let current = try await fetch(id: id)
        // Guard against a typo settling more than is owed, and against float drift
        // leaving a fraction of a cent behind that reads as "still unpaid".
        let paid = min(max(current.amountPaid + amount, 0), current.total)
        let due = max((current.total - paid).rounded(toPlaces: 2), 0)
        let settled = due <= 0
        let now = ISO8601DateFormatter().string(from: Date())

        struct Patch: Encodable {
            let status: String
            let amount_paid: Double
            let amount_due: Double
            let paid_at: String?
            let payment_method: String?
            let updated_at: String
        }
        let patch = Patch(
            status: settled ? "paid" : "partial",
            amount_paid: paid.rounded(toPlaces: 2),
            amount_due: due,
            paid_at: settled ? now : current.paidAt.map { ISO8601DateFormatter().string(from: $0) },
            payment_method: method ?? current.paymentMethod,
            updated_at: now
        )
        return try await client.from("invoices").update(patch)
            .eq("id", value: id.uuidString).select().single().execute().value
    }

    func generatePDF(invoiceId: UUID) async throws -> Data {
        try await callPDFEndpoint(path: "api/invoices/\(invoiceId.uuidString)/pdf", body: [:])
    }

    func sendViaSMS(invoiceId: UUID, toPhone: String) async throws -> Data {
        try await callPDFEndpoint(path: "api/invoices/\(invoiceId.uuidString)/send", body: ["toPhone": toPhone])
    }

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
}
