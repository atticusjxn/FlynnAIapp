import SwiftUI

struct RootView: View {
    @Environment(AuthStore.self) private var auth

    /// First-run routing for a signed-in user. Decided once per launch:
    ///   - a voice-funnel caller with a staged config → the one-tap claim flow
    ///   - a fresh ad install → the onboarding wizard (trade → … → forwarding)
    ///   - anyone already onboarded (or demo mode) → straight into the app
    private enum FirstRun {
        case undecided
        case claim(VoiceOnboardingClient.StagedSession)
        case wizard
        case none
    }
    @State private var firstRun: FirstRun = .undecided

    var body: some View {
        ZStack {
            content
            FlashBanner()
                .zIndex(50)
        }
    }

    @ViewBuilder
    private var content: some View {
        switch auth.state {
        case .loading:
            FlynnColor.background.ignoresSafeArea()
        case .signedOut:
            LoginView()
        case .signedIn:
            signedIn
        }
    }

    @ViewBuilder
    private var signedIn: some View {
        switch firstRun {
        case .undecided:
            FlynnColor.background.ignoresSafeArea()
                .task { await decideFirstRun() }
        case .claim(let staged):
            ReceptionistClaimFlow(staged: staged) { completeFirstRun() }
        case .wizard:
            OnboardingWizard { completeFirstRun() }
        case .none:
            MainTabView()
        }
    }

    /// Cheap checks first (demo, the local completed flag) so a returning user
    /// goes straight in with no network wait. Only a genuine first run pays for
    /// the staged-session lookup.
    private func decideFirstRun() async {
        #if DEBUG
        // Force the wizard for design/screenshot review:
        //   -FlynnDemo -FlynnOnboarding [-FlynnOnboardingStep trade|business|…]
        if ProcessInfo.processInfo.arguments.contains("-FlynnOnboarding") {
            firstRun = .wizard
            return
        }
        #endif
        if FlynnDemo.isOn || OnboardingModel.isComplete {
            firstRun = .none
            return
        }
        if let staged = try? await VoiceOnboardingClient.stagedSession() {
            firstRun = .claim(staged)
        } else {
            firstRun = .wizard
        }
    }

    private func completeFirstRun() {
        UserDefaults.standard.set(true, forKey: OnboardingModel.completeKey)
        firstRun = .none
    }
}
