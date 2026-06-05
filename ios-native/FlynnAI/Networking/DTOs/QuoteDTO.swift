import Foundation

// Shared between quotes and invoices — mirrors the JSONB line_items column.
struct LineItem: Codable, Identifiable, Hashable, Equatable, Sendable {
    var id: UUID
    var description: String
    var quantity: Double
    var unitPrice: Double
    var total: Double

    enum CodingKeys: String, CodingKey {
        case id, description, quantity, total
        case unitPrice = "unit_price"
    }
}

// Mutable draft used in form views only — never persisted directly.
struct LineItemDraft: Identifiable {
    var id = UUID()
    var description: String = ""
    var quantity: Double = 1
    var unitPrice: Double = 0
    var total: Double { quantity * unitPrice }

    func toLineItem() -> LineItem {
        LineItem(id: id, description: description, quantity: quantity, unitPrice: unitPrice, total: total)
    }

    static func from(_ item: LineItem) -> LineItemDraft {
        var d = LineItemDraft()
        d.id = item.id
        d.description = item.description
        d.quantity = item.quantity
        d.unitPrice = item.unitPrice
        return d
    }
}

struct QuoteDTO: Identifiable, Codable, Hashable, Sendable {
    let id: UUID
    let orgId: UUID
    let quoteNumber: String
    let title: String?
    let clientId: UUID?
    let jobId: UUID?
    let lineItems: [LineItem]
    let subtotal: Double
    let taxRate: Double
    let taxAmount: Double
    let total: Double
    let status: String
    let notes: String?
    let terms: String?
    let validUntil: Date?
    let stripePaymentLinkUrl: String?
    let pdfUrl: String?
    let sentAt: Date?
    let sentTo: String?
    let viewedAt: Date?
    let acceptedAt: Date?
    let declinedAt: Date?
    let createdAt: Date
    let updatedAt: Date

    enum CodingKeys: String, CodingKey {
        case id
        case orgId = "org_id"
        case quoteNumber = "quote_number"
        case title
        case clientId = "client_id"
        case jobId = "job_id"
        case lineItems = "line_items"
        case subtotal
        case taxRate = "tax_rate"
        case taxAmount = "tax_amount"
        case total
        case status
        case notes
        case terms
        case validUntil = "valid_until"
        case stripePaymentLinkUrl = "stripe_payment_link_url"
        case pdfUrl = "pdf_url"
        case sentAt = "sent_at"
        case sentTo = "sent_to"
        case viewedAt = "viewed_at"
        case acceptedAt = "accepted_at"
        case declinedAt = "declined_at"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}
