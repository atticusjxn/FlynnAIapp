import Foundation
import Observation
import Supabase
import UIKit

/// Drives the 6-step onboarding wizard. Steps can skip forward freely; the
/// final step writes `users.onboarding_completed = true` which flips
/// `RootView` from `OnboardingCoordinator` to `MainTabView`.
@MainActor
@Observable
final class OnboardingStore {
    enum Step: Int, CaseIterable, Identifiable {
        case websiteScrape = 0
        case mode          = 1
        case ivr           = 2
        case liveDemo      = 3
        case paywall       = 4
        case phoneNumber   = 5

        var id: Int { rawValue }

        var title: String {
            switch self {
            case .websiteScrape: return "Tell Flynn about your business"
            case .mode:          return "How should we handle missed calls?"
            case .ivr:           return "What should Flynn say?"
            case .liveDemo:      return "Meet your AI receptionist"
            case .paywall:       return "Unlock your agent"
            case .phoneNumber:   return "Forward your calls"
            }
        }
    }

    enum LoadState: Equatable { case idle, loading, loaded, error(String) }

    private(set) var loadState: LoadState = .idle
    private(set) var onboardingCompleted: Bool?
    private(set) var hasProvisionedPhone: Bool = false
    var currentStep: Step = .websiteScrape {
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

    private let client: SupabaseClient

    init(client: SupabaseClient = FlynnSupabase.client) {
        self.client = client
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
