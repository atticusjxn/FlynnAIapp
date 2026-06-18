import SwiftUI

/// Settings (presented from the drawer). The granular toggles; Business Brain and
/// Voice are their own tabs now, and Account is its own drawer entry.
struct SettingsView: View {
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        List {
            Section("Setup") {
                NavigationLink {
                    IntegrationsView()
                } label: {
                    Label("Connected apps", systemImage: "square.stack.3d.up")
                }
                NavigationLink {
                    KeyboardSetupFlow()
                } label: {
                    Label("Flynn Keyboard", systemImage: "keyboard")
                }
            }
            Section("Preferences") {
                NavigationLink {
                    NotificationsSettingsView()
                } label: {
                    Label("Notifications", systemImage: "bell")
                }
                NavigationLink {
                    AppearanceView()
                } label: {
                    Label("Appearance", systemImage: "paintbrush")
                }
            }
            Section("Billing") {
                NavigationLink {
                    SubscriptionDetailView()
                } label: {
                    Label("Subscription", systemImage: "creditcard")
                }
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle("Settings")
        .toolbar { ToolbarItem(placement: .topBarLeading) { Button("Done") { dismiss() } } }
    }
}
