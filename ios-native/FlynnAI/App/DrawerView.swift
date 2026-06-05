import SwiftUI

/// Controls the slide-in hamburger drawer. Injected into the environment by
/// MainTabView so any tab's nav-bar hamburger can open it.
@MainActor
@Observable
final class DrawerController {
    var isOpen = false
}

/// Hamburger button for a tab's nav bar — opens the drawer.
struct DrawerButton: View {
    @Environment(DrawerController.self) private var drawer
    var body: some View {
        Button { drawer.isOpen = true } label: {
            Image(systemName: "line.3.horizontal")
        }
    }
}

/// Wispr-style side drawer: profile + plan at the top, then Settings / Account /
/// Help / Support / referral. Settings and Account are presented as sheets so the
/// drawer stays decoupled from the per-tab navigation stacks.
struct DrawerView: View {
    @Environment(DrawerController.self) private var drawer
    @Environment(FlashStore.self) private var flash
    @Environment(SubscriptionStore.self) private var subscription
    @Environment(\.openURL) private var openURL

    @State private var email: String = ""
    @State private var name: String = ""
    @State private var showingSettings = false
    @State private var showingAccount = false

    private var isPro: Bool { subscription.currentEntitlement != nil }
    private var initials: String {
        let source = name.isEmpty ? email : name
        let first = source.first.map { String($0).uppercased() } ?? "F"
        return first
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            profileHeader
                .padding(FlynnSpacing.lg)

            Divider()

            ScrollView {
                VStack(alignment: .leading, spacing: FlynnSpacing.xs) {
                    row(icon: "gift", title: "Get a free month") {
                        close()
                        flash.success("Referrals are coming soon")
                    }

                    Divider().padding(.vertical, FlynnSpacing.xs)

                    row(icon: "questionmark.circle", title: "Help center", external: true) {
                        close()
                        if let url = URL(string: "https://flynn.so/help") { openURL(url) }
                    }
                    row(icon: "bubble.left.and.text.bubble.right", title: "Talk to support") {
                        close()
                        if let url = URL(string: "mailto:support@flynn.so") { openURL(url) }
                    }

                    Divider().padding(.vertical, FlynnSpacing.xs)

                    row(icon: "gearshape", title: "Settings") {
                        showingSettings = true
                    }
                    row(icon: "person.circle", title: "Account") {
                        showingAccount = true
                    }
                }
                .padding(FlynnSpacing.md)
            }

            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(FlynnColor.background)
        .task { await loadProfile() }
        .sheet(isPresented: $showingSettings) {
            NavigationStack { SettingsView() }
        }
        .sheet(isPresented: $showingAccount) {
            NavigationStack { AccountView() }
        }
    }

    private var profileHeader: some View {
        HStack(spacing: FlynnSpacing.sm) {
            ZStack {
                Circle().fill(FlynnColor.cream)
                Mascot(.wave, size: 46)
            }
            .frame(width: 52, height: 52)
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: FlynnSpacing.xs) {
                    Text(name.isEmpty ? "Flynn" : name)
                        .flynnType(FlynnTypography.h4)
                        .foregroundColor(FlynnColor.textPrimary)
                    Text(isPro ? "Pro" : "Free")
                        .flynnType(FlynnTypography.caption)
                        .foregroundColor(isPro ? .white : FlynnColor.textSecondary)
                        .padding(.horizontal, FlynnSpacing.xs)
                        .padding(.vertical, 2)
                        .background(Capsule().fill(isPro ? FlynnColor.primary : FlynnColor.backgroundSecondary))
                }
                if !email.isEmpty {
                    Text(email)
                        .flynnType(FlynnTypography.caption)
                        .foregroundColor(FlynnColor.textSecondary)
                        .lineLimit(1)
                }
            }
            Spacer(minLength: 0)
        }
    }

    private func row(icon: String, title: String, external: Bool = false, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: FlynnSpacing.sm) {
                Image(systemName: icon)
                    .font(.system(size: 18))
                    .foregroundColor(FlynnColor.textPrimary)
                    .frame(width: 26)
                Text(title)
                    .flynnType(FlynnTypography.bodyMedium)
                    .foregroundColor(FlynnColor.textPrimary)
                Spacer()
                if external {
                    Image(systemName: "arrow.up.right")
                        .font(.caption)
                        .foregroundColor(FlynnColor.textTertiary)
                }
            }
            .padding(.vertical, FlynnSpacing.sm)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private func close() {
        drawer.isOpen = false
    }

    private func loadProfile() async {
        struct Row: Decodable { let full_name: String? }
        do {
            let session = try await FlynnSupabase.client.auth.session
            email = session.user.email ?? ""
            let row: Row = try await FlynnSupabase.client
                .from("users")
                .select("full_name")
                .eq("id", value: session.user.id.uuidString)
                .single()
                .execute()
                .value
            name = row.full_name ?? ""
        } catch {
            // header falls back to email / "Flynn"
        }
    }
}
