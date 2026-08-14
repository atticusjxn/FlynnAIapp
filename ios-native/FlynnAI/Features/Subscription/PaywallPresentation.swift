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

    /// When the sheet opened, for the dwell time reported on close.
    private var presentedAt: Date?

    func present(reason: Reason = .manual) {
        self.reason = reason
        isPresented = true
        presentedAt = Date()
        Analytics.capture(.paywallViewed, ["reason": reason.analyticsValue])
    }

    /// Call when the sheet closes. Paired with `paywall_viewed`, the gap between
    /// the two is the single number that says whether the price or the pitch is
    /// wrong — and `seconds_on_screen` is what separates those two answers. A
    /// two-second bounce is a targeting or expectation miss; someone who reads
    /// the whole thing and still says no is telling you about price. Without the
    /// duration both arrive as one undifferentiated "dismissed".
    func dismissed(purchased: Bool) {
        isPresented = false
        let seconds = presentedAt.map { Int(Date().timeIntervalSince($0)) }
        presentedAt = nil
        guard !purchased else { return }
        var props: [String: Any] = ["reason": reason.analyticsValue]
        if let seconds { props["seconds_on_screen"] = seconds }
        Analytics.capture(.paywallDismissed, props)
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
