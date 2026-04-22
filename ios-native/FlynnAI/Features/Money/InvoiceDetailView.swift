import SwiftUI

struct InvoiceDetailView: View {
    let invoiceId: UUID

    @State private var invoice: InvoiceDTO?
    @State private var errorMessage: String?
    @State private var isLoading = true

    private let repository: InvoicesRepositoryType = InvoicesRepository()

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: FlynnSpacing.lg) {
                if isLoading {
                    ProgressView()
                        .frame(maxWidth: .infinity)
                        .padding(.top, FlynnSpacing.xl)
                } else if let invoice {
                    headerCard(invoice: invoice)
                    totalsCard(invoice: invoice)
                    timelineCard(invoice: invoice)
                    if let urlString = invoice.stripePaymentLinkUrl, let url = URL(string: urlString) {
                        paymentLinkCard(url: url)
                    }
                    if let notes = invoice.notes, !notes.isEmpty {
                        notesCard(notes: notes)
                    }
                } else if let errorMessage {
                    ContentUnavailableView(
                        "Couldn't load invoice",
                        systemImage: "exclamationmark.triangle",
                        description: Text(errorMessage)
                    )
                }
            }
            .padding(FlynnSpacing.lg)
        }
        .background(FlynnColor.background)
        .navigationTitle("Invoice")
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
    }

    private func headerCard(invoice: InvoiceDTO) -> some View {
        FlynnCard {
            VStack(alignment: .leading, spacing: FlynnSpacing.sm) {
                HStack(alignment: .firstTextBaseline) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(invoice.title ?? invoice.invoiceNumber)
                            .flynnType(FlynnTypography.h2)
                        Text(invoice.invoiceNumber)
                            .flynnType(FlynnTypography.bodySmall)
                            .foregroundColor(FlynnColor.textSecondary)
                    }
                    Spacer()
                    FlynnBadge(
                        label: InvoiceStatusBadgeMapper.label(for: invoice.status),
                        variant: InvoiceStatusBadgeMapper.variant(for: invoice.status)
                    )
                }
            }
        }
    }

    private func totalsCard(invoice: InvoiceDTO) -> some View {
        FlynnCard(shadow: .sm) {
            VStack(alignment: .leading, spacing: FlynnSpacing.sm) {
                Text("Totals")
                    .flynnType(FlynnTypography.overline)
                    .foregroundColor(FlynnColor.textTertiary)
                row(label: "Subtotal", value: FlynnFormatter.currency(invoice.subtotal))
                row(label: "Tax (\(Int(invoice.taxRate))%)", value: FlynnFormatter.currency(invoice.taxAmount))
                Divider()
                row(label: "Total", value: FlynnFormatter.currency(invoice.total), emphasized: true)
                if invoice.amountPaid > 0 {
                    row(label: "Paid", value: FlynnFormatter.currency(invoice.amountPaid))
                }
                if invoice.amountDue > 0 {
                    row(label: "Due", value: FlynnFormatter.currency(invoice.amountDue), emphasized: true, valueColor: FlynnColor.error)
                }
            }
        }
    }

    private func timelineCard(invoice: InvoiceDTO) -> some View {
        FlynnCard(shadow: .sm) {
            VStack(alignment: .leading, spacing: FlynnSpacing.sm) {
                Text("Timeline")
                    .flynnType(FlynnTypography.overline)
                    .foregroundColor(FlynnColor.textTertiary)
                timelineRow(label: "Issued", date: invoice.issuedDate)
                timelineRow(label: "Sent", date: invoice.sentAt)
                timelineRow(label: "Viewed", date: invoice.viewedAt)
                timelineRow(label: "Due", date: invoice.dueDate)
                timelineRow(label: "Paid", date: invoice.paidAt)
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

    private func row(label: String, value: String, emphasized: Bool = false, valueColor: Color? = nil) -> some View {
        HStack {
            Text(label)
                .flynnType(emphasized ? FlynnTypography.h4 : FlynnTypography.bodyMedium)
                .foregroundColor(FlynnColor.textSecondary)
            Spacer()
            Text(value)
                .flynnType(emphasized ? FlynnTypography.h4 : FlynnTypography.bodyMedium)
                .foregroundColor(valueColor ?? FlynnColor.textPrimary)
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
            invoice = try await repository.fetch(id: invoiceId)
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
