import Foundation

/// One row per user in `business_profiles`. The primary key IS `user_id` — Supabase
/// RLS scopes reads to `user_id = auth.uid()`, so `fetch()` returns at most one row.
///
/// JSONB fields (`services`, `serviceAreas`, `hoursJson`, `faqs`, `scrapedContext`,
/// `aiFollowupQuestions`) are decoded into typed domain structs below. Each has a
/// forgiving decoder so shape drift doesn't crash older clients.
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
    let ivrTemplateId: UUID?
    let ivrCustomScript: String?
    let ivrGreetingAudioUrl: String?
    let voiceProfileId: UUID?
    let aiGreetingText: String?
    let aiFollowupQuestions: [String]
    let aiInstructions: String?
    let recordingDisclosure: String?
    let createdAt: Date?
    let updatedAt: Date?

    enum CodingKeys: String, CodingKey {
        case userId = "user_id"
        case orgId = "org_id"
        case businessName = "business_name"
        case industry
        case services
        case serviceAreas = "service_areas"
        case hoursJson = "hours_json"
        case faqs
        case pricingNotes = "pricing_notes"
        case websiteUrl = "website_url"
        case scrapedContext = "scraped_context"
        case bookingLinkUrl = "booking_link_url"
        case bookingLinkEnabled = "booking_link_enabled"
        case quoteLinkUrl = "quote_link_url"
        case quoteLinkEnabled = "quote_link_enabled"
        case smsBookingTemplate = "sms_booking_template"
        case smsQuoteTemplate = "sms_quote_template"
        case ivrTemplateId = "ivr_template_id"
        case ivrCustomScript = "ivr_custom_script"
        case ivrGreetingAudioUrl = "ivr_greeting_audio_url"
        case voiceProfileId = "voice_profile_id"
        case aiGreetingText = "ai_greeting_text"
        case aiFollowupQuestions = "ai_followup_questions"
        case aiInstructions = "ai_instructions"
        case recordingDisclosure = "recording_disclosure"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }

    /// Forgiving decoder — jsonb columns that the DB returns as NULL (because
    /// no migration populated them yet) default to their empty forms instead
    /// of throwing `keyNotFound` / `valueNotFound` and blowing up entire
    /// screens (IVR editor, BusinessProfile editor).
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        self.userId = try c.decode(UUID.self, forKey: .userId)
        self.orgId = try c.decodeIfPresent(UUID.self, forKey: .orgId)
        self.businessName = try c.decodeIfPresent(String.self, forKey: .businessName)
        self.industry = try c.decodeIfPresent(String.self, forKey: .industry)
        self.services = (try? c.decodeIfPresent([BusinessService].self, forKey: .services)) ?? []
        self.serviceAreas = (try? c.decodeIfPresent([String].self, forKey: .serviceAreas)) ?? []
        self.hoursJson = try? c.decodeIfPresent(BusinessHours.self, forKey: .hoursJson)
        self.faqs = (try? c.decodeIfPresent([BusinessFAQ].self, forKey: .faqs)) ?? []
        self.pricingNotes = try c.decodeIfPresent(String.self, forKey: .pricingNotes)
        self.websiteUrl = try c.decodeIfPresent(String.self, forKey: .websiteUrl)
        self.scrapedContext = try? c.decodeIfPresent([String: String].self, forKey: .scrapedContext)
        self.bookingLinkUrl = try c.decodeIfPresent(String.self, forKey: .bookingLinkUrl)
        self.bookingLinkEnabled = (try? c.decodeIfPresent(Bool.self, forKey: .bookingLinkEnabled)) ?? true
        self.quoteLinkUrl = try c.decodeIfPresent(String.self, forKey: .quoteLinkUrl)
        self.quoteLinkEnabled = (try? c.decodeIfPresent(Bool.self, forKey: .quoteLinkEnabled)) ?? true
        self.smsBookingTemplate = try c.decodeIfPresent(String.self, forKey: .smsBookingTemplate)
        self.smsQuoteTemplate = try c.decodeIfPresent(String.self, forKey: .smsQuoteTemplate)
        self.ivrTemplateId = try c.decodeIfPresent(UUID.self, forKey: .ivrTemplateId)
        self.ivrCustomScript = try c.decodeIfPresent(String.self, forKey: .ivrCustomScript)
        self.ivrGreetingAudioUrl = try c.decodeIfPresent(String.self, forKey: .ivrGreetingAudioUrl)
        self.voiceProfileId = try c.decodeIfPresent(UUID.self, forKey: .voiceProfileId)
        self.aiGreetingText = try c.decodeIfPresent(String.self, forKey: .aiGreetingText)
        self.aiFollowupQuestions = (try? c.decodeIfPresent([String].self, forKey: .aiFollowupQuestions)) ?? []
        self.aiInstructions = try c.decodeIfPresent(String.self, forKey: .aiInstructions)
        self.recordingDisclosure = try c.decodeIfPresent(String.self, forKey: .recordingDisclosure)
        self.createdAt = try c.decodeIfPresent(Date.self, forKey: .createdAt)
        self.updatedAt = try c.decodeIfPresent(Date.self, forKey: .updatedAt)
    }
}

struct BusinessService: Codable, Hashable, Sendable, Identifiable {
    var id: String { name }
    var name: String
    var price: Double?
    var durationMinutes: Int?

    enum CodingKeys: String, CodingKey {
        case name
        case price
        case durationMinutes = "duration_minutes"
    }
}

struct BusinessFAQ: Codable, Hashable, Sendable, Identifiable {
    var id: String { question }
    var question: String
    var answer: String

    enum CodingKeys: String, CodingKey {
        case question = "q"
        case answer = "a"
    }
}

/// Keyed by lowercased weekday (`mon`, `tue`, ...). Absent key ⇒ closed that day.
struct BusinessHours: Codable, Hashable, Sendable {
    var monday: DayHours?
    var tuesday: DayHours?
    var wednesday: DayHours?
    var thursday: DayHours?
    var friday: DayHours?
    var saturday: DayHours?
    var sunday: DayHours?

    enum CodingKeys: String, CodingKey {
        case monday = "mon"
        case tuesday = "tue"
        case wednesday = "wed"
        case thursday = "thu"
        case friday = "fri"
        case saturday = "sat"
        case sunday = "sun"
    }
}

struct DayHours: Codable, Hashable, Sendable {
    var open: String   // "08:00"
    var close: String  // "17:00"
}
