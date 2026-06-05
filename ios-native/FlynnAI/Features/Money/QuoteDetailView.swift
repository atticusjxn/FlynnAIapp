import SwiftUI

struct QuoteDetailView: View {
    let quoteId: UUID

    @State private var quote: QuoteDTO?
    @State private var errorMessage: String?
    @State private var isLoading = true
    @State private var isWorking = false
    @State private var pdfShareItems: [Any] = []
    @State private var showingShareSheet = false
    @State private var showingEditSheet = false
    @State private var showingConvertSheet = false
    @State private var showingSendPrompt = false
    @State private var sendToPhone = ""

    @Environment(FlashStore.self) private var flash
    @Environment(\.dismiss) private var dismiss

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
                    actionsCard(quote: quote)
                    lineItemsCard(quote: quote)
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
                        "Couldn't load quote", systemImage: "exclamationmark.triangle",
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
        .sheet(isPresented: $showingShareSheet) { ShareSheet(items: pdfShareItems) }
        .sheet(isPresented: $showingEditSheet) {
            if let q = quote {
                QuoteFormView(editQuote: q) { updated in
                    quote = updated
                }
            }
        }
        .sheet(isPresented: $showingConvertSheet) {
            if let q = quote {
                InvoiceFormView(fromQuote: q) { _ in
                    flash.success("Invoice created from quote")
                }
            }
        }
        .alert("Send via SMS", isPresented: $showingSendPrompt) {
            TextField("Mobile number", text: $sendToPhone)
                .keyboardType(.phonePad)
            Button("Send") { Task { await sendSMS() } }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("We'll text the client a link to view this quote as a PDF.")
        }
        .overlay { if isWorking { workingOverlay } }
    }

    // MARK: – Cards

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

    private func actionsCard(quote: QuoteDTO) -> some View {
        VStack(spacing: FlynnSpacing.sm) {
            HStack(spacing: FlynnSpacing.sm) {
                FlynnButton(
                    title: "Send via SMS",
                    action: { sendToPhone = ""; showingSendPrompt = true },
                    fullWidth: true
                )
                FlynnButton(
                    title: "Share PDF",
                    action: { Task { await sharePDF() } },
                    variant: .secondary,
                    fullWidth: true
                )
            }
            HStack(spacing: FlynnSpacing.sm) {
                if quote.status == "draft" {
                    FlynnButton(
                        title: "Edit",
                        action: { showingEditSheet = true },
                        variant: .secondary,
                        fullWidth: true
                    )
                    FlynnButton(
                        title: "Delete",
                        action: { Task { await deleteQuote() } },
                        variant: .danger,
                        fullWidth: true
                    )
                } else if quote.status == "accepted" {
                    FlynnButton(
                        title: "Convert to Invoice",
                        action: { showingConvertSheet = true },
                        variant: .success,
                        fullWidth: true
                    )
                }
            }
        }
    }

    private func lineItemsCard(quote: QuoteDTO) -> some View {
        FlynnCard(shadow: .sm) {
            VStack(alignment: .leading, spacing: FlynnSpacing.sm) {
                Text("Line items")
                    .flynnType(FlynnTypography.overline)
                    .foregroundColor(FlynnColor.textTertiary)
                if quote.lineItems.isEmpty {
                    Text("No items")
                        .flynnType(FlynnTypography.bodyMedium)
                        .foregroundColor(FlynnColor.textTertiary)
                } else {
                    ForEach(quote.lineItems) { item in
                        VStack(alignment: .leading, spacing: 2) {
                            HStack {
                                Text(item.description)
                                    .flynnType(FlynnTypography.bodyMedium)
                                    .foregroundColor(FlynnColor.textPrimary)
                                Spacer()
                                Text(FlynnFormatter.currency(item.total))
                                    .flynnType(FlynnTypography.label)
                                    .foregroundColor(FlynnColor.textPrimary)
                            }
                            Text("\(item.quantity.formatted()) × \(FlynnFormatter.currency(item.unitPrice))")
                                .flynnType(FlynnTypography.caption)
                                .foregroundColor(FlynnColor.textTertiary)
                        }
                        .padding(.vertical, 4)
                        if item.id != quote.lineItems.last?.id { Divider() }
                    }
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
                if quote.taxRate > 0 {
                    row(label: "Tax (\(Int(quote.taxRate))%)", value: FlynnFormatter.currency(quote.taxAmount))
                }
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

    // MARK: – Helpers

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

    private var workingOverlay: some View {
        ZStack {
            Color.black.opacity(0.15).ignoresSafeArea()
            ProgressView().tint(FlynnColor.primary)
                .padding(FlynnSpacing.lg)
                .background(RoundedRectangle(cornerRadius: FlynnRadii.md).fill(FlynnColor.backgroundSecondary))
        }
    }

    // MARK: – Actions

    private func load() async {
        isLoading = true
        defer { isLoading = false }
        do {
            quote = try await repository.fetch(id: quoteId)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func sharePDF() async {
        isWorking = true
        defer { isWorking = false }
        do {
            let data = try await repository.generatePDF(quoteId: quoteId)
            pdfShareItems = [data]
            showingShareSheet = true
        } catch {
            flash.error(error.localizedDescription)
        }
    }

    private func sendSMS() async {
        guard !sendToPhone.trimmingCharacters(in: .whitespaces).isEmpty else {
            flash.error("Enter a mobile number")
            return
        }
        isWorking = true
        defer { isWorking = false }
        do {
            _ = try await repository.sendViaSMS(quoteId: quoteId, toPhone: sendToPhone)
            flash.success("Quote sent")
            await load()
        } catch {
            flash.error(error.localizedDescription)
        }
    }

    private func deleteQuote() async {
        isWorking = true
        defer { isWorking = false }
        do {
            try await repository.delete(id: quoteId)
            flash.success("Quote deleted")
            dismiss()
        } catch {
            flash.error(error.localizedDescription)
        }
    }
}
