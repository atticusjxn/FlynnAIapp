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
    @State private var appleSearchAdsAttribution = AppleSearchAdsAttributionStore()
    @AppStorage("flynn.appTheme") private var themeRaw: String = AppTheme.system.rawValue
    @State private var hasRequestedPermissions = false

    init() {
        #if DEBUG
        FlynnFontDebug.logAvailable()
        #endif
        // Theme the UIKit-backed tab bar and nav bars so they sit on the cream
        // ground instead of rendering as stock iOS above it.
        FlynnChrome.apply()
    }

    private var colorScheme: ColorScheme? {
        AppTheme(rawValue: themeRaw)?.colorScheme
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .tint(FlynnColor.primary)
                .environment(auth)
                .environment(deepLink)
                .environment(flash)
                .environment(subscription)
                .environment(paywall)
                .preferredColorScheme(colorScheme)
                .sheet(isPresented: Binding(
                    get: { paywall.isPresented },
                    set: { presenting in
                        // Route closing through the coordinator so a dismissal
                        // without a purchase is recorded. paywall_viewed minus
                        // paywall_dismissed is the clearest read on whether the
                        // price or the pitch is the problem.
                        if presenting {
                            paywall.isPresented = true
                        } else {
                            paywall.dismissed(purchased: subscription.currentEntitlement != nil)
                        }
                    }
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
                    // A notification tapped on a cold launch arrives before the
                    // scene exists, so the delegate parks it for us.
                    if let parked = PushLaunchInbox.drain() { deepLink.handle(url: parked) }
                    await appleSearchAdsAttribution.captureIfNeeded()
                    await auth.bootstrap()
                    await appleSearchAdsAttribution.claimIfAuthenticated()
                    await subscription.bootstrap()
                    // Permission prompts deliberately do NOT run here. On a cold
                    // install this task fires while the login screen is up, so both
                    // alerts landed before the user had typed anything. The
                    // notification grant is one-shot — a "Don't Allow" there is
                    // permanent short of a Settings trip, and every proactive thing
                    // Flynn does depends on it. They're asked for below, once
                    // there's an account to attach them to.
                    if case .signedIn = auth.state { await requestPermissionsIfNeeded() }
                }
                .onChange(of: auth.state) { _, newState in
                    if case .signedIn = newState {
                        Task { await appleSearchAdsAttribution.claimIfAuthenticated() }
                        // Refresh the keyboard's long-lived token + shared config so
                        // the custom keyboard can reach the backend.
                        Task { await KeyboardBridge.sync() }
                        Task { await requestPermissionsIfNeeded() }
                    } else if case .signedOut = newState {
                        KeyboardBridge.clear()
                    }
                }
        }
    }

    /// Asks for notifications and tracking, once, after sign-in.
    ///
    /// Both are cheap to call repeatedly — iOS only shows each alert once per
    /// install — but `auth.state` can settle to `.signedIn` more than once in a
    /// launch (bootstrap, then the onChange), so this guards anyway rather than
    /// racing two prompts into the same frame.
    @MainActor
    private func requestPermissionsIfNeeded() async {
        // Demo mode is for looking at screens; system permission alerts sit on
        // top of them and can't be dismissed from a screenshot.
        guard !FlynnDemo.isOn, !hasRequestedPermissions else { return }
        hasRequestedPermissions = true
        await PushAuthorization.requestAndRegister()
        // ATT gates the IDFA the Meta SDK needs for ad attribution. It goes
        // second so the notification ask — the one that matters to the product —
        // isn't buried behind a tracking dialog.
        if #available(iOS 14, *) {
            _ = await ATTrackingManager.requestTrackingAuthorization()
        }
    }
}
