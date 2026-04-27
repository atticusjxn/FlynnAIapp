import SwiftUI
import AppTrackingTransparency

@main
struct FlynnAIApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @State private var auth = AuthStore()
    @State private var deepLink = DeepLinkRouter()
    @State private var flash = FlashStore()
    @State private var subscription = SubscriptionStore()
    @State private var paywall = PaywallPresentation()
    @AppStorage("flynn.appTheme") private var themeRaw: String = AppTheme.system.rawValue

    init() {
        #if DEBUG
        FlynnFontDebug.logAvailable()
        #endif
    }

    private var colorScheme: ColorScheme? {
        AppTheme(rawValue: themeRaw)?.colorScheme
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(auth)
                .environment(deepLink)
                .environment(flash)
                .environment(subscription)
                .environment(paywall)
                .preferredColorScheme(colorScheme)
                .sheet(isPresented: Binding(
                    get: { paywall.isPresented },
                    set: { paywall.isPresented = $0 }
                )) {
                    SubscriptionView()
                        .environment(flash)
                        .environment(subscription)
                        .preferredColorScheme(colorScheme)
                }
                .onOpenURL { url in
                    // Auth callback (email confirmation / magic link) takes priority —
                    // exchange the URL for a Supabase session before any in-app routing.
                    if url.host?.lowercased() == "auth" {
                        Task { await auth.handleAuthCallback(url: url) }
                    } else {
                        deepLink.handle(url: url)
                    }
                }
                .task {
                    await auth.bootstrap()
                    await subscription.bootstrap()
                    await PushAuthorization.requestAndRegister()
                    // Request App Tracking Transparency permission so the Meta SDK
                    // can collect IDFA for ad attribution. Apple requires this prompt
                    // before any tracking-related data collection.
                    if #available(iOS 14, *) {
                        _ = await ATTrackingManager.requestTrackingAuthorization()
                    }
                }
        }
    }
}
