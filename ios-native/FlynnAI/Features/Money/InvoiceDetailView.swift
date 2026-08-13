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
    @State private var showingPaidPrompt = false
    @State private var paidAmountText = ""

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
                        paymentLinkCard(invoice: invoice, url: url)
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
        .safeAreaInset(edge: .bottom) {
            if let inv = invoice {
                ContextualVoiceBar(
                    context: "invoice \(inv.invoiceNumber) for \(inv.title ?? "a job"), "
                        + "\(FlynnFormatter.currency(inv.amountDue)) still due, status \(inv.status)",
                    prompt: "Hold to change this invoice",
                    onCompleted: { Task { await load() } }
                )
            }
        }
        .navigationTitle("Invoice")
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
        .sheet(isPresented: $showingShareSheet) { ShareSheet(items: pdfShareItems) }
        .sheet(isPresented: $showingEditSheet) {
            if let inv = invoice {
                InvoiceFormView(editInvoice: inv) { updated in invoice = updated }
                    .flynnFlashOverlay()
            }
        }
        .alert("Send via SMS", isPresented: $showingSendPrompt) {
            TextField("Mobile number", text: $sendToPhone).keyboardType(.phonePad)
            Button("Send") { Task { await sendSMS() } }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("We'll text the client a link to pay this invoice.")
        }
        // Recording a payment stops the chaser and tells the client's next
        // reminder not to go out, so it confirms rather than firing on a tap.
        .alert("Record a payment", isPresented: $showingPaidPrompt) {
            TextField("Amount", text: $paidAmountText).keyboardType(.decimalPad)
            Button("Record") { Task { await markPaid() } }
            Button("Cancel", role: .cancel) {}
        } message: {
            if let inv = invoice {
                Text("\(FlynnFormatter.currency(inv.amountDue)) is still owing. "
                     + "Record less than that and Flynn keeps chasing the balance.")
            }
        }
        .overlay { if isWorking { workingOverlay } }
    }

    private func headerCard(invoice: InvoiceDTO) -> some View {
        FlynnCard {
            // One child only: FlynnCard's surface modifier distributes across
            // multiple ViewBuilder children and would draw a separate card
            // around each row.
            VStack(alignment: .leading, spacing: 0) {
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
            // This screen exists to answer "how much is this person still up
            // for", which it previously never said anywhere.
            Divider().padding(.vertical, FlynnSpacing.sm)
            HStack(alignment: .firstTextBaseline) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(invoice.amountDue > 0 ? "Still owing" : "Paid in full")
                        .flynnType(FlynnTypography.overline)
                        .foregroundColor(FlynnColor.textTertiary)
                    Text(FlynnFormatter.currency(invoice.amountDue))
                        .flynnType(FlynnTypography.h2)
                        .foregroundColor(invoice.amountDue > 0 ? FlynnColor.textPrimary : FlynnColor.success)
                }
                Spacer()
                if invoice.amountPaid > 0 {
                    VStack(alignment: .trailing, spacing: 2) {
                        Text("Paid")
                            .flynnType(FlynnTypography.overline)
                            .foregroundColor(FlynnColor.textTertiary)
                        Text(FlynnFormatter.currency(invoice.amountPaid))
                            .flynnType(FlynnTypography.bodyLarge)
                            .foregroundColor(FlynnColor.textSecondary)
                    }
                }
            }
            .accessibilityElement(children: .combine)
            }
        }
    }

    private func actionsCard(invoice: InvoiceDTO) -> some View {
        VStack(spacing: FlynnSpacing.sm) {
            // Getting the invoice out is the money moment, so it gets the
            // glass treatment that matches the client-facing payment page.
            FlynnGlassButton(
                title: "Send via SMS",
                action: { sendToPhone = ""; showingSendPrompt = true },
                icon: Image(systemName: "paperplane.fill")
            )
            HStack(spacing: FlynnSpacing.sm) {
                FlynnButton(
                    title: "Share PDF",
                    action: { Task { await sharePDF() } },
                    variant: .secondary,
                    fullWidth: true
                )
                // Until money clears through Flynn's own rail there's nothing to
                // detect a payment automatically, so the boss tells us. Without
                // this the "owed" figure on Home only ever climbs.
                if invoice.amountDue > 0 && invoice.status != "draft" {
                    FlynnButton(
                        title: "Mark paid",
                        action: {
                            paidAmountText = String(format: "%.2f", invoice.amountDue)
                            showingPaidPrompt = true
                        },
                        variant: .success,
                        fullWidth: true
                    )
                }
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
        FlynnCard(style: .quiet) {
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
        FlynnCard(style: .quiet) {
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
        FlynnCard(style: .quiet) {
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

    private func paymentLinkCard(invoice: InvoiceDTO, url: URL) -> some View {
        FlynnCard(style: .quiet) {
            VStack(alignment: .leading, spacing: FlynnSpacing.sm) {
                HStack {
                    Text("Payment")
                        .flynnType(FlynnTypography.overline)
                        .foregroundColor(FlynnColor.textTertiary)
                    Spacer()
                    if invoice.paidAt != nil {
                        FlynnBadge(label: "Paid", variant: .success)
                    }
                }

                HStack(spacing: FlynnSpacing.xs) {
                    Image(systemName: paymentMethodIcon(invoice.paymentMethod))
                        .foregroundColor(FlynnColor.primary)
                    Text(paymentMethodLabel(invoice.paymentMethod))
                        .flynnType(FlynnTypography.bodyMedium)
                        .foregroundColor(FlynnColor.textPrimary)
                }

                if let ref = invoice.payidReference, !ref.isEmpty {
                    Text("PayID reference \(ref)")
                        .flynnType(FlynnTypography.caption)
                        .foregroundColor(FlynnColor.textTertiary)
                }

                Link(destination: url) {
                    Label("Open payment link", systemImage: "link")
                        .flynnType(FlynnTypography.bodyLarge)
                        .foregroundColor(FlynnColor.primary)
                }

                // Flynn's own capped fee on this payment (see the PayID-rail
                // pricing model in memory flynn_payments_verified_facts) — only
                // ever shown once a payment has actually cleared on-rail.
                if let feeCents = invoice.applicationFeeCents, feeCents > 0, invoice.paidAt != nil {
                    Divider()
                    HStack {
                        Text("Flynn fee")
                            .flynnType(FlynnTypography.caption)
                            .foregroundColor(FlynnColor.textTertiary)
                        Spacer()
                        Text(FlynnFormatter.currency(Double(feeCents) / 100))
                            .flynnType(FlynnTypography.caption)
                            .foregroundColor(FlynnColor.textTertiary)
                    }
                }
            }
        }
    }

    private func paymentMethodLabel(_ method: String?) -> String {
        switch method {
        case "payid": return "Pay by bank (PayID)"
        case "card": return "Card"
        case "apple_pay": return "Apple Pay"
        case "bank_transfer": return "Bank transfer"
        default: return "Payment link"
        }
    }

    private func paymentMethodIcon(_ method: String?) -> String {
        switch method {
        case "payid", "bank_transfer": return "building.columns"
        case "card": return "creditcard"
        case "apple_pay": return "apple.logo"
        default: return "link"
        }
    }

    private func notesCard(notes: String) -> some View {
        FlynnCard(style: .quiet) {
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
                .flynnCardSurface(.flat)
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

    private func markPaid() async {
        // Accept "1,452.00", "$1452" and "1452" — this gets typed one-handed in
        // a ute, not into a finance package.
        let cleaned = paidAmountText
            .replacingOccurrences(of: "$", with: "")
            .replacingOccurrences(of: ",", with: "")
            .trimmingCharacters(in: .whitespaces)
        guard let amount = Double(cleaned), amount > 0 else {
            flash.error("Enter an amount")
            return
        }
        isWorking = true
        defer { isWorking = false }
        do {
            let updated = try await repository.markPaid(id: invoiceId, amount: amount, method: nil)
            invoice = updated
            flash.success(updated.amountDue > 0
                          ? "Payment recorded, \(FlynnFormatter.currency(updated.amountDue)) still owing"
                          : "Paid in full")
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
