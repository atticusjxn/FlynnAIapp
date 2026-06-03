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

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: FlynnSpacing.lg) {
                profileCard

                section(title: "Subscription") {
                    actionRow(icon: "creditcard", title: "Manage subscription") {
                        if let url = URL(string: "https://apps.apple.com/account/subscriptions") { openURL(url) }
                    }
                    actionRow(icon: "arrow.clockwise", title: "Restore purchases") {
                        Task { await subscription.restorePurchases() }
                    }
                }

                section(title: "Account") {
                    actionRow(icon: "rectangle.portrait.and.arrow.right", title: "Sign out") {
                        Task {
                            KeyboardBridge.clear()
                            await auth.signOut()
                        }
                    }
                    actionRow(icon: "trash", title: "Delete account", destructive: true) {
                        showDeleteConfirat = true
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

    private func deleteAccount() async {
        working = true
        do {
            let session = try await FlynnSupabase.client.auth.session
            var req = URLRequest(url: FlynnEnv.flynnAPIBaseURL.appendingPathComponent("me/account/delete"))
            req.httpMethod = "POST"
            req.setValue("Bearer \(session.accessToken)", forHTTPHeaderField: "Authorization")
            _ = try await URLSession.shared.data(for: req)
            KeyboardBridge.clear()
            await auth.signOut()
        } catch {
            flash.error("Couldn't delete account — try again")
        }
        working = false
    }
}
