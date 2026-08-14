import SwiftUI

/// Account screen (reached from the drawer): profile basics, manage subscription,
/// sign out, and delete account.
struct AccountView: View {
    @Environment(AuthStore.self) private var auth
    @Environment(FlashStore.self) private var flash
    @Environment(SubscriptionStore.self) private var subscription
    @Environment(\.openURL) private var openURL
    @Environment(\.dismiss) private var dismiss

    @State private var email: String = ""
    @State private var name: String = ""
    @State private var working = false
    @State private var showDeleteConfirat = false
    /// Shown inline under the Account section as well as via the flash overlay.
    /// A destructive action that quietly failed is the worst kind of failure, so
    /// the message stays on screen rather than sliding away after a few seconds.
    @State private var deleteError: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: FlynnSpacing.lg) {
                profileCard

                section(title: "Subscription") {
                    actionRow(icon: "creditcard", title: "Manage subscription") {
                        if let url = URL(string: "https://apps.apple.com/account/subscriptions") { openURL(url) }
                    }
                    actionRow(icon: "arrow.clockwise", title: "Restore purchases") {
                        Task { await restorePurchases() }
                    }
                }

                section(title: "Account") {
                    actionRow(icon: "rectangle.portrait.and.arrow.right", title: "Sign out") {
                        Task { await auth.signOut() }
                    }
                    actionRow(icon: "trash", title: "Delete account", destructive: true) {
                        showDeleteConfirat = true
                    }
                    if let deleteError {
                        Text(deleteError)
                            .flynnType(FlynnTypography.bodyMedium)
                            .foregroundColor(FlynnColor.error)
                            .fixedSize(horizontal: false, vertical: true)
                            .padding(FlynnSpacing.sm)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(
                                RoundedRectangle(cornerRadius: FlynnRadii.sm, style: .continuous)
                                    .fill(FlynnColor.errorLight)
                            )
                    }
                }
            }
            .padding(FlynnSpacing.lg)
        }
        .background(FlynnColor.background)
        .navigationTitle("Account")
        .navigationBarTitleDisplayMode(.large)
        .toolbar { ToolbarItem(placement: .topBarLeading) { Button("Done") { dismiss() } } }
        .task { await loadProfile() }
        .alert("Delete account?", isPresented: $showDeleteConfirat) {
            Button("Cancel", role: .cancel) {}
            Button("Delete", role: .destructive) { Task { await deleteAccount() } }
        } message: {
            Text("This permanently deletes your account and data. This can't be undone.")
        }
    }

    private var profileCard: some View {
        HStack(spacing: FlynnSpacing.sm) {
            Text((name.isEmpty ? email : name).first.map { String($0).uppercased() } ?? "F")
                .flynnType(FlynnTypography.h3)
                .foregroundColor(.white)
                .frame(width: 52, height: 52)
                .background(Circle().fill(FlynnColor.primary))
            VStack(alignment: .leading, spacing: 2) {
                Text(name.isEmpty ? "Flynn" : name)
                    .flynnType(FlynnTypography.h4)
                    .foregroundColor(FlynnColor.textPrimary)
                Text(email)
                    .flynnType(FlynnTypography.caption)
                    .foregroundColor(FlynnColor.textSecondary)
            }
            Spacer(minLength: 0)
        }
        .padding(FlynnSpacing.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: FlynnRadii.md, style: .continuous).fill(FlynnColor.backgroundSecondary))
        .brutalistBorder(cornerRadius: FlynnRadii.md)
    }

    private func section(title: String, @ViewBuilder content: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: FlynnSpacing.sm) {
            Text(title)
                .flynnType(FlynnTypography.overline)
                .foregroundColor(FlynnColor.textTertiary)
            content()
        }
    }

    private func actionRow(icon: String, title: String, destructive: Bool = false, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: FlynnSpacing.sm) {
                Image(systemName: icon)
                    .font(.system(size: 18))
                    .foregroundColor(destructive ? FlynnColor.error : FlynnColor.primary)
                    .frame(width: 26)
                Text(title)
                    .flynnType(FlynnTypography.bodyMedium)
                    .foregroundColor(destructive ? FlynnColor.error : FlynnColor.textPrimary)
                Spacer()
                Image(systemName: "chevron.right").font(.caption).foregroundColor(FlynnColor.textTertiary)
            }
            .padding(FlynnSpacing.md)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(RoundedRectangle(cornerRadius: FlynnRadii.md, style: .continuous).fill(FlynnColor.backgroundSecondary))
            .brutalistBorder(cornerRadius: FlynnRadii.md)
        }
        .buttonStyle(.plain)
        .disabled(working)
    }

    private func loadProfile() async {
        struct Row: Decodable { let full_name: String? }
        do {
            let session = try await FlynnSupabase.client.auth.session
            email = session.user.email ?? ""
            let row: Row = try await FlynnSupabase.client
                .from("users").select("full_name")
                .eq("id", value: session.user.id.uuidString)
                .single().execute().value
            name = row.full_name ?? ""
        } catch {}
    }

    /// Restore always says what happened. Tapping a button that gives no answer
    /// either way is the single most common thing a reviewer flags on this screen.
    private func restorePurchases() async {
        working = true
        await subscription.restorePurchases()
        switch subscription.restoreState {
        case .restored:
            flash.success("Your subscription is back on this device.")
        case .nothingToRestore:
            flash.info("No subscription found on this Apple Account.")
        case .failed:
            flash.error("Couldn't reach the App Store. Try again in a moment.")
        case .idle, .restoring:
            break
        }
        subscription.acknowledgeRestore()
        working = false
    }

    /// Deletes the account server-side, then signs out.
    ///
    /// The ORDER and the status check both matter. This previously discarded the
    /// response and signed out unconditionally, so a 401/403/500 from the backend
    /// looked exactly like a successful deletion: the user was logged out, their
    /// account and data were still on the server, and they had no way to tell.
    /// That is an App Store 5.1.1(v) rejection and a real data-retention problem.
    /// Only a 2xx counts as deleted; anything else leaves the session intact so
    /// the user can try again.
    private func deleteAccount() async {
        working = true
        deleteError = nil
        do {
            let session = try await FlynnSupabase.client.auth.session
            var req = URLRequest(url: FlynnEnv.flynnAPIBaseURL.appendingPathComponent("me/account/delete"))
            req.httpMethod = "POST"
            req.setValue("Bearer \(session.accessToken)", forHTTPHeaderField: "Authorization")
            let (_, response) = try await URLSession.shared.data(for: req)
            let status = (response as? HTTPURLResponse)?.statusCode ?? 0
            guard (200..<300).contains(status) else {
                FlynnLog.network.error("Account delete returned \(status, privacy: .public)")
                reportDeleteFailure()
                working = false
                return
            }
            await auth.signOut()
        } catch {
            FlynnLog.network.error("Account delete failed: \(error.localizedDescription, privacy: .public)")
            reportDeleteFailure()
        }
        working = false
    }

    private func reportDeleteFailure() {
        let message = "We couldn't delete your account. Nothing has been removed. Try again, or email support@flynnai.app."
        deleteError = message
        flash.error(message)
    }
}
