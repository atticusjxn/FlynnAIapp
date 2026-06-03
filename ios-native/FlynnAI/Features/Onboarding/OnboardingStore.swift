import Foundation
import Observation
import Supabase
import UIKit
import FBSDKCoreKit

/// Drives the 6-step onboarding wizard. Steps can skip forward freely; the
/// final step writes `users.onboarding_completed = true` which flips
/// `RootView` from `OnboardingCoordinator` to `MainTabView`.
@MainActor
@Observable
final class OnboardingStore {
    enum Step: Int, CaseIterable, Identifiable {
        case welcome         = 0
        case whatYouDo       = 1
        case confirmBrain    = 2
        case captureVoice    = 3
        case soundsLikeYou   = 4
        case connectCalendar = 5
        case paywall         = 6
        case practice        = 7
        case installKeyboard = 8

        var id: Int { rawValue }

        var title: String {
            switch self {
            case .welcome:         return "Welcome to Flynn"
            case .whatYouDo:       return "What do you do?"
            case .confirmBrain:    return "Does this look right?"
            case .captureVoice:    return "Reply like you really would"
            case .soundsLikeYou:   return "Sound like you?"
            case .connectCalendar: return "Connect your calendar"
            case .paywall:         return "Unlock Flynn"
            case .practice:        return "Try it once"
            case .installKeyboard: return "Add the Flynn keyboard"
            }
        }
    }

    enum LoadState: Equatable { case idle, loading, loaded, error(String) }

    private(set) var loadState: LoadState = .idle
    private(set) var onboardingCompleted: Bool?
    private(set) var hasProvisionedPhone: Bool = false
    /// E.164 number provisioned to the user (Flynn's number, not their personal one).
    /// Populated by `provisionPhoneNumber()` after paywall success.
    private(set) var flynnPhoneNumber: String?
    /// Phone number from `auth.users.phone` — set if the user signed up via SMS.
    /// Used to pre-fill the business profile phone field so the user doesn't retype.
    private(set) var verifiedPhone: String?
    var currentStep: Step = .welcome {
        didSet { Self.persistStep(currentStep) }
    }

    private static let stepStorageKey = "flynn.onboarding.step"

    private static func persistStep(_ step: Step) {
        UserDefaults.standard.set(step.rawValue, forKey: stepStorageKey)
    }

    private static func restoreStep() -> Step? {
        let raw = UserDefaults.standard.integer(forKey: stepStorageKey)
        guard UserDefaults.standard.object(forKey: stepStorageKey) != nil else { return nil }
        return Step(rawValue: raw)
    }

    private static func clearPersistedStep() {
        UserDefaults.standard.removeObject(forKey: stepStorageKey)
    }

    // Demo voice session state
    var demoUserId: String?
    var demoWsUrl: URL?
    var demoCallActive: Bool = false

    // MARK: - Text co-pilot onboarding state

    struct DetectedService: Identifiable, Equatable {
        let id = UUID()
        var name: String
        var priceRange: String
    }

    /// Free-text "what do you do" the user types; seeds tailored prompts + brain.
    var businessDescription: String = ""
    var websiteURL: String = ""
    var detectedBusinessType: String = ""
    var detectedServices: [DetectedService] = []
    var detectedPricingNote: String = ""
    var detectedHoursSummary: String = ""
    /// 3 trade-tailored customer texts the user replies to (from the backend).
    var samplePrompts: [String] = []
    var understandingState: LoadState = .idle

    private let client: SupabaseClient

    init(client: SupabaseClient = FlynnSupabase.client) {
        self.client = client
    }

    /// Turn the free-text "what do you do" into a starter Business Brain + 3
    /// trade-tailored sample customer texts (via /api/onboarding/understand).
    func understandBusiness() async {
        let desc = businessDescription.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !desc.isEmpty else { return }
        understandingState = .loading

        struct Req: Encodable { let description: String }
        struct Svc: Decodable { let name: String; let price_range: String? }
        struct Resp: Decodable {
            let businessType: String?
            let services: [Svc]
            let pricingNote: String?
            let hoursSummary: String?
            let samplePrompts: [String]
        }

        do {
            let session = try await client.auth.session
            var req = URLRequest(url: FlynnEnv.flynnAPIBaseURL.appendingPathComponent("api/onboarding/understand"))
            req.httpMethod = "POST"
            req.timeoutInterval = 25
            req.setValue("Bearer \(session.accessToken)", forHTTPHeaderField: "Authorization")
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.httpBody = try JSONEncoder().encode(Req(description: desc))

            let (data, response) = try await URLSession.shared.data(for: req)
            guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
                understandingState = .error("Couldn't analyse your business")
                return
            }
            let decoded = try JSONDecoder().decode(Resp.self, from: data)
            detectedBusinessType = decoded.businessType ?? ""
            detectedServices = decoded.services.map {
                DetectedService(name: $0.name, priceRange: $0.price_range ?? "")
            }
            detectedPricingNote = decoded.pricingNote ?? ""
            detectedHoursSummary = decoded.hoursSummary ?? ""
            samplePrompts = decoded.samplePrompts
            understandingState = .loaded
        } catch {
            understandingState = .error(error.localizedDescription)
        }
    }

    /// Persist the confirmed Business Brain to business_profiles.
    func saveBusinessBrain() async {
        struct Svc: Encodable { let name: String; let price_range: String }
        struct Patch: Encodable {
            let industry: String
            let services: [Svc]
            let pricing_notes: String
            let ai_instructions: String
            let website_url: String?
        }
        let payload = Patch(
            industry: detectedBusinessType,
            services: detectedServices.map { Svc(name: $0.name, price_range: $0.priceRange) },
            pricing_notes: detectedPricingNote,
            ai_instructions: businessDescription,
            website_url: websiteURL.isEmpty ? nil : websiteURL
        )
        do {
            let session = try await client.auth.session
            var req = URLRequest(url: FlynnEnv.flynnAPIBaseURL.appendingPathComponent("api/business-profile"))
            req.httpMethod = "PATCH"
            req.setValue("Bearer \(session.accessToken)", forHTTPHeaderField: "Authorization")
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.httpBody = try JSONEncoder().encode(payload)
            _ = try await URLSession.shared.data(for: req)
        } catch {
            FlynnLog.network.error("saveBusinessBrain failed: \(error.localizedDescription, privacy: .public)")
        }
    }

    func load() async {
        loadState = .loading
        struct Row: Decodable {
            let onboarding_completed: Bool
            let has_provisioned_phone: Bool?
        }
        do {
            let session = try await client.auth.session
            let row: Row = try await client
                .from("users")
                .select("onboarding_completed, has_provisioned_phone")
                .eq("id", value: session.user.id.uuidString)
                .single()
                .execute()
                .value
            onboardingCompleted = row.onboarding_completed
            hasProvisionedPhone = row.has_provisioned_phone ?? false
            verifiedPhone = session.user.phone
            demoUserId = session.user.id.uuidString

            // Restore in-progress step if the user quit mid-onboarding last launch.
            if row.onboarding_completed == false, let saved = Self.restoreStep() {
                currentStep = saved
            }

            loadState = .loaded
        } catch {
            loadState = .error(error.localizedDescription)
            onboardingCompleted = true
        }
    }

    /// Provisions a Telnyx phone number for the user via the Flynn backend.
    /// Idempotent server-side — calling repeatedly is safe.
    /// Called immediately after paywall purchase succeeds so the user finishes
    /// onboarding with a working Flynn number.
    func provisionPhoneNumber(countryCode: String = "AU") async {
        guard let url = URL(string: "\(FlynnEnv.flynnAPIBaseURL)/api/telnyx/provision-number") else { return }
        do {
            let session = try await client.auth.session
            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            request.setValue("Bearer \(session.accessToken)", forHTTPHeaderField: "Authorization")
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSONEncoder().encode(["countryCode": countryCode])

            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
                let bodyText = String(data: data, encoding: .utf8) ?? "<no body>"
                FlynnLog.network.error("Provision failed: \((response as? HTTPURLResponse)?.statusCode ?? -1, privacy: .public) \(bodyText, privacy: .public)")
                return
            }
            struct Response: Decodable {
                let phoneNumber: String
                let phoneNumberSid: String?
            }
            let decoded = try JSONDecoder().decode(Response.self, from: data)
            flynnPhoneNumber = decoded.phoneNumber
            hasProvisionedPhone = true
            FlynnLog.network.info("Provisioned Flynn number: \(decoded.phoneNumber, privacy: .public)")
        } catch {
            FlynnLog.network.error("Provision request errored: \(error.localizedDescription, privacy: .public)")
        }
    }

    func loadDemoSession() async {
        guard let userId = demoUserId else { return }
        guard let url = URL(string: "\(FlynnEnv.flynnAPIBaseURL)/api/demo/start-voice-session") else { return }
        do {
            let session = try await client.auth.session
            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            request.setValue("Bearer \(session.accessToken)", forHTTPHeaderField: "Authorization")
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSONEncoder().encode(["mode": "ai_only"])
            let (data, _) = try await URLSession.shared.data(for: request)
            struct Response: Decodable { let wsUrl: String; let userId: String }
            let decoded = try JSONDecoder().decode(Response.self, from: data)
            demoWsUrl = URL(string: decoded.wsUrl)
            demoUserId = decoded.userId
        } catch {
            FlynnLog.network.error("Demo session failed: \(error.localizedDescription, privacy: .public)")
        }
        _ = userId // suppress unused warning
    }

    func advance() {
        let all = Step.allCases
        guard let idx = all.firstIndex(of: currentStep), idx + 1 < all.count else { return }
        currentStep = all[idx + 1]
        UIImpactFeedbackGenerator(style: .soft).impactOccurred()
    }

    func back() {
        let all = Step.allCases
        guard let idx = all.firstIndex(of: currentStep), idx > 0 else { return }
        currentStep = all[idx - 1]
        UISelectionFeedbackGenerator().selectionChanged()
    }

    func markComplete() async {
        struct Patch: Encodable { let onboarding_completed: Bool }
        do {
            let session = try await client.auth.session
            try await client
                .from("users")
                .update(Patch(onboarding_completed: true))
                .eq("id", value: session.user.id.uuidString)
                .execute()
            onboardingCompleted = true
            Self.clearPersistedStep()
            // Log the registration-completion conversion event for Meta ad attribution.
            AppEvents.shared.logEvent(.completedRegistration)
        } catch {
            FlynnLog.network.error("Onboarding complete failed: \(error.localizedDescription, privacy: .public)")
        }
    }

    func markForwardingVerified() async {
        struct Patch: Encodable { let forwarding_verified: Bool }
        do {
            let session = try await client.auth.session
            try await client
                .from("users")
                .update(Patch(forwarding_verified: true))
                .eq("id", value: session.user.id.uuidString)
                .execute()
        } catch {
            FlynnLog.network.error("forwarding_verified failed: \(error.localizedDescription, privacy: .public)")
        }
    }

    func setSmsLinksMode() async {
        struct Patch: Encodable { let call_handling_mode: String }
        do {
            let session = try await client.auth.session
            try await client
                .from("users")
                .update(Patch(call_handling_mode: "sms_links"))
                .eq("id", value: session.user.id.uuidString)
                .execute()
        } catch {
            FlynnLog.network.error("call_handling_mode update failed: \(error.localizedDescription, privacy: .public)")
        }
    }
}
