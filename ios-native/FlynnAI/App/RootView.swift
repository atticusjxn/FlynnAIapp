import SwiftUI

struct RootView: View {
    @Environment(AuthStore.self) private var auth

    // Voice front-door claim gate: a caller who talked to the ad-line
    // receptionist has a staged config waiting; surface it once on sign-in.
    // Network failure or nothing staged → straight into the app.
    @State private var stagedSession: VoiceOnboardingClient.StagedSession?
    @State private var claimFlowDone = false
    @State private var checkedStaged = false

    var body: some View {
        ZStack {
            content
            FlashBanner()
                .zIndex(50)
        }
    }

    @ViewBuilder
    private var content: some View {
        // Entry is frictionless: a signed-in user goes straight in. The one
        // exception is a staged voice-funnel config, which claims in one tap.
        switch auth.state {
        case .loading:
            FlynnColor.background.ignoresSafeArea()
        case .signedOut:
            LoginView()
        case .signedIn:
            if let stagedSession, !claimFlowDone {
                ReceptionistClaimFlow(staged: stagedSession) {
                    claimFlowDone = true
                }
            } else {
                MainTabView()
                    .task {
                        guard !checkedStaged, !claimFlowDone else { return }
                        checkedStaged = true
                        stagedSession = try? await VoiceOnboardingClient.stagedSession()
                    }
            }
        }
    }
}
