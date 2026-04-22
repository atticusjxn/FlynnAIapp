import SwiftUI

struct QuoteDetailView: View {
    let quoteId: UUID

    @State private var quote: QuoteDTO?
    @State private var errorMessage: String?
    @State private var isLoading = true

    private let repository: QuotesRepositoryType = QuotesRepository()

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: FlynnSpacing.lg) {
                if isLoading {
                    ProgressView()
                        .frame(maxWidth: .infinity)
                        .padding(.top, FlynnSpacing.xl)
                } else if let quote {
                    headerCard(quote: quote)
                    totalsCard(quote: quote)
                    timelineCard(quote: quote)
                    if let urlString = quote.stripePaymentLinkUrl, let url = URL(string: urlString) {
                        paymentLinkCard(url: url)
                    }
                    if let notes = quote.notes, !notes.isEmpty {
                        notesCard(notes: notes)
                    }
                } else if let errorMessage {
                    ContentUnavailableView(
                        "Couldn't load quote",
                        systemImage: "exclamationmark.triangle",
                        description: Text(errorMessage)
                    )
                }
            }
            .padding(FlynnSpacing.lg)
        }
        .background(FlynnColor.background)
        .navigationTitle("Quote")
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
    }

    private func headerCard(quote: QuoteDTO) -> some View {
        FlynnCard {
            VStack(alignment: .leading, spacing: FlynnSpacing.sm) {
                HStack(alignment: .firstTextBaseline) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(quote.title ?? quote.quoteNumber)
                            .flynnType(FlynnTypography.h2)
                        Text(quote.quoteNumber)
                            .flynnType(FlynnTypography.bodySmall)
                            .foregroundColor(FlynnColor.textSecondary)
                    }
                    Spacer()
                    FlynnBadge(
                        label: QuoteStatusBadgeMapper.label(for: quote.status),
                        variant: QuoteStatusBadgeMapper.variant(for: quote.status)
                    )
                }
            }
        }
    }

    private func totalsCard(quote: QuoteDTO) -> some View {
        FlynnCard(shadow: .sm) {
            VStack(alignment: .leading, spacing: FlynnSpacing.sm) {
                Text("Totals")
                    .flynnType(FlynnTypography.overline)
                    .foregroundColor(FlynnColor.textTertiary)
                row(label: "Subtotal", value: FlynnFormatter.currency(quote.subtotal))
                row(label: "Tax (\(Int(quote.taxRate))%)", value: FlynnFormatter.currency(quote.taxAmount))
                Divider()
                row(label: "Total", value: FlynnFormatter.currency(quote.total), emphasized: true)
            }
        }
    }

    private func timelineCard(quote: QuoteDTO) -> some View {
        FlynnCard(shadow: .sm) {
            VStack(alignment: .leading, spacing: FlynnSpacing.sm) {
                Text("Timeline")
                    .flynnType(FlynnTypography.overline)
                    .foregroundColor(FlynnColor.textTertiary)
                timelineRow(label: "Created", date: quote.createdAt)
                timelineRow(label: "Sent", date: quote.sentAt)
                timelineRow(label: "Viewed", date: quote.viewedAt)
                timelineRow(label: "Accepted", date: quote.acceptedAt)
                timelineRow(label: "Declined", date: quote.declinedAt)
                timelineRow(label: "Valid until", date: quote.validUntil)
            }
        }
    }

    private func paymentLinkCard(url: URL) -> some View {
        FlynnCard(shadow: .sm) {
            VStack(alignment: .leading, spacing: FlynnSpacing.sm) {
                Text("Payment")
                    .flynnType(FlynnTypography.overline)
                    .foregroundColor(FlynnColor.textTertiary)
                Link(destination: url) {
                    Label("Open Stripe payment link", systemImage: "link")
                        .flynnType(FlynnTypography.bodyLarge)
                        .foregroundColor(FlynnColor.primary)
                }
            }
        }
    }

    private func notesCard(notes: String) -> some View {
        FlynnCard(shadow: .sm) {
            VStack(alignment: .leading, spacing: FlynnSpacing.xs) {
                Text("Notes")
                    .flynnType(FlynnTypography.overline)
                    .foregroundColor(FlynnColor.textTertiary)
                Text(notes)
                    .flynnType(FlynnTypography.bodyMedium)
            }
        }
    }

    private func row(label: String, value: String, emphasized: Bool = false) -> some View {
        HStack {
            Text(label)
                .flynnType(emphasized ? FlynnTypography.h4 : FlynnTypography.bodyMedium)
                .foregroundColor(FlynnColor.textSecondary)
            Spacer()
            Text(value)
                .flynnType(emphasized ? FlynnTypography.h4 : FlynnTypography.bodyMedium)
                .foregroundColor(FlynnColor.textPrimary)
        }
    }

    private func timelineRow(label: String, date: Date?) -> some View {
        Group {
            if let date {
                HStack {
                    Text(label)
                        .flynnType(FlynnTypography.bodyMedium)
                        .foregroundColor(FlynnColor.textSecondary)
                    Spacer()
                    Text(date.formatted(date: .abbreviated, time: .omitted))
                        .flynnType(FlynnTypography.bodyMedium)
                        .foregroundColor(FlynnColor.textPrimary)
                }
            } else {
                EmptyView()
            }
        }
    }

    private func load() async {
        isLoading = true
        defer { isLoading = false }
        do {
            quote = try await repository.fetch(id: quoteId)
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
