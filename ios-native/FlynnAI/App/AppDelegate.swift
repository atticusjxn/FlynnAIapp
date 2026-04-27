import UIKit
import UserNotifications
import FBSDKCoreKit

/// Bridges UIKit's push-notification callbacks into SwiftUI via
/// `@UIApplicationDelegateAdaptor`. Registers the device for remote
/// notifications and writes the APNs token to `users.push_token` so the
/// backend `pushNotifier` can address the device.
final class AppDelegate: NSObject, UIApplicationDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
    ) -> Bool {
        UNUserNotificationCenter.current().delegate = self

        // Initialise the Meta Facebook SDK for app-install attribution and event logging.
        // Auto-events (App Install, app activation) fire automatically. We log
        // StartTrial / CompletedRegistration / Purchase manually from the relevant views.
        ApplicationDelegate.shared.application(
            application,
            didFinishLaunchingWithOptions: launchOptions
        )
        Settings.shared.isAdvertiserIDCollectionEnabled = true
        Settings.shared.isAutoLogAppEventsEnabled = true

        return true
    }

    /// Forwards OAuth-style URL callbacks (e.g. fb<APP_ID>://) to the FB SDK.
    /// Note: `flynnai://auth/callback` is handled in FlynnAIApp via `.onOpenURL`.
    func application(
        _ app: UIApplication,
        open url: URL,
        options: [UIApplication.OpenURLOptionsKey: Any] = [:]
    ) -> Bool {
        return ApplicationDelegate.shared.application(app, open: url, options: options)
    }

    func application(
        _ application: UIApplication,
        didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
    ) {
        let tokenHex = deviceToken.map { String(format: "%02x", $0) }.joined()
        Task { await PushTokenSync.shared.update(token: tokenHex) }
    }

    func application(
        _ application: UIApplication,
        didFailToRegisterForRemoteNotificationsWithError error: Error
    ) {
        FlynnLog.network.error("APNs registration failed: \(error.localizedDescription, privacy: .public)")
    }
}

extension AppDelegate: UNUserNotificationCenterDelegate {
    /// Show pushes while the app is in foreground so users see tradie-critical
    /// notifications (new call captured, minutes nearly exhausted).
    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping @Sendable (UNNotificationPresentationOptions) -> Void
    ) {
        completionHandler([.banner, .sound, .badge])
    }
}
