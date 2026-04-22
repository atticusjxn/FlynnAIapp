import Foundation

struct QuoteDTO: Identifiable, Codable, Hashable, Sendable {
    let id: UUID
    let orgId: UUID
    let quoteNumber: String
    let title: String?
    let clientId: UUID?
    let jobId: UUID?
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
        case viewedAt = "viewed_at"
        case acceptedAt = "accepted_at"
        case declinedAt = "declined_at"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}
