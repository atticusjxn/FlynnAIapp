import Foundation

/// A line on a supplier order. Deliberately more lenient than `LineItem`:
/// rows written by the agent (and by the demo seeder) omit `id` and may omit
/// pricing when the supplier only returned a cart total, so every field except
/// the description decodes optionally rather than failing the whole order.
struct PartsLineItem: Codable, Identifiable, Hashable, Sendable {
    let id: UUID
    let description: String
    let quantity: Double
    let unitPrice: Double?
    let total: Double?

    enum CodingKeys: String, CodingKey {
        case description, quantity, total
        case unitPrice = "unit_price"
    }

    init(description: String, quantity: Double, unitPrice: Double?, total: Double?) {
        self.id = UUID()
        self.description = description
        self.quantity = quantity
        self.unitPrice = unitPrice
        self.total = total
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.id = UUID()
        self.description = (try? container.decode(String.self, forKey: .description)) ?? "Item"
        self.quantity = (try? container.decode(Double.self, forKey: .quantity)) ?? 1
        self.unitPrice = try? container.decode(Double.self, forKey: .unitPrice)
        self.total = try? container.decode(Double.self, forKey: .total)
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(description, forKey: .description)
        try container.encode(quantity, forKey: .quantity)
        try container.encodeIfPresent(unitPrice, forKey: .unitPrice)
        try container.encodeIfPresent(total, forKey: .total)
    }

    /// Falls back to qty × unit price when the supplier didn't return a line total.
    var resolvedTotal: Double? {
        if let total { return total }
        if let unitPrice { return quantity * unitPrice }
        return nil
    }
}

/// Mirrors `public.parts_orders` (org-spine money migration 20260718000100).
///
/// `confirmationRef` and `pickupQrUrl` are unpopulated by the agent today — it
/// only returns a cart total — so both render conditionally.
struct PartsOrderDTO: Identifiable, Codable, Hashable, Sendable {
    let id: UUID
    let orgId: UUID
    let jobId: UUID?
    let supplier: String
    let lineItems: [PartsLineItem]
    let cartTotalCents: Int?
    let status: String
    let confirmationRef: String?
    let pickupQrUrl: String?
    let createdAt: Date
    let updatedAt: Date?

    enum CodingKeys: String, CodingKey {
        case id, supplier, status
        case orgId = "org_id"
        case jobId = "job_id"
        case lineItems = "line_items"
        case cartTotalCents = "cart_total_cents"
        case confirmationRef = "confirmation_ref"
        case pickupQrUrl = "pickup_qr_url"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }

    var total: Double { Double(cartTotalCents ?? 0) / 100 }

    /// Total units across all lines ("32 items"), not the number of lines.
    var itemCount: Int {
        lineItems.reduce(0) { $0 + Int($1.quantity.rounded()) }
    }
}
