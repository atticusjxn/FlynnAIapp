import Foundation

/// Reads build-time config values from Info.plist (populated via xcconfig).
/// See Config/Shared.xcconfig and Config/Secrets.local.xcconfig.
enum FlynnEnv {
    static var supabaseURL: URL {
        guard let raw = infoString("SUPABASE_URL"), let url = URL(string: raw) else {
            fatalError("SUPABASE_URL missing from Info.plist — check Config/Shared.xcconfig")
        }
        return url
    }

    static var supabaseAnonKey: String {
        guard let key = infoString("SUPABASE_ANON_KEY"), !key.isEmpty else {
            fatalError(
                "SUPABASE_ANON_KEY missing — copy Secrets.local.xcconfig.example to " +
                "Secrets.local.xcconfig and fill it in."
            )
        }
        return key
    }

    static var flynnAPIBaseURL: URL {
        guard let raw = infoString("FLYNN_API_BASE_URL"), let url = URL(string: raw) else {
            fatalError("FLYNN_API_BASE_URL missing from Info.plist")
        }
        return url
    }

    static var stripePublishableKey: String? {
        infoString("STRIPE_PUBLISHABLE_KEY")
    }

    private static func infoString(_ key: String) -> String? {
        Bundle.main.object(forInfoDictionaryKey: key) as? String
    }
}
