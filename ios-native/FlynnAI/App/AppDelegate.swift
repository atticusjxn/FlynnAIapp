import UIKit
import UserNotifications

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
        return true
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
