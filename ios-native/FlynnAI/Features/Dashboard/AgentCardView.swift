import SwiftUI

/// Renders a structured result from the agent — today a supplier price
/// comparison. Drawn above the prose reply so the numbers are scannable
/// instead of buried in a chat bubble.
struct AgentCardView: View {
    let card: AgentClient.AgentCard

    var body: some View {
        if card.type == "price_comparison", !card.options.isEmpty {
            priceComparison
        }
    }

    private var priceComparison: some View {
        FlynnCard(shadow: .sm) {
            VStack(alignment: .leading, spacing: FlynnSpacing.sm) {
                VStack(alignment: .leading, spacing: 2) {
                    if let title = card.title {
                        Text(title)
                            .flynnType(FlynnTypography.h4)
                            .foregroundColor(FlynnColor.textPrimary)
                            .lineLimit(2)
                    }
                    if let subtitle = card.subtitle {
                        Text(subtitle)
                            .flynnType(FlynnTypography.caption)
                            .foregroundColor(FlynnColor.textTertiary)
                    }
                }

                VStack(spacing: FlynnSpacing.xs) {
                    ForEach(card.options) { option in
                        row(for: option)
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func row(for option: AgentClient.AgentCard.Option) -> some View {
        let isBest = option.best == true
        return HStack(alignment: .firstTextBaseline, spacing: FlynnSpacing.sm) {
            VStack(alignment: .leading, spacing: 1) {
                Text(option.seller)
                    .flynnType(FlynnTypography.bodyMedium)
                    .foregroundColor(FlynnColor.textPrimary)
                    .lineLimit(1)
                if let note = option.note {
                    Text(note)
                        .flynnType(FlynnTypography.caption)
                        .foregroundColor(isBest ? FlynnColor.success : FlynnColor.textTertiary)
                        .lineLimit(1)
                }
            }

            Spacer(minLength: FlynnSpacing.xs)

            if let price = option.price {
                Text(price)
                    .flynnType(isBest ? FlynnTypography.h4 : FlynnTypography.bodyMedium)
                    .foregroundColor(FlynnColor.textPrimary)
            }

            if isBest {
                FlynnBadge(label: "Best", variant: .success)
            }
        }
        .padding(.horizontal, FlynnSpacing.sm)
        .padding(.vertical, FlynnSpacing.xs)
        .background(
            RoundedRectangle(cornerRadius: FlynnRadii.md, style: .continuous)
                .fill(isBest ? FlynnColor.successLight : FlynnColor.background)
        )
        .overlay(
            RoundedRectangle(cornerRadius: FlynnRadii.md, style: .continuous)
                .stroke(isBest ? FlynnColor.success : FlynnColor.border, lineWidth: isBest ? 2 : 1)
        )
    }
}
