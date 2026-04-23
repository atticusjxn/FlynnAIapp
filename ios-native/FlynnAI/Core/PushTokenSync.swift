import Foundation
import UIKit
import UserNotifications
import Supabase

/// Tiny actor that owns writes of the APNs device token to `users.push_token`.
/// Idempotent — a repeat token for the same user is a cheap no-op on the DB side.
actor PushTokenSync {
    static let shared = PushTokenSync()

    private var lastSynced: String?

    private init() {}

    /// Call after `registerForRemoteNotifications` succeeds.
    func update(token: String) async {
        guard token != lastSynced else { return }
        do {
            let client = FlynnSupabase.client
            let session = try await client.auth.session
            struct Patch: Encodable { let push_token: String }
            try await client
                .from("users")
                .update(Patch(push_token: token))
                .eq("id", value: session.user.id.uuidString)
                .execute()
            lastSynced = token
        } catch {
            FlynnLog.network.error("PushTokenSync.update failed: \(error.localizedDescription, privacy: .public)")
        }
    }
}

/// Prompts the user for notification permission and registers the device
/// with APNs. Call after auth is confirmed and the user has seen onboarding,
/// so the permission prompt lands at a point they understand.
enum PushAuthorization {
    @MainActor
    static func requestAndRegister() async {
        do {
            let granted = try await UNUserNotificationCenter.current()
                .requestAuthorization(options: [.alert, .sound, .badge])
            if granted {
                UIApplication.shared.registerForRemoteNotifications()
            }
        } catch {
            FlynnLog.network.error("Notification authorization failed: \(error.localizedDescription, privacy: .public)")
        }
    }
}
