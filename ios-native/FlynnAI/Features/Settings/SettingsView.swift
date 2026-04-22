import SwiftUI

struct SettingsView: View {
    @Environment(AuthStore.self) private var auth
    @State private var isSigningOut = false

    var body: some View {
        List {
            profileSection
            Section("Business") {
                row(.businessProfile)
                row(.bookingPage)
                row(.businessType)
                row(.callForwarding)
            }
            Section("Billing") {
                row(.billing)
            }
            Section("Integrations") {
                row(.integrations)
            }
            Section("Preferences") {
                row(.notifications)
                row(.appearance)
            }
            Section("Support") {
                row(.support)
                row(.terms)
            }
            Section("Account") {
                row(.account)
                signOutButton
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle("Settings")
    }

    // MARK: Profile header

    private var profileSection: some View {
        Section {
            VStack(alignment: .leading, spacing: FlynnSpacing.xs) {
                Text(userEmail ?? "Signed in")
                    .flynnType(FlynnTypography.h3)
                    .foregroundColor(FlynnColor.textPrimary)
                Text("Flynn account")
                    .flynnType(FlynnTypography.caption)
                    .foregroundColor(FlynnColor.textTertiary)
            }
            .padding(.vertical, FlynnSpacing.xxs)
        }
    }

    private var userEmail: String? {
        switch auth.state {
        case .signedIn(_, let email): return email
        default: return nil
        }
    }

    // MARK: Row builder

    private func row(_ section: SettingsSection) -> some View {
        NavigationLink(value: Route.settingsSection(section)) {
            Label(section.title, systemImage: section.systemImage)
        }
    }

    // MARK: Sign out

    private var signOutButton: some View {
        Button(role: .destructive) {
            isSigningOut = true
            Task {
                await auth.signOut()
                isSigningOut = false
            }
        } label: {
            HStack {
                Label("Sign out", systemImage: "rectangle.portrait.and.arrow.right")
                    .foregroundColor(FlynnColor.error)
                Spacer()
                if isSigningOut { ProgressView() }
            }
        }
        .disabled(isSigningOut)
    }
}
