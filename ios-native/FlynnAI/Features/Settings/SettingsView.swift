import SwiftUI

/// Settings (presented from the drawer). Rebuilt off the stock inset-grouped
/// `List` — which rendered as system iOS with a cream tint, the most obviously
/// "default" surface left — onto Flynn's own grouped quiet cards: overline
/// section headers, orange row glyphs, one card per group.
struct SettingsView: View {
    @Environment(\.dismiss) private var dismiss

    /// Manual entry into the voice front-door claim. The first-run gate only
    /// fires when the staged session matches the signup number, so someone who
    /// rang Flynn from a different phone (or dismissed the gate) needs a way
    /// back in with the code from their text.
    @State private var showClaimFlow = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: FlynnSpacing.lg) {
                group("Setup") {
                    actionRow("phone.badge.waveform", "Set up my receptionist") { showClaimFlow = true }
                    rowDivider
                    linkRow("phone.arrow.right", "Divert your calls") { CallForwardingView() }
                    rowDivider
                    linkRow("banknote", "Getting paid") { PaymentDetailsView() }
                    rowDivider
                    linkRow("square.stack.3d.up.fill", "Connected apps") { IntegrationsView() }
                }

                group("Preferences") {
                    linkRow("bell.fill", "Notifications") { NotificationsSettingsView() }
                    rowDivider
                    linkRow("paintbrush.fill", "Appearance") { AppearanceView() }
                }

                group("Billing") {
                    linkRow("creditcard.fill", "Subscription") { SubscriptionDetailView() }
                }
            }
            .padding(.horizontal, FlynnSpacing.lg)
            .padding(.vertical, FlynnSpacing.md)
        }
        .background(FlynnColor.background)
        .navigationTitle("Settings")
        .toolbar { ToolbarItem(placement: .topBarLeading) { Button("Done") { dismiss() } } }
        .fullScreenCover(isPresented: $showClaimFlow) {
            ReceptionistClaimFlow(staged: nil) { showClaimFlow = false }
        }
    }

    // MARK: - Building blocks

    private func group<Content: View>(_ title: String, @ViewBuilder _ content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: FlynnSpacing.xs) {
            Text(title)
                .flynnType(FlynnTypography.overline)
                .foregroundColor(FlynnColor.textTertiary)
                .padding(.leading, FlynnSpacing.xs)
            VStack(spacing: 0) { content() }
                .flynnCardSurface(.quiet)
        }
    }

    private var rowDivider: some View {
        Divider().overlay(FlynnColor.borderSubtle).padding(.leading, 52)
    }

    private func rowLabel(_ icon: String, _ title: String) -> some View {
        HStack(spacing: FlynnSpacing.md) {
            Image(systemName: icon)
                .font(.system(size: 16, weight: .semibold))
                .foregroundColor(FlynnColor.primary)
                .frame(width: 24)
            Text(title)
                .flynnType(FlynnTypography.bodyLarge)
                .foregroundColor(FlynnColor.textPrimary)
            Spacer(minLength: 0)
            Image(systemName: "chevron.right")
                .font(.system(size: 13, weight: .semibold))
                .foregroundColor(FlynnColor.textTertiary)
        }
        .padding(.horizontal, FlynnSpacing.md)
        .frame(minHeight: 54)
        .contentShape(Rectangle())
    }

    private func actionRow(_ icon: String, _ title: String, action: @escaping () -> Void) -> some View {
        Button(action: action) { rowLabel(icon, title) }
            .buttonStyle(FlynnPressable())
    }

    private func linkRow<Destination: View>(_ icon: String, _ title: String, @ViewBuilder destination: @escaping () -> Destination) -> some View {
        NavigationLink { destination() } label: { rowLabel(icon, title) }
            .buttonStyle(FlynnPressable())
    }
}
