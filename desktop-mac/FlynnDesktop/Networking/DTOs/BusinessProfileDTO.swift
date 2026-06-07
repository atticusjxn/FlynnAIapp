import Foundation

/// Direct port from iOS — schema unchanged, all fields map to the same Supabase table.
struct BusinessProfileDTO: Codable, Hashable, Sendable {
    let userId: UUID
    let orgId: UUID?
    let businessName: String?
    let industry: String?
    let services: [BusinessService]
    let serviceAreas: [String]
    let hoursJson: BusinessHours?
    let faqs: [BusinessFAQ]
    let pricingNotes: String?
    let websiteUrl: String?
    let scrapedContext: [String: String]?
    let bookingLinkUrl: String?
    let bookingLinkEnabled: Bool
    let quoteLinkUrl: String?
    let quoteLinkEnabled: Bool
    let smsBookingTemplate: String?
    let smsQuoteTemplate: String?
    let aiGreetingText: String?
    let aiFollowupQuestions: [String]
    let aiInstructions: String?
    let recordingDisclosure: String?
    let createdAt: Date?
    let updatedAt: Date?

    enum CodingKeys: String, CodingKey {
        case userId = "user_id", orgId = "org_id"
        case businessName = "business_name", industry
        case services, serviceAreas = "service_areas"
        case hoursJson = "hours_json", faqs
        case pricingNotes = "pricing_notes", websiteUrl = "website_url"
        case scrapedContext = "scraped_context"
        case bookingLinkUrl = "booking_link_url", bookingLinkEnabled = "booking_link_enabled"
        case quoteLinkUrl = "quote_link_url", quoteLinkEnabled = "quote_link_enabled"
        case smsBookingTemplate = "sms_booking_template", smsQuoteTemplate = "sms_quote_template"
        case aiGreetingText = "ai_greeting_text", aiFollowupQuestions = "ai_followup_questions"
        case aiInstructions = "ai_instructions", recordingDisclosure = "recording_disclosure"
        case createdAt = "created_at", updatedAt = "updated_at"
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        userId = try c.decode(UUID.self, forKey: .userId)
        orgId = try c.decodeIfPresent(UUID.self, forKey: .orgId)
        businessName = try c.decodeIfPresent(String.self, forKey: .businessName)
        industry = try c.decodeIfPresent(String.self, forKey: .industry)
        services = (try? c.decodeIfPresent([BusinessService].self, forKey: .services)) ?? []
        serviceAreas = (try? c.decodeIfPresent([String].self, forKey: .serviceAreas)) ?? []
        hoursJson = try? c.decodeIfPresent(BusinessHours.self, forKey: .hoursJson)
        faqs = (try? c.decodeIfPresent([BusinessFAQ].self, forKey: .faqs)) ?? []
        pricingNotes = try c.decodeIfPresent(String.self, forKey: .pricingNotes)
        websiteUrl = try c.decodeIfPresent(String.self, forKey: .websiteUrl)
        scrapedContext = try? c.decodeIfPresent([String: String].self, forKey: .scrapedContext)
        bookingLinkUrl = try c.decodeIfPresent(String.self, forKey: .bookingLinkUrl)
        bookingLinkEnabled = (try? c.decodeIfPresent(Bool.self, forKey: .bookingLinkEnabled)) ?? true
        quoteLinkUrl = try c.decodeIfPresent(String.self, forKey: .quoteLinkUrl)
        quoteLinkEnabled = (try? c.decodeIfPresent(Bool.self, forKey: .quoteLinkEnabled)) ?? true
        smsBookingTemplate = try c.decodeIfPresent(String.self, forKey: .smsBookingTemplate)
        smsQuoteTemplate = try c.decodeIfPresent(String.self, forKey: .smsQuoteTemplate)
        aiGreetingText = try c.decodeIfPresent(String.self, forKey: .aiGreetingText)
        aiFollowupQuestions = (try? c.decodeIfPresent([String].self, forKey: .aiFollowupQuestions)) ?? []
        aiInstructions = try c.decodeIfPresent(String.self, forKey: .aiInstructions)
        recordingDisclosure = try c.decodeIfPresent(String.self, forKey: .recordingDisclosure)
        createdAt = try c.decodeIfPresent(Date.self, forKey: .createdAt)
        updatedAt = try c.decodeIfPresent(Date.self, forKey: .updatedAt)
    }
}

struct BusinessService: Codable, Hashable, Sendable, Identifiable {
    var id: String { name }
    var name: String
    var price: Double?
    var durationMinutes: Int?

    enum CodingKeys: String, CodingKey {
        case name, price, durationMinutes = "duration_minutes"
    }
}

struct BusinessFAQ: Codable, Hashable, Sendable, Identifiable {
    var id: String { question }
    var question: String
    var answer: String

    enum CodingKeys: String, CodingKey {
        case question = "q", answer = "a"
    }
}

struct BusinessHours: Codable, Hashable, Sendable {
    var monday: DayHours?; var tuesday: DayHours?; var wednesday: DayHours?
    var thursday: DayHours?; var friday: DayHours?
    var saturday: DayHours?; var sunday: DayHours?

    enum CodingKeys: String, CodingKey {
        case monday = "mon", tuesday = "tue", wednesday = "wed"
        case thursday = "thu", friday = "fri", saturday = "sat", sunday = "sun"
    }
}

struct DayHours: Codable, Hashable, Sendable {
    var open: String   // "08:00"
    var close: String  // "17:00"
}
