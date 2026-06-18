import SwiftUI

struct RootView: View {
    @Environment(AuthStore.self) private var auth

    var body: some View {
        ZStack {
            content
            FlashBanner()
                .zIndex(50)
        }
    }

    @ViewBuilder
    private var content: some View {
        // Entry is frictionless: brain setup happens over iMessage, so a signed-in
        // user goes straight in. Texting Flynn (or tapping the magic link he texts)
        // is the only "onboarding".
        switch auth.state {
        case .loading:
            FlynnColor.background.ignoresSafeArea()
        case .signedOut:
            LoginView()
        case .signedIn:
            MainTabView()
        }
    }
}
