import Foundation

/// Upsert payload for `business_profiles`. `user_id` is set by the server via RLS/default
/// when inserting, so callers omit it. All JSONB fields are sent as arrays/objects
/// and encoded to JSON by the Supabase SDK.
struct BusinessProfileInput: Codable, Sendable {
    var businessName: String?
    var industry: String?
    var services: [BusinessService]
    var serviceAreas: [String]
    var hoursJson: BusinessHours?
    var faqs: [BusinessFAQ]
    var pricingNotes: String?
    var websiteUrl: String?
    var bookingLinkUrl: String?
    var bookingLinkEnabled: Bool
    var quoteLinkUrl: String?
    var quoteLinkEnabled: Bool
    var smsBookingTemplate: String?
    var smsQuoteTemplate: String?
    var ivrTemplateId: UUID?
    var ivrCustomScript: String?
    var voiceProfileId: UUID?
    var aiGreetingText: String?
    var aiFollowupQuestions: [String]
    var aiInstructions: String?

    enum CodingKeys: String, CodingKey {
        case businessName = "business_name"
        case industry
        case services
        case serviceAreas = "service_areas"
        case hoursJson = "hours_json"
        case faqs
        case pricingNotes = "pricing_notes"
        case websiteUrl = "website_url"
        case bookingLinkUrl = "booking_link_url"
        case bookingLinkEnabled = "booking_link_enabled"
        case quoteLinkUrl = "quote_link_url"
        case quoteLinkEnabled = "quote_link_enabled"
        case smsBookingTemplate = "sms_booking_template"
        case smsQuoteTemplate = "sms_quote_template"
        case ivrTemplateId = "ivr_template_id"
        case ivrCustomScript = "ivr_custom_script"
        case voiceProfileId = "voice_profile_id"
        case aiGreetingText = "ai_greeting_text"
        case aiFollowupQuestions = "ai_followup_questions"
        case aiInstructions = "ai_instructions"
    }
}

extension BusinessProfileInput {
    init(from dto: BusinessProfileDTO) {
        self.businessName = dto.businessName
        self.industry = dto.industry
        self.services = dto.services
        self.serviceAreas = dto.serviceAreas
        self.hoursJson = dto.hoursJson
        self.faqs = dto.faqs
        self.pricingNotes = dto.pricingNotes
        self.websiteUrl = dto.websiteUrl
        self.bookingLinkUrl = dto.bookingLinkUrl
        self.bookingLinkEnabled = dto.bookingLinkEnabled
        self.quoteLinkUrl = dto.quoteLinkUrl
        self.quoteLinkEnabled = dto.quoteLinkEnabled
        self.smsBookingTemplate = dto.smsBookingTemplate
        self.smsQuoteTemplate = dto.smsQuoteTemplate
        self.ivrTemplateId = dto.ivrTemplateId
        self.ivrCustomScript = dto.ivrCustomScript
        self.voiceProfileId = dto.voiceProfileId
        self.aiGreetingText = dto.aiGreetingText
        self.aiFollowupQuestions = dto.aiFollowupQuestions
        self.aiInstructions = dto.aiInstructions
    }

    static var empty: BusinessProfileInput {
        BusinessProfileInput(
            businessName: nil,
            industry: nil,
            services: [],
            serviceAreas: [],
            hoursJson: nil,
            faqs: [],
            pricingNotes: nil,
            websiteUrl: nil,
            bookingLinkUrl: nil,
            bookingLinkEnabled: true,
            quoteLinkUrl: nil,
            quoteLinkEnabled: true,
            smsBookingTemplate: nil,
            smsQuoteTemplate: nil,
            ivrTemplateId: nil,
            ivrCustomScript: nil,
            voiceProfileId: nil,
            aiGreetingText: nil,
            aiFollowupQuestions: [],
            aiInstructions: nil
        )
    }
}
