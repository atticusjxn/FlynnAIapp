import SwiftUI

struct RootView: View {
    @Environment(AuthStore.self) private var auth
    @State private var showSplash = true
    @State private var onboarding = OnboardingStore()

    var body: some View {
        ZStack {
            content
            FlashBanner()
                .zIndex(50)
            if showSplash {
                AnimatedSplashView(
                    isAppReady: isAppReady,
                    onFinish: { showSplash = false }
                )
                .transition(.opacity)
                .zIndex(100)
            }
        }
        .animation(.easeOut(duration: 0.2), value: showSplash)
    }

    @ViewBuilder
    private var content: some View {
        switch auth.state {
        case .loading:
            FlynnColor.splashBackground.ignoresSafeArea()
        case .signedOut:
            LoginView()
        case .signedIn:
            signedInContent
                .task(id: authIdentityKey) { await onboarding.load() }
        }
    }

    @ViewBuilder
    private var signedInContent: some View {
        if onboarding.onboardingCompleted != true {
            OnboardingCoordinator(store: onboarding)
        } else {
            MainTabView()
        }
    }

    private var authIdentityKey: String {
        switch auth.state {
        case .signedIn(let id, _): return id.uuidString
        default: return "unknown"
        }
    }

    private var isAppReady: Bool {
        switch auth.state {
        case .loading:
            return false
        case .signedOut:
            return true
        case .signedIn:
            // Keep splash up until the onboarding store knows which surface to show,
            // otherwise SwiftUI renders MainTabView for a frame while load() runs.
            switch onboarding.loadState {
            case .loaded, .error: return true
            case .idle, .loading: return false
            }
        }
    }
}
