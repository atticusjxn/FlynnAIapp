import SwiftUI

@main
struct FlynnAIApp: App {
    @State private var auth = AuthStore()
    @State private var deepLink = DeepLinkRouter()
    @State private var flash = FlashStore()

    init() {
        #if DEBUG
        FlynnFontDebug.logAvailable()
        #endif
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(auth)
                .environment(deepLink)
                .environment(flash)
                .onOpenURL { url in deepLink.handle(url: url) }
                .task { await auth.bootstrap() }
        }
    }
}
