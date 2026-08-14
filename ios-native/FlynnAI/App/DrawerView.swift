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
        .accessibilityLabel("Menu")
    }
}

/// Wispr-style side drawer: profile + plan at the top, then Help & support,
/// Settings and Account. All three are presented as sheets so the drawer stays
/// decoupled from the per-tab navigation stacks.
struct DrawerView: View {
    @Environment(FlashStore.self) private var flash
    @Environment(SubscriptionStore.self) private var subscription

    @State private var email: String = ""
    @State private var name: String = ""
    @State private var showingSettings = false
    @State private var showingAccount = false
    @State private var showingSupport = false

    /// Badge next to the name. The tiers Flynn actually sells are Flynn Link and
    /// Flynn Receptionist — there is no "Free" tier and no "Pro", so the badge
    /// shows the entitlement's own display name, and "Trial" while the intro
    /// offer is running. No entitlement means no badge rather than a made-up one.
    private var planBadge: String? {
        guard let entitlement = subscription.currentEntitlement else { return nil }
        return entitlement.isInIntroOffer ? "Trial" : entitlement.plan.displayName
    }
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
                    // The "Get a free month" referral row was removed — it was
                    // the top item and did nothing but flash "coming soon".
                    // These two used to open flynn.so — a domain Flynn doesn't own —
                    // and mailto:support@flynn.so, an address nobody reads. Both are
                    // links a reviewer taps. They now open the real in-app SupportView,
                    // which carries the actual support address and help centre.
                    row(icon: "questionmark.circle", title: "Help & support") {
                        showingSupport = true
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
            NavigationStack { SettingsView() }.flynnFlashOverlay()
        }
        .sheet(isPresented: $showingAccount) {
            NavigationStack { AccountView() }.flynnFlashOverlay()
        }
        .sheet(isPresented: $showingSupport) {
            NavigationStack {
                // SupportView is normally pushed from Settings, so it carries no
                // dismiss of its own. Presented as a sheet it needs one.
                SupportView()
                    .toolbar {
                        ToolbarItem(placement: .topBarLeading) {
                            Button("Done") { showingSupport = false }
                        }
                    }
            }
            .flynnFlashOverlay()
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
                    if let planBadge {
                        Text(planBadge)
                            .flynnType(FlynnTypography.caption)
                            .foregroundColor(.white)
                            .lineLimit(1)
                            .padding(.horizontal, FlynnSpacing.xs)
                            .padding(.vertical, 2)
                            .background(Capsule().fill(FlynnColor.primary))
                    }
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

    /// Every drawer row now opens something inside the app, so there's no
    /// external-link affordance left to draw.
    private func row(icon: String, title: String, action: @escaping () -> Void) -> some View {
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
            }
            .padding(.vertical, FlynnSpacing.sm)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
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
