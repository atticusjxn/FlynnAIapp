import SwiftUI

struct UsageBarCard: View {
    @Environment(PaywallPresentation.self) private var paywall
    @State private var store = UsageStore()

    var body: some View {
        Group {
            switch store.loadState {
            case .idle, .loading:
                placeholder
            case .error:
                // Fail silently — usage bar is non-critical; Dashboard still loads.
                EmptyView()
            case .loaded:
                if let usage = store.usage, usage.hasSubscription {
                    usageCard(usage)
                } else {
                    trialCtaCard
                }
            }
        }
        .task { await store.load() }
        .onReceive(NotificationCenter.default.publisher(for: UIApplication.willEnterForegroundNotification)) { _ in
            Task { await store.load() }
        }
    }

    // MARK: Variants

    private var placeholder: some View {
        RoundedRectangle(cornerRadius: FlynnRadii.md, style: .continuous)
            .fill(FlynnColor.backgroundSecondary)
            .frame(height: 96)
            .brutalistBorder(cornerRadius: FlynnRadii.md)
            .overlay(ProgressView().tint(FlynnColor.primary))
    }

    private var trialCtaCard: some View {
        Button(action: { paywall.present(reason: .manual) }) {
            VStack(alignment: .leading, spacing: FlynnSpacing.xs) {
                HStack(spacing: FlynnSpacing.xs) {
                    Image(systemName: "sparkles")
                        .foregroundColor(FlynnColor.primary)
                    Text("Start 14-day free trial")
                        .flynnType(FlynnTypography.h4)
                        .foregroundColor(FlynnColor.textPrimary)
                }
                Text("Unlock AI receptionist minutes. Cancel anytime.")
                    .flynnType(FlynnTypography.bodyMedium)
                    .foregroundColor(FlynnColor.textSecondary)
            }
            .padding(FlynnSpacing.md)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: FlynnRadii.md, style: .continuous)
                    .fill(FlynnColor.primaryLight)
            )
            .brutalistBorder(cornerRadius: FlynnRadii.md, color: FlynnColor.primary, lineWidth: 3)
        }
        .buttonStyle(.plain)
    }

    @ViewBuilder
    private func usageCard(_ usage: UsageDTO) -> some View {
        let fraction = usage.usageFraction
        let fillColor = colorForUsage(fraction)
        let planLabel = usage.planName ?? "Flynn"
        let usedMin = Int(usage.aiMinutesUsed.rounded())

        Button(action: { paywall.present(reason: fraction >= 0.8 ? .usageLimit : .manual) }) {
            VStack(alignment: .leading, spacing: FlynnSpacing.sm) {
                HStack {
                    HStack(spacing: FlynnSpacing.xs) {
                        Image(systemName: "bolt.fill")
                            .foregroundColor(fillColor)
                        Text("\(planLabel) plan")
                            .flynnType(FlynnTypography.h4)
                            .foregroundColor(FlynnColor.textPrimary)
                    }
                    Spacer()
                    Text("\(usedMin) / \(usage.aiMinutesMonthly) min")
                        .flynnType(FlynnTypography.label)
                        .foregroundColor(FlynnColor.textSecondary)
                        .monospacedDigit()
                }

                progressBar(fraction: fraction, color: fillColor)

                HStack {
                    Text(subtitleFor(fraction: fraction, usage: usage))
                        .flynnType(FlynnTypography.caption)
                        .foregroundColor(FlynnColor.textTertiary)
                    Spacer()
                    HStack(spacing: 2) {
                        Text("Upgrade")
                        Image(systemName: "arrow.right")
                    }
                    .flynnType(FlynnTypography.caption)
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
        .buttonStyle(.plain)
    }

    private func progressBar(fraction: Double, color: Color) -> some View {
        GeometryReader { proxy in
            ZStack(alignment: .leading) {
                RoundedRectangle(cornerRadius: 4)
                    .fill(FlynnColor.gray200)
                RoundedRectangle(cornerRadius: 4)
                    .fill(color)
                    .frame(width: proxy.size.width * fraction)
            }
        }
        .frame(height: 8)
    }

    private func colorForUsage(_ fraction: Double) -> Color {
        switch fraction {
        case 0..<0.6: return FlynnColor.primary
        case 0.6..<0.85: return FlynnColor.warning
        default: return FlynnColor.error
        }
    }

    private func subtitleFor(fraction: Double, usage: UsageDTO) -> String {
        if usage.subscriptionStatus == "trialing", let trialEnd = usage.trialEndAt {
            let days = max(Calendar.current.dateComponents([.day], from: Date(), to: trialEnd).day ?? 0, 0)
            return days > 0
                ? "Trial · \(days) day\(days == 1 ? "" : "s") left"
                : "Trial ends today"
        }
        if fraction >= 1.0 {
            return "AI at limit — calls now use SMS Links"
        } else if fraction >= 0.8 {
            return "Running low — upgrade to avoid SMS fallback"
        } else if let resets = usage.currentPeriodEnd {
            return "Resets \(Self.dateFormatter.string(from: resets))"
        } else {
            return ""
        }
    }

    private static let dateFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "d MMM"
        return f
    }()
}
