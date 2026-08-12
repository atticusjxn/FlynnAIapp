import Foundation
import Observation

/// Small shared coordinator so any screen can open the paywall. Inject as
/// an `@Environment(PaywallPresentation.self)` at root.
@MainActor
@Observable
final class PaywallPresentation {
    var isPresented: Bool = false
    var reason: Reason = .manual

    enum Reason: Equatable {
        case manual              // user tapped "Upgrade"
        case usageLimit          // soft cap hit mid-use
        case featureGate(String) // tried to use a paid feature
    }

    func present(reason: Reason = .manual) {
        self.reason = reason
        isPresented = true
        Analytics.capture(.paywallViewed, ["reason": reason.analyticsValue])
    }

    /// Call when the sheet closes without a purchase. Paired with
    /// `paywall_viewed`, the gap between the two is the single number that says
    /// whether the price or the pitch is wrong.
    func dismissed(purchased: Bool) {
        isPresented = false
        guard !purchased else { return }
        Analytics.capture(.paywallDismissed, ["reason": reason.analyticsValue])
    }
}

extension PaywallPresentation.Reason {
    /// Low-cardinality label — `featureGate` keeps its feature name because
    /// which gate sent them there is the interesting part.
    var analyticsValue: String {
        switch self {
        case .manual: return "manual"
        case .usageLimit: return "usage_limit"
        case .featureGate(let feature): return "feature_gate:\(feature)"
        }
    }
}
