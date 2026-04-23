import Foundation

/// Pre-built IVR script (shared catalog in `ivr_templates`). Users either select one
/// directly (`business_profiles.ivr_template_id`) or fork it into
/// `business_profiles.ivr_custom_script`. Script body contains placeholders like
/// `{business_name}`, `{booking_option}`, `{quote_option}`.
struct IvrTemplateDTO: Identifiable, Codable, Hashable, Sendable {
    let id: UUID
    let slug: String
    let name: String
    let industry: String?
    let tone: String?
    let scriptBody: String
    let includesBooking: Bool
    let includesQuote: Bool
    let includesVoicemail: Bool
    let isBuiltin: Bool
    let locale: String
    let createdAt: Date?

    enum CodingKeys: String, CodingKey {
        case id
        case slug
        case name
        case industry
        case tone
        case scriptBody = "script_body"
        case includesBooking = "includes_booking"
        case includesQuote = "includes_quote"
        case includesVoicemail = "includes_voicemail"
        case isBuiltin = "is_builtin"
        case locale
        case createdAt = "created_at"
    }

    /// Render with placeholder substitution. Unknown placeholders are left intact so
    /// the editor can show them to the user.
    func render(businessName: String, bookingOption: String = "a booking link",
                quoteOption: String = "a quote form") -> String {
        scriptBody
            .replacingOccurrences(of: "{business_name}", with: businessName)
            .replacingOccurrences(of: "{booking_option}", with: bookingOption)
            .replacingOccurrences(of: "{quote_option}", with: quoteOption)
    }
}
