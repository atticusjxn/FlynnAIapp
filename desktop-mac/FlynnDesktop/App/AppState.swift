import Foundation

/// Global app state observable. Bridges auth, permissions, and engine lifecycle
/// for SwiftUI views that need cross-cutting state.
@MainActor
@Observable
final class AppState {
    static let shared = AppState()

    var auth = AuthService.shared
    var brain = BrainStore.shared
    var preDraftEngine = PreDraftEngine.shared
    var browserBridge = BrowserBridgeServer.shared

    var isPaused: Bool = UserDefaults.standard.bool(forKey: "isPaused") {
        didSet { UserDefaults.standard.set(isPaused, forKey: "isPaused") }
    }

    private init() {}

    // MARK: - App startup

    func onAppDidFinishLaunching() {
        browserBridge.start()
        if auth.isLoggedIn {
            Task { await brain.fetchIfNeeded() }
            if !isPaused { preDraftEngine.startIfAllowed() }
        }
        // Wire browser conversation callback into the popup coordinator
        browserBridge.onConversationReceived = { [weak self] context in
            Task { @MainActor in
                await DraftPopupCoordinator.shared.handleBrowserConversation(context)
            }
        }
    }

    func onAuthStateChanged() {
        if auth.isLoggedIn {
            Task { await brain.fetchIfNeeded() }
            if !isPaused { preDraftEngine.startIfAllowed() }
        } else {
            preDraftEngine.stop()
        }
    }
}
