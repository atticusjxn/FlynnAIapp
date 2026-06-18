import Foundation
import UserNotifications

/// Fires immediate local notifications for in-app confirmations (e.g. a booking
/// written to the calendar). The app is already the notification-center delegate
/// and presents banners in the foreground (see AppDelegate), so these show whether
/// the user is in Flynn or has switched away.
enum LocalNotifier {
    static func calendarAdded(title: String, at date: Date) async {
        let center = UNUserNotificationCenter.current()
        guard await center.notificationSettings().authorizationStatus != .denied else { return }

        let content = UNMutableNotificationContent()
        content.title = "Added to your calendar ✓"
        let formatter = DateFormatter()
        formatter.locale = .current
        formatter.dateFormat = "EEE d MMM · h:mm a"
        content.body = "\(title) · \(formatter.string(from: date))"
        content.sound = .default

        let request = UNNotificationRequest(
            identifier: "flynn.calendar.\(UUID().uuidString)",
            content: content,
            trigger: nil // deliver immediately
        )
        try? await center.add(request)
    }
}
