import SwiftUI

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
                .onOpenURL { url in deepLink.handle(url: url) }
                .task {
                    await auth.bootstrap()
                    await subscription.bootstrap()
                    await PushAuthorization.requestAndRegister()
                }
        }
    }
}
