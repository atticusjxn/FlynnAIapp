import Foundation

/// The "you're missing something that just cost you" notification.
///
/// Deliberately **not** a profile-completeness reminder. "Your profile is 60%
/// complete" is nagging, it fires whether or not the gap matters, and it
/// contradicts Flynn's own tone rule ("proactive but not pushy… never nags").
///
/// This fires only when a real interaction hit a fact Flynn didn't have — a
/// caller asked the hours and it couldn't answer. That's persuasive because it
/// already cost a job, and it's self-limiting, because a gap nobody asks about
/// never nags anyone.
///
/// ## Backend contract
///
/// The server decides when a gap actually bit and sends:
///
/// ```json
/// {
///   "aps": { "alert": {
///       "title": "Someone asked about your hours",
///       "body":  "Dave called at 7:40am and I couldn't tell him when you open. Want to tell me?"
///   }},
///   "flynn_gap": "hours",
///   "deeplink": "flynnai://brain?gap=hours"
/// }
/// ```
///
/// `flynn_gap` is one of the `Gap` cases below. Copy is written server-side so it
/// can name the caller and the time — the app only routes.
///
/// Rate limiting is the server's job too: at most one gap nudge per gap, and
/// stop after three unanswered attempts, per the tone rules.
enum BrainGapNudge {

    enum Gap: String, CaseIterable {
        case hours
        case pricing
        case services
        case serviceArea = "service_area"
        case businessType = "business_type"

        /// What the Brain screen should prompt them to say when they arrive.
        var prompt: String {
            switch self {
            case .hours: return "Try: \"we're open 7 to 4 weekdays, closed weekends\""
            case .pricing: return "Try: \"$90 callout, quotes are free\""
            case .services: return "Try: \"blocked drains, hot water, leak detection\""
            case .serviceArea: return "Try: \"Northern Beaches and the North Shore\""
            case .businessType: return "Try: \"I'm a plumber\""
            }
        }
    }

    /// Pulls the gap out of a notification payload, if it is one.
    static func gap(from userInfo: [AnyHashable: Any]) -> Gap? {
        guard let raw = userInfo["flynn_gap"] as? String else { return nil }
        return Gap(rawValue: raw)
    }

    /// The link a tapped notification should follow. Falls back to the explicit
    /// `deeplink` key so the server can route to anything else it likes.
    static func link(from userInfo: [AnyHashable: Any]) -> URL? {
        if let gap = gap(from: userInfo) {
            return URL(string: "flynnai://brain?gap=\(gap.rawValue)")
        }
        if let s = userInfo["deeplink"] as? String { return URL(string: s) }
        return nil
    }
}

/// Hands a tapped notification from the UIKit app delegate to SwiftUI.
///
/// `DeepLinkRouter` is per-scene state owned by `FlynnAIApp`, and the delegate
/// callback can land before that exists on a cold launch, so the URL is parked
/// here and drained once the scene is up.
@MainActor
enum PushLaunchInbox {
    private(set) static var pending: URL?

    static func park(_ url: URL?) { pending = url }

    static func drain() -> URL? {
        defer { pending = nil }
        return pending
    }
}
