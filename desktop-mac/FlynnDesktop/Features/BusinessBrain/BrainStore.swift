import Foundation
import Supabase

/// Fetches and caches the user's business profile from Supabase.
/// The profile is used server-side for drafting but is fetched here for
/// local display (Settings > Business Brain) and slot intent context.
@MainActor
@Observable
final class BrainStore {
    static let shared = BrainStore()

    private(set) var profile: BusinessProfileDTO?
    private(set) var isLoading = false
    private(set) var lastError: String?

    private let supabase = FlynnSupabase.client
    private init() {}

    func fetchIfNeeded() async {
        guard profile == nil else { return }
        await fetch()
    }

    func fetch() async {
        guard let userID = await AuthService.shared.userID else { return }
        isLoading = true; lastError = nil
        defer { isLoading = false }
        do {
            let result: [BusinessProfileDTO] = try await supabase
                .from("business_profiles")
                .select()
                .eq("user_id", value: userID.uuidString)
                .limit(1)
                .execute()
                .value
            profile = result.first
        } catch {
            lastError = error.localizedDescription
        }
    }

    var displayName: String {
        profile?.businessName ?? profile?.industry ?? "Your Business"
    }
}
