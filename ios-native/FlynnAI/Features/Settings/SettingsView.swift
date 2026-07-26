import SwiftUI

/// Settings (presented from the drawer). The granular toggles; Business Brain and
/// Voice are their own tabs now, and Account is its own drawer entry.
struct SettingsView: View {
    @Environment(\.dismiss) private var dismiss

    /// Manual entry into the voice front-door claim. The first-run gate only
    /// fires when the staged session matches the signup number, so someone who
    /// rang Flynn from a different phone (or dismissed the gate) needs a way
    /// back in with the code from their text.
    @State private var showClaimFlow = false

    var body: some View {
        List {
            Section("Setup") {
                Button {
                    showClaimFlow = true
                } label: {
                    Label("Set up my receptionist", systemImage: "phone.badge.waveform")
                }
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
                NavigationLink {
                    SavedMessagesView()
                } label: {
                    Label("Quick messages", systemImage: "text.bubble")
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
        .fullScreenCover(isPresented: $showClaimFlow) {
            ReceptionistClaimFlow(staged: nil) { showClaimFlow = false }
        }
    }
}
