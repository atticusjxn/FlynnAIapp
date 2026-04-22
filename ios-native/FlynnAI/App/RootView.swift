import SwiftUI

struct RootView: View {
    @Environment(AuthStore.self) private var auth
    @State private var showSplash = true

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
            Color.white.ignoresSafeArea()
        case .signedOut:
            LoginView()
        case .signedIn:
            MainTabView()
        }
    }

    private var isAppReady: Bool {
        switch auth.state {
        case .loading: return false
        default: return true
        }
    }
}
