import Foundation

/// Pre-built call greeting script (shared catalog in `ivr_templates`). Users either select one
/// directly (`business_profiles.ivr_template_id`) or fork it into
/// `business_profiles.ivr_custom_script`. Script body contains placeholders like
/// `{business_name}`, `{booking_option}`, `{quote_option}`.
struct IvrTemplateDTO: Identifiable, Codable, Hashable, Sendable {
    let id: UUID
    let name: String
    let industry: String?   // industry_type in DB
    let tone: String?
    let scriptBody: String  // script_template in DB
    let description: String?
    let isActive: Bool
    let createdAt: Date?

    enum CodingKeys: String, CodingKey {
        case id
        case name
        case industry = "industry_type"
        case tone
        case scriptBody = "script_template"
        case description
        case isActive = "is_active"
        case createdAt = "created_at"
    }

    func render(businessName: String, bookingOption: String = "a booking link",
                quoteOption: String = "a quote form") -> String {
        scriptBody
            .replacingOccurrences(of: "{business_name}", with: businessName)
            .replacingOccurrences(of: "{booking_option}", with: bookingOption)
            .replacingOccurrences(of: "{quote_option}", with: quoteOption)
    }
}
