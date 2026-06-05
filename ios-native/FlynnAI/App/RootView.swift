import SwiftUI

struct RootView: View {
    @Environment(AuthStore.self) private var auth
    @State private var onboarding = OnboardingStore()

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
            signedInContent
                .task(id: authIdentityKey) { await onboarding.load() }
        }
    }

    @ViewBuilder
    private var signedInContent: some View {
        // A plain background (no logo animation) covers the brief window while the
        // onboarding store decides which surface to show, so MainTabView doesn't
        // flash for a frame before load() completes.
        switch onboarding.loadState {
        case .idle, .loading:
            FlynnColor.background.ignoresSafeArea()
        case .loaded, .error:
            if onboarding.onboardingCompleted != true {
                OnboardingCoordinator(store: onboarding)
            } else {
                MainTabView()
            }
        }
    }

    private var authIdentityKey: String {
        switch auth.state {
        case .signedIn(let id, _): return id.uuidString
        default: return "unknown"
        }
    }
}
