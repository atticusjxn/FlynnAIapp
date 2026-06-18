import Foundation

/// The display-relevant slice of the owner's learned quote style. The backend
/// stores a richer, vertical-agnostic `style_json`; we decode just what we show
/// and ignore the rest (so new fields never break decoding).
struct LearnedQuoteStyle: Decodable, Equatable {
    let vertical: String?
    let currency: String?
    let pricingModels: [String]?
    let tax: Tax?
    let sampleLineItems: [Sample]?
    let paymentTerms: String?
    let validity: String?

    struct Tax: Decodable, Equatable {
        let label: String?
        let rate: Double?
    }
    struct Sample: Decodable, Equatable {
        let description: String?
    }

    enum CodingKeys: String, CodingKey {
        case vertical, currency, tax, validity
        case pricingModels = "pricing_models"
        case sampleLineItems = "sample_line_items"
        case paymentTerms = "payment_terms"
    }

    var taxSummary: String? {
        guard let tax else { return nil }
        let rate = tax.rate.map { $0 == $0.rounded() ? String(Int($0)) : String($0) }
        return [tax.label, rate.map { "\($0)%" }].compactMap { $0 }.joined(separator: " ")
    }
}

struct QuoteStyleResponse: Decodable, Equatable {
    let style: LearnedQuoteStyle?
    let sampleCount: Int?
}
