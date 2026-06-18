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

    /// Flynn's iMessage/SMS number — the agent users text to get started.
    /// Overridable via Info.plist (FLYNN_CONTACT_NUMBER); defaults to the live number.
    static var flynnContactNumber: String {
        let value = infoString("FLYNN_CONTACT_NUMBER")
        return (value?.isEmpty ?? true) ? "+61497779071" : value!
    }

    /// iOS bundle id registered against the TikTok Business SDK app entry.
    /// Returns nil until configured in Secrets.local.xcconfig.
    static var tiktokAppID: String? {
        let value = infoString("TIKTOK_APP_ID")
        return (value?.isEmpty ?? true) ? nil : value
    }

    /// Numeric TikTok App ID generated when the app is registered in TikTok
    /// Events Manager. Required for SDK init.
    static var tiktokTTAppID: String? {
        let value = infoString("TIKTOK_TTAPP_ID")
        return (value?.isEmpty ?? true) ? nil : value
    }

    private static func infoString(_ key: String) -> String? {
        Bundle.main.object(forInfoDictionaryKey: key) as? String
    }
}
