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
    }
}
