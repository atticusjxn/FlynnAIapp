import SwiftUI

/// The onboarding wizard for ad installs — the funnel that was missing.
///
/// Before this, RootView sent a fresh signup straight to an empty Home: no
/// paywall, no number, no forwarding, nothing that turns an install into a
/// paying, live receptionist. This is that path, value-first:
///
///   trade → business → calendar → **demo call** → paywall → number → forwarding
///
/// The demo call is the value moment — Flynn rings them so they hear the
/// product before they're asked for a card. Two steps depend on backend that is
/// still being built (placing the live demo call, server-verifying the divert);
/// those are marked `BACKEND` and degrade gracefully so the flow is walkable and
/// designable now.
///
/// Every step fires a PostHog event so the funnel is measurable from the first
/// install — the whole point of the paid-acquisition model.
struct OnboardingWizard: View {
    /// Called when the wizard is finished or skipped — RootView drops into the app.
    let onFinished: () -> Void

    @State private var model = OnboardingModel()
    @Environment(SubscriptionStore.self) private var subscription
    @Environment(PaywallPresentation.self) private var paywall

    var body: some View {
        ZStack {
            FlynnColor.background.ignoresSafeArea()

            VStack(spacing: 0) {
                header
                stepContent
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .transition(.asymmetric(
                        insertion: .move(edge: .trailing).combined(with: .opacity),
                        removal: .move(edge: .leading).combined(with: .opacity)
                    ))
                    .id(model.step)
            }
        }
        .animation(.spring(response: 0.42, dampingFraction: 0.86), value: model.step)
        .onAppear {
            // Only a genuinely fresh start counts as signup_completed — a
            // resumed session (app killed mid-flow, relaunched) starts past
            // .welcome and would otherwise double-count the same signup.
            if model.step == .welcome { Analytics.capture(.signupCompleted) }
            Task { await model.rehydrateIfResumed() }
        }
        // The paywall lives on the WindowGroup above everything; presenting it
        // just flips a flag. Resume number assignment when it closes.
        .onChange(of: paywall.isPresented) { wasUp, isUp in
            guard wasUp, !isUp, model.step == .paywall else { return }
            Task { await assignNumberOrPaywall() }
        }
    }

    // MARK: - Header (progress)

    private var header: some View {
        HStack(spacing: FlynnSpacing.xs) {
            if model.step.canGoBack {
                Button { model.back() } label: {
                    Image(systemName: "chevron.left")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundColor(FlynnColor.textSecondary)
                        .frame(width: 40, height: 40)
                }
            } else {
                Color.clear.frame(width: 40, height: 40)
            }

            // Progress dots for the setup steps (welcome/done excluded).
            HStack(spacing: 6) {
                ForEach(OnboardingStep.tracked, id: \.self) { s in
                    Capsule()
                        .fill(s.index <= model.step.index ? FlynnColor.primary : FlynnColor.borderSubtle)
                        .frame(height: 4)
                        .frame(maxWidth: .infinity)
                }
            }
            .frame(maxWidth: .infinity)

            Button("Skip") { skip() }
                .flynnType(FlynnTypography.caption)
                .foregroundColor(FlynnColor.textTertiary)
                .frame(width: 40, height: 40)
                .opacity(model.step.canSkip ? 1 : 0)
                .disabled(!model.step.canSkip)
        }
        .padding(.horizontal, FlynnSpacing.md)
        .padding(.top, FlynnSpacing.xs)
        .padding(.bottom, FlynnSpacing.sm)
    }

    // MARK: - Steps

    @ViewBuilder
    private var stepContent: some View {
        switch model.step {
        case .welcome:    WelcomeStep(model: model)
        case .trade:      TradeStep(model: model)
        case .business:   BusinessStep(model: model)
        case .calendar:   CalendarStep(model: model)
        case .demoCall:   DemoCallStep(model: model)
        case .paywall:    PaywallStep(model: model, onStart: startTrial)
        case .forwarding: ForwardingStep(model: model)
        case .done:       DoneStep(model: model, onFinish: onFinished)
        }
    }

    // MARK: - Paywall / number

    private func startTrial() {
        if subscription.currentEntitlement != nil {
            Task { await assignNumberOrPaywall() }
        } else {
            paywall.present(reason: .featureGate("your receptionist"))
        }
    }

    private func assignNumberOrPaywall() async {
        guard subscription.currentEntitlement != nil else { return } // backed out of paywall
        Analytics.capture(.trialStarted, ["source": "onboarding"])
        await model.assignNumber()
        model.advance(to: .forwarding)
    }

    private func skip() {
        Analytics.capture(.paywallDismissed, ["source": "onboarding", "reason": "skipped"])
        model.markComplete()
        onFinished()
    }
}

// MARK: - Model

@MainActor
@Observable
final class OnboardingModel {
    var step: OnboardingStep = .welcome

    /// Resumable snapshot — an app kill mid-flow used to lose everything and
    /// restart from `.welcome`, silently discarding whatever trade/business
    /// data the user had already entered. Persisted to UserDefaults (not
    /// Keychain: nothing here is a secret) on every step advance; cleared once
    /// the wizard actually finishes or is skipped.
    private struct Snapshot: Codable {
        var step: OnboardingStep
        var trade: String?
        var businessName: String
        var services: String
        var pricing: String
        var serviceArea: String
        var forwardingDialled: Bool
    }
    private static let stateKey = "flynn.onboardingState"

    init() {
        if let snap = Self.restoreState(), snap.step != .welcome, snap.step != .done {
            step = snap.step
            trade = snap.trade
            businessName = snap.businessName
            services = snap.services
            pricing = snap.pricing
            serviceArea = snap.serviceArea
            forwardingDialled = snap.forwardingDialled
        }
        #if DEBUG
        // Jump straight to a step for screenshots: -FlynnOnboardingStep demoCall
        let args = ProcessInfo.processInfo.arguments
        if let i = args.firstIndex(of: "-FlynnOnboardingStep"), i + 1 < args.count,
           let s = OnboardingStep(name: args[i + 1]) {
            step = s
        }
        #endif
    }

    private func persistState() {
        let snap = Snapshot(
            step: step, trade: trade, businessName: businessName,
            services: services, pricing: pricing, serviceArea: serviceArea,
            forwardingDialled: forwardingDialled
        )
        guard let data = try? JSONEncoder().encode(snap) else { return }
        UserDefaults.standard.set(data, forKey: Self.stateKey)
    }

    private static func restoreState() -> Snapshot? {
        guard let data = UserDefaults.standard.data(forKey: stateKey) else { return nil }
        return try? JSONDecoder().decode(Snapshot.self, from: data)
    }

    private static func clearState() {
        UserDefaults.standard.removeObject(forKey: stateKey)
    }

    /// A resumed session at `.forwarding`/`.done` needs its assigned number
    /// re-hydrated from the server — it's ephemeral server state, deliberately
    /// not part of the persisted snapshot (numbers/entitlements can change
    /// between app launches; the account row is the source of truth).
    func rehydrateIfResumed() async {
        guard step == .forwarding || step == .done, assignedNumber == nil else { return }
        struct Row: Decodable { let twilio_phone_number: String? }
        do {
            let session = try await FlynnSupabase.client.auth.session
            let row: Row = try await FlynnSupabase.client
                .from("users")
                .select("twilio_phone_number")
                .eq("id", value: session.user.id.uuidString)
                .single()
                .execute()
                .value
            assignedNumber = row.twilio_phone_number
        } catch {
            FlynnLog.network.error("Onboarding resume rehydrate failed: \(error.localizedDescription, privacy: .public)")
        }
    }

    // Collected details
    var trade: String?
    var businessName = ""
    var services = ""
    var pricing = ""
    var serviceArea = ""

    // Provisioning
    var assignedNumber: String?
    var numberError: String?
    /// True once assignNumber() has actually run and come back with no number
    /// because the pool was temporarily empty — distinct from `working`, which
    /// is only true for the moment the request is in flight. Lets the
    /// forwarding step show a real retry instead of quietly moving on with no
    /// number assigned.
    var poolEmpty = false
    var working = false

    // Forwarding
    var forwardingDialled = false
    enum ForwardingStatus { case idle, verifying, verified, unconfirmed }
    var forwardingStatus: ForwardingStatus = .idle

    // Demo call
    enum DemoStatus { case idle, ringing, completed, failed }
    var demoStatus: DemoStatus = .idle
    var demoCallId: String?
    var demoTranscript: String?
    var demoJobTitle: String?

    /// Step transitions carry no automatic analytics fire — each meaningful
    /// action (trade picked, business saved, calendar connected, demo
    /// requested, paywall viewed, code dialled) captures its own event at the
    /// point it actually happens. Firing generically here used to mean e.g.
    /// "onboard_calendar_connected" landed the instant the calendar *screen*
    /// appeared, before the user had tapped anything.
    func advance(to next: OnboardingStep) {
        step = next
        persistState()
    }

    func next() { if let n = step.next { advance(to: n) } }
    func back() { if let p = step.previous { step = p } }

    /// Save the business profile, then advance. Shows the button's loading state
    /// while the PATCH is in flight.
    func saveThenNext() {
        Task {
            working = true
            await saveBusiness()
            working = false
            Analytics.capture(.onboardServicesEntered)
            next()
        }
    }

    /// Persist what we've gathered to the business profile. Reuses the same
    /// PATCH the Brain screen uses.
    func saveBusiness() async {
        struct Patch: Encodable {
            let business_type: String?
            let ai_instructions: String?
            let pricing_notes: String?
            let service_areas: [String]?
        }
        let areas = serviceArea
            .split(separator: ",")
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty }
        let patch = Patch(
            business_type: trade,
            ai_instructions: services.isEmpty ? nil : services,
            pricing_notes: pricing.isEmpty ? nil : pricing,
            service_areas: areas.isEmpty ? nil : areas
        )
        do {
            let session = try await FlynnSupabase.client.auth.session
            var req = URLRequest(url: FlynnEnv.flynnAPIBaseURL.appendingPathComponent("api/business-profile"))
            req.httpMethod = "PATCH"
            req.setValue("Bearer \(session.accessToken)", forHTTPHeaderField: "Authorization")
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.httpBody = try JSONEncoder().encode(patch)
            _ = try await URLSession.shared.data(for: req)
        } catch {
            FlynnLog.network.error("Onboarding business save failed: \(error.localizedDescription, privacy: .public)")
        }
    }

    /// Ring the user's own mobile, then poll for the transcript + extracted job.
    func startDemoCall() async {
        demoStatus = .ringing
        demoTranscript = nil
        demoJobTitle = nil
        do {
            let id = try await VoiceOnboardingClient.startDemoCall()
            demoCallId = id
            Analytics.capture(.demoCallRequested)
            await pollDemoCall(id: id)
        } catch {
            FlynnLog.network.error("Demo call failed to start: \(error.localizedDescription, privacy: .public)")
            demoStatus = .failed
        }
    }

    private func pollDemoCall(id: String) async {
        // The call rings up to ~25s, then the conversation, then the server
        // captures the transcript on hang-up. Poll for ~2 minutes at 2s.
        for _ in 0..<60 {
            try? await Task.sleep(for: .seconds(2))
            guard let status = try? await VoiceOnboardingClient.demoCallStatus(id: id) else { continue }
            switch status.status {
            case "completed":
                demoTranscript = status.transcript
                demoJobTitle = status.extractedJob?.serviceType
                demoStatus = .completed
                Analytics.capture(.demoCallCompleted)
                return
            case "no_answer", "failed", "canceled":
                demoStatus = .failed
                return
            default:
                continue   // ringing / in_progress
            }
        }
        demoStatus = .failed
    }

    func assignNumber() async {
        working = true
        numberError = nil
        poolEmpty = false
        defer { working = false }
        do {
            let assigned = try await VoiceOnboardingClient.assignNumber()
            assignedNumber = assigned.phoneNumber
            Analytics.capture(.numberAssigned, ["source": "onboarding"])
        } catch VoiceOnboardingClient.VoiceOnboardingError.poolEmpty {
            assignedNumber = ""
            poolEmpty = true
            Analytics.capture(.numberAssigned, ["source": "onboarding", "result": "pool_empty"])
        } catch {
            numberError = error.localizedDescription
        }
    }

    /// After the user dials the divert code, ask the server to confirm it via a
    /// test call. When the feature is off (prod default) this just proceeds on
    /// their confirmation.
    func verifyForwarding() async {
        forwardingStatus = .verifying
        do {
            let start = try await VoiceOnboardingClient.startForwardingVerify()
            guard start.enabled, let id = start.verificationId else {
                forwardingStatus = .idle
                advance(to: .done)
                return
            }
            for _ in 0..<20 {
                try? await Task.sleep(for: .seconds(2))
                guard let result = try? await VoiceOnboardingClient.forwardingVerifyStatus(id: id) else { continue }
                switch result.status {
                case "verified":
                    forwardingStatus = .verified
                    Analytics.capture(.forwardingVerified)
                    advance(to: .done)
                    return
                case "not_forwarded", "expired":
                    forwardingStatus = .unconfirmed
                    return
                default:
                    continue
                }
            }
            forwardingStatus = .unconfirmed
        } catch {
            forwardingStatus = .unconfirmed
        }
    }

    func markComplete() {
        UserDefaults.standard.set(true, forKey: OnboardingModel.completeKey)
        Self.clearState()
    }

    static let completeKey = "flynn.onboardingComplete"
    static var isComplete: Bool { UserDefaults.standard.bool(forKey: completeKey) }
}

// MARK: - Steps enum

enum OnboardingStep: Int, Hashable, CaseIterable, Codable {
    case welcome, trade, business, calendar, demoCall, paywall, forwarding, done

    var index: Int { rawValue }
    static let tracked: [OnboardingStep] = [.trade, .business, .calendar, .demoCall, .paywall, .forwarding]

    init?(name: String) {
        switch name {
        case "welcome": self = .welcome
        case "trade": self = .trade
        case "business": self = .business
        case "calendar": self = .calendar
        case "demoCall": self = .demoCall
        case "paywall": self = .paywall
        case "forwarding": self = .forwarding
        case "done": self = .done
        default: return nil
        }
    }

    var next: OnboardingStep? { OnboardingStep(rawValue: rawValue + 1) }
    var previous: OnboardingStep? { rawValue > 0 ? OnboardingStep(rawValue: rawValue - 1) : nil }

    var canGoBack: Bool { self != .welcome && self != .done && self != .forwarding }
    // An escape hatch on every step but the last, so no one is ever trapped in
    // the funnel — a returning user, or anyone who wants to look around first.
    var canSkip: Bool { self != .done }

}
