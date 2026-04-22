import Foundation

struct InvoiceDTO: Identifiable, Codable, Hashable, Sendable {
    let id: UUID
    let orgId: UUID
    let invoiceNumber: String
    let title: String?
    let clientId: UUID?
    let jobId: UUID?
    let quoteId: UUID?
    let subtotal: Double
    let taxRate: Double
    let taxAmount: Double
    let total: Double
    let amountPaid: Double
    let amountDue: Double
    let status: String
    let notes: String?
    let terms: String?
    let dueDate: Date?
    let issuedDate: Date
    let stripePaymentLinkUrl: String?
    let pdfUrl: String?
    let sentAt: Date?
    let viewedAt: Date?
    let paidAt: Date?
    let paymentMethod: String?
    let createdAt: Date
    let updatedAt: Date

    enum CodingKeys: String, CodingKey {
        case id
        case orgId = "org_id"
        case invoiceNumber = "invoice_number"
        case title
        case clientId = "client_id"
        case jobId = "job_id"
        case quoteId = "quote_id"
        case subtotal
        case taxRate = "tax_rate"
        case taxAmount = "tax_amount"
        case total
        case amountPaid = "amount_paid"
        case amountDue = "amount_due"
        case status
        case notes
        case terms
        case dueDate = "due_date"
        case issuedDate = "issued_date"
        case stripePaymentLinkUrl = "stripe_payment_link_url"
        case pdfUrl = "pdf_url"
        case sentAt = "sent_at"
        case viewedAt = "viewed_at"
        case paidAt = "paid_at"
        case paymentMethod = "payment_method"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}
