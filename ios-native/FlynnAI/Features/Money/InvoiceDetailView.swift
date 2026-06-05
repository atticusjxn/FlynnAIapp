import SwiftUI

struct InvoiceDetailView: View {
    let invoiceId: UUID

    @State private var invoice: InvoiceDTO?
    @State private var errorMessage: String?
    @State private var isLoading = true
    @State private var isWorking = false
    @State private var pdfShareItems: [Any] = []
    @State private var showingShareSheet = false
    @State private var showingEditSheet = false
    @State private var showingSendPrompt = false
    @State private var sendToPhone = ""

    @Environment(FlashStore.self) private var flash
    @Environment(\.dismiss) private var dismiss

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
                    actionsCard(invoice: invoice)
                    lineItemsCard(invoice: invoice)
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
                        "Couldn't load invoice", systemImage: "exclamationmark.triangle",
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
        .sheet(isPresented: $showingShareSheet) { ShareSheet(items: pdfShareItems) }
        .sheet(isPresented: $showingEditSheet) {
            if let inv = invoice {
                InvoiceFormView(editInvoice: inv) { updated in invoice = updated }
            }
        }
        .alert("Send via SMS", isPresented: $showingSendPrompt) {
            TextField("Mobile number", text: $sendToPhone).keyboardType(.phonePad)
            Button("Send") { Task { await sendSMS() } }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("We'll text the client a link to pay this invoice.")
        }
        .overlay { if isWorking { workingOverlay } }
    }

    private func headerCard(invoice: InvoiceDTO) -> some View {
        FlynnCard {
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

    private func actionsCard(invoice: InvoiceDTO) -> some View {
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
            if invoice.status == "draft" {
                HStack(spacing: FlynnSpacing.sm) {
                    FlynnButton(
                        title: "Edit",
                        action: { showingEditSheet = true },
                        variant: .secondary,
                        fullWidth: true
                    )
                    FlynnButton(
                        title: "Delete",
                        action: { Task { await deleteInvoice() } },
                        variant: .danger,
                        fullWidth: true
                    )
                }
            }
        }
    }

    private func lineItemsCard(invoice: InvoiceDTO) -> some View {
        FlynnCard(shadow: .sm) {
            VStack(alignment: .leading, spacing: FlynnSpacing.sm) {
                Text("Line items")
                    .flynnType(FlynnTypography.overline)
                    .foregroundColor(FlynnColor.textTertiary)
                if invoice.lineItems.isEmpty {
                    Text("No items")
                        .flynnType(FlynnTypography.bodyMedium)
                        .foregroundColor(FlynnColor.textTertiary)
                } else {
                    ForEach(invoice.lineItems) { item in
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
                        if item.id != invoice.lineItems.last?.id { Divider() }
                    }
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
                if invoice.taxRate > 0 {
                    row(label: "Tax (\(Int(invoice.taxRate))%)", value: FlynnFormatter.currency(invoice.taxAmount))
                }
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
            invoice = try await repository.fetch(id: invoiceId)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func sharePDF() async {
        isWorking = true
        defer { isWorking = false }
        do {
            let data = try await repository.generatePDF(invoiceId: invoiceId)
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
            _ = try await repository.sendViaSMS(invoiceId: invoiceId, toPhone: sendToPhone)
            flash.success("Invoice sent")
            await load()
        } catch {
            flash.error(error.localizedDescription)
        }
    }

    private func deleteInvoice() async {
        isWorking = true
        defer { isWorking = false }
        do {
            try await repository.delete(id: invoiceId)
            flash.success("Invoice deleted")
            dismiss()
        } catch {
            flash.error(error.localizedDescription)
        }
    }
}
