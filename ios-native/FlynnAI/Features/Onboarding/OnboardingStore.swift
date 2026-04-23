import Foundation
import Observation
import Supabase

/// Drives the 5-step onboarding wizard. Steps can skip forward freely; the
/// final step writes `users.onboarding_completed = true` which flips
/// `RootView` from `OnboardingCoordinator` to `MainTabView`.
@MainActor
@Observable
final class OnboardingStore {
    enum Step: Int, CaseIterable, Identifiable {
        case websiteScrape, mode, ivr, forwarding, testCall

        var id: Int { rawValue }

        var title: String {
            switch self {
            case .websiteScrape: return "Tell Flynn about your business"
            case .mode: return "How should we handle missed calls?"
            case .ivr: return "What should Flynn say?"
            case .forwarding: return "Forward your calls"
            case .testCall: return "Make a test call"
            }
        }
    }

    enum LoadState: Equatable { case idle, loading, loaded, error(String) }

    private(set) var loadState: LoadState = .idle
    private(set) var onboardingCompleted: Bool?
    var currentStep: Step = .websiteScrape

    private let client: SupabaseClient

    init(client: SupabaseClient = FlynnSupabase.client) {
        self.client = client
    }

    func load() async {
        loadState = .loading
        struct Row: Decodable { let onboarding_completed: Bool }
        do {
            let session = try await client.auth.session
            let row: Row = try await client
                .from("users")
                .select("onboarding_completed")
                .eq("id", value: session.user.id.uuidString)
                .single()
                .execute()
                .value
            onboardingCompleted = row.onboarding_completed
            loadState = .loaded
        } catch {
            loadState = .error(error.localizedDescription)
            // Fail open so the UI doesn't wedge; default to "complete" so the
            // user can still access the app. We'll re-query after sign-in.
            onboardingCompleted = true
        }
    }

    func advance() {
        let all = Step.allCases
        guard let idx = all.firstIndex(of: currentStep), idx + 1 < all.count else { return }
        currentStep = all[idx + 1]
    }

    func back() {
        let all = Step.allCases
        guard let idx = all.firstIndex(of: currentStep), idx > 0 else { return }
        currentStep = all[idx - 1]
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
}
