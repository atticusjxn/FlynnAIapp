import SwiftUI

struct SubscriptionDetailView: View {
    @Environment(SubscriptionStore.self) private var store
    @Environment(PaywallPresentation.self) private var paywall
    @State private var usage = UsageStore()

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: FlynnSpacing.lg) {
                header
                planBox
                actionsBox
                manageLinkBox
            }
            .padding(FlynnSpacing.lg)
        }
        .background(FlynnColor.background)
        .navigationTitle("Billing & Plans")
        .navigationBarTitleDisplayMode(.large)
        .task {
            await store.refreshEntitlement()
            await usage.load()
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: FlynnSpacing.xs) {
            Text("Flynn subscription")
                .flynnType(FlynnTypography.overline)
                .foregroundColor(FlynnColor.textTertiary)
            Text(currentPlanLabel)
                .flynnType(FlynnTypography.h2)
                .foregroundColor(FlynnColor.textPrimary)
        }
    }

    private var currentPlanLabel: String {
        if let plan = store.currentEntitlement?.plan {
            return plan.displayName
        }
        return "No active plan"
    }

    private var planBox: some View {
        VStack(alignment: .leading, spacing: FlynnSpacing.sm) {
            if let entitlement = store.currentEntitlement {
                labelled("Minutes", value: minutesLabel)
                if let expires = entitlement.expiresAt {
                    labelled("Renews", value: Self.dateFormatter.string(from: expires))
                }
                if entitlement.isInIntroOffer {
                    labelled("Trial", value: "Active — cancel before renewal to avoid charge")
                }
            } else {
                Text("Start a 14-day free trial to unlock the AI receptionist.")
                    .flynnType(FlynnTypography.bodyMedium)
                    .foregroundColor(FlynnColor.textSecondary)
            }
        }
        .padding(FlynnSpacing.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: FlynnRadii.md, style: .continuous)
                .fill(FlynnColor.backgroundSecondary)
        )
        .brutalistBorder(cornerRadius: FlynnRadii.md)
    }

    private var minutesLabel: String {
        guard let usage = usage.usage else { return "—" }
        let used = Int(usage.aiMinutesUsed.rounded())
        return "\(used) / \(usage.aiMinutesMonthly) used this period"
    }

    private var actionsBox: some View {
        VStack(spacing: FlynnSpacing.sm) {
            FlynnButton(
                title: store.currentEntitlement == nil ? "Start free trial" : "Change plan",
                action: { paywall.present(reason: .manual) },
                fullWidth: true
            )
            FlynnButton(
                title: "Restore purchases",
                action: { Task { await store.restorePurchases() } },
                variant: .secondary,
                fullWidth: true
            )
        }
    }

    private var manageLinkBox: some View {
        VStack(alignment: .leading, spacing: FlynnSpacing.xs) {
            Link(destination: URL(string: "https://apps.apple.com/account/subscriptions")!) {
                HStack {
                    Text("Manage subscription in Apple ID")
                    Spacer()
                    Image(systemName: "arrow.up.right.square")
                }
                .flynnType(FlynnTypography.bodyMedium)
                .foregroundColor(FlynnColor.primary)
            }
        }
        .padding(FlynnSpacing.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: FlynnRadii.md, style: .continuous)
                .fill(FlynnColor.backgroundSecondary)
        )
        .brutalistBorder(cornerRadius: FlynnRadii.md)
    }

    private func labelled(_ label: String, value: String) -> some View {
        HStack(alignment: .firstTextBaseline) {
            Text(label)
                .flynnType(FlynnTypography.caption)
                .foregroundColor(FlynnColor.textTertiary)
            Spacer()
            Text(value)
                .flynnType(FlynnTypography.bodyMedium)
                .foregroundColor(FlynnColor.textPrimary)
                .multilineTextAlignment(.trailing)
        }
    }

    private static let dateFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateStyle = .medium
        return f
    }()
}
