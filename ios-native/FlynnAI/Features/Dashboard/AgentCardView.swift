import SwiftUI
import SafariServices

/// Renders a structured result from the agent — a supplier price comparison, or
/// an invoice preview. Drawn above the prose reply so the thing Flynn made is
/// something you look at and act on, rather than a sentence describing it.
struct AgentCardView: View {
    let card: AgentClient.AgentCard
    /// Sends a reply on the user's behalf — used by the card's confirm button
    /// to resolve the parked action ("yes send it") without typing.
    var onConfirm: (String) -> Void = { _ in }

    @State private var previewURL: URL?

    var body: some View {
        Group {
            switch card.type {
            case "price_comparison" where !card.options.isEmpty:
                priceComparison
            case "invoice_preview":
                invoicePreview
            default:
                EmptyView()
            }
        }
        .sheet(item: $previewURL) { url in
            SafariView(url: url).ignoresSafeArea()
        }
    }

    // MARK: – Invoice preview

    private var invoicePreview: some View {
        FlynnCard(shadow: .sm) {
            VStack(alignment: .leading, spacing: FlynnSpacing.sm) {
                HStack(alignment: .firstTextBaseline) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(card.title ?? "Invoice")
                            .flynnType(FlynnTypography.h4)
                            .foregroundColor(FlynnColor.textPrimary)
                        if let subtitle = card.subtitle {
                            Text(subtitle)
                                .flynnType(FlynnTypography.caption)
                                .foregroundColor(FlynnColor.textTertiary)
                        }
                    }
                    Spacer()
                    if let amount = card.amount {
                        Text(amount)
                            .flynnType(FlynnTypography.h3)
                            .foregroundColor(FlynnColor.textPrimary)
                    }
                }

                // The og.png renders as the invoice itself, so this is a true
                // preview of what the client receives, not a generic thumbnail.
                if let raw = card.imageURL, let imageURL = URL(string: raw) {
                    AsyncImage(url: imageURL) { phase in
                        switch phase {
                        case .success(let image):
                            image.resizable().scaledToFit()
                        case .failure:
                            EmptyView()
                        default:
                            RoundedRectangle(cornerRadius: FlynnRadii.md)
                                .fill(FlynnColor.gray100)
                                .frame(height: 140)
                                .overlay(ProgressView().controlSize(.small))
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .clipShape(RoundedRectangle(cornerRadius: FlynnRadii.md, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: FlynnRadii.md, style: .continuous)
                            .stroke(FlynnColor.border, lineWidth: 1)
                    )
                    .onTapGesture { openPreview() }
                }

                HStack(spacing: FlynnSpacing.sm) {
                    FlynnButton(
                        title: "View invoice",
                        action: { openPreview() },
                        variant: .secondary,
                        size: .small
                    )
                    if let label = card.confirmLabel, let reply = card.confirmMessage {
                        FlynnButton(
                            title: label,
                            action: { onConfirm(reply) },
                            size: .small
                        )
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func openPreview() {
        guard let raw = card.url, let url = URL(string: raw) else { return }
        previewURL = url
    }

    // MARK: – Price comparison

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

/// In-app browser for the hosted invoice — keeps the preview inside Flynn
/// instead of bouncing out to Safari and losing the demo's thread.
struct SafariView: UIViewControllerRepresentable {
    let url: URL

    func makeUIViewController(context: Context) -> SFSafariViewController {
        let config = SFSafariViewController.Configuration()
        config.entersReaderIfAvailable = false
        return SFSafariViewController(url: url, configuration: config)
    }

    func updateUIViewController(_ controller: SFSafariViewController, context: Context) {}
}

// `sheet(item:)` needs Identifiable; URL is a natural identity here.
extension URL: @retroactive Identifiable {
    public var id: String { absoluteString }
}
