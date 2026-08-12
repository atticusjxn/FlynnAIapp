import Foundation
import PostHog

/// Product analytics.
///
/// The app shipped with none: no PostHog, no Sentry, no crash reporting, and a
/// single manual Meta `Purchase` call. A crash or a silent API failure in
/// production was invisible, and no step of the onboarding funnel was measured
/// — which is untenable when paid installs are the acquisition model.
///
/// Two things this type exists to guarantee:
///
/// 1. **One identity.** `identify(userId:)` uses the Supabase user id, the same
///    value `services/analytics.js` passes as `distinctId` on the server. If the
///    two ever diverge, client and server events land on different people and
///    every funnel step reads as a drop-off.
///
/// 2. **Never crash the app.** Analytics is disabled, not fatal, when the key
///    is missing. Nothing here may throw into a view.
///
/// Event names are the `Event` enum below. They must stay identical to
/// `EVENTS` in `services/analytics.js` — a typo silently creates a second
/// event and the funnel step it belongs to reads as 100% loss.
enum Analytics {

    // MARK: - Events

    enum Event: String {
        // Acquisition / signup
        case appInstalled = "app_installed"
        case signupStarted = "signup_started"
        case signupCompleted = "signup_completed"

        // Onboarding
        case onboardTradeSelected = "onboard_trade_selected"
        case onboardServicesEntered = "onboard_services_entered"
        case onboardCalendarConnected = "onboard_calendar_connected"

        // The demo call — the value moment
        case demoCallRequested = "demo_call_requested"
        case demoCallAnswered = "demo_call_answered"
        case demoCallCompleted = "demo_call_completed"
        case demoTranscriptViewed = "demo_transcript_viewed"

        // Money
        case paywallViewed = "paywall_viewed"
        case paywallDismissed = "paywall_dismissed"
        case trialStarted = "trial_started"
        case subscriptionPurchased = "subscription_purchased"

        // Activation
        case numberAssigned = "number_assigned"
        case forwardingCodeDialled = "forwarding_code_dialled"
        case forwardingVerified = "forwarding_verified"

        // The product working
        case callAnswered = "call_answered"
        case jobBooked = "job_booked"
        case bookingLinkSent = "booking_link_sent"
        case invoiceSent = "invoice_sent"
        case invoicePaid = "invoice_paid"
    }

    // MARK: - Lifecycle

    /// Immutable by design. The target builds with `SWIFT_STRICT_CONCURRENCY:
    /// complete`, so a mutable `static var` set by `start()` would be unsafe
    /// global shared state — and it is also unnecessary: whether analytics can
    /// run is decided entirely by build config, not by runtime state.
    private static let isEnabled: Bool = FlynnEnv.posthogAPIKey != nil

    /// Call once, as early as possible in app launch.
    static func start() {
        guard let key = FlynnEnv.posthogAPIKey else {
            FlynnLog.app.notice("Analytics disabled — POSTHOG_API_KEY not set")
            return
        }

        let config = PostHogConfig(apiKey: key, host: FlynnEnv.posthogHost)

        // Autocapture is off deliberately. The funnel here is a small number of
        // named steps that have to line up exactly with the server's event
        // names; a flood of inferred UI events would bury them and burn the
        // free tier for nothing.
        config.captureScreenViews = false
        config.captureElementInteractions = false
        config.captureApplicationLifecycleEvents = true

        // Watching someone fail onboarding is worth more than any dashboard,
        // and the free tier covers 2,500 mobile recordings a month — far more
        // than this volume of installs will produce.
        config.sessionReplay = true
        config.sessionReplayConfig.maskAllTextInputs = true
        config.sessionReplayConfig.maskAllImages = false

        PostHogSDK.shared.setup(config)
        FlynnLog.app.notice("Analytics started")
    }

    // MARK: - Identity

    /// Bind everything from here on to the signed-in user. Must be the Supabase
    /// user id — the backend keys its events on the same value.
    static func identify(userId: String, properties: [String: Any] = [:]) {
        guard isEnabled else { return }
        PostHogSDK.shared.identify(userId, userProperties: properties)
    }

    /// Clear identity on sign-out so the next person on the device is not
    /// recorded as the previous one.
    static func reset() {
        guard isEnabled else { return }
        PostHogSDK.shared.reset()
    }

    // MARK: - Capture

    static func capture(_ event: Event, _ properties: [String: Any] = [:]) {
        guard isEnabled else { return }
        PostHogSDK.shared.capture(event.rawValue, properties: properties)
    }

    /// For the handful of one-off diagnostics that do not belong in the funnel
    /// vocabulary. Prefer `Event`.
    static func capture(custom name: String, _ properties: [String: Any] = [:]) {
        guard isEnabled else { return }
        PostHogSDK.shared.capture(name, properties: properties)
    }

    /// Record a caught error. Not a crash reporter — PostHog's own exception
    /// autocapture handles uncaught ones — this is for failures the app
    /// swallows, which until now went only to the device console and were
    /// therefore unobservable in production.
    static func captureFailure(_ context: String, error: Error) {
        guard isEnabled else { return }
        PostHogSDK.shared.capture("app_error", properties: [
            "context": context,
            "message": error.localizedDescription,
        ])
    }

    /// Flush before the app is likely to be suspended or killed.
    static func flush() {
        guard isEnabled else { return }
        PostHogSDK.shared.flush()
    }
}
