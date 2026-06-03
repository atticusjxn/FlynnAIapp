import SwiftUI

@MainActor
@Observable
final class InvoiceFormStore {
    enum Mode { case create; case fromQuote(QuoteDTO); case edit(InvoiceDTO) }
    enum State: Equatable { case idle, saving, sendingPDF, done, error(String) }

    var title: String = ""
    var selectedClient: SelectedClient?
    var lineItems: [LineItemDraft] = []
    var taxRate: Double = 10
    var includeTax: Bool = true
    var notes: String = ""
    var dueDate: Date = Calendar.current.date(byAdding: .day, value: 14, to: Date()) ?? Date()
    var state: State = .idle
    var createdInvoice: InvoiceDTO?

    var effectiveTaxRate: Double { includeTax ? taxRate : 0 }
    var subtotal: Double { lineItems.reduce(0) { $0 + $1.total } }
    var taxAmount: Double { subtotal * (effectiveTaxRate / 100) }
    var total: Double { subtotal + taxAmount }

    private let repo: InvoicesRepositoryType
    private var orgId: UUID?
    private let mode: Mode

    init(mode: Mode, repo: InvoicesRepositoryType = InvoicesRepository()) {
        self.mode = mode
        self.repo = repo
        switch mode {
        case .create: break
        case .fromQuote(let q):
            title = (q.title ?? "") + " (Invoice)"
            lineItems = q.lineItems.map { LineItemDraft.from($0) }
            taxRate = q.taxRate
            includeTax = q.taxRate > 0
            notes = q.notes ?? ""
        case .edit(let inv):
            title = inv.title ?? ""
            lineItems = inv.lineItems.map { LineItemDraft.from($0) }
            taxRate = inv.taxRate
            includeTax = inv.taxRate > 0
            notes = inv.notes ?? ""
            dueDate = inv.dueDate ?? dueDate
        }
    }

    func save() async {
        state = .saving
        do {
            let resolvedOrgId = try await { () async throws -> UUID in
                if let id = orgId { return id }
                let id = try await OrgResolver.current()
                orgId = id
                return id
            }()
            let items = lineItems.map { $0.toLineItem() }
            switch mode {
            case .create, .fromQuote:
                createdInvoice = try await repo.create(
                    orgId: resolvedOrgId, title: title.isEmpty ? "Invoice" : title,
                    clientId: selectedClient?.id, clientName: selectedClient?.name,
                    clientPhone: selectedClient?.phone.isEmpty == false ? selectedClient?.phone : nil,
                    lineItems: items, taxRate: effectiveTaxRate,
                    notes: notes.isEmpty ? nil : notes, dueDate: dueDate
                )
            case .edit(let inv):
                createdInvoice = try await repo.update(
                    id: inv.id, title: title.isEmpty ? "Invoice" : title,
                    clientPhone: selectedClient?.phone,
                    lineItems: items, taxRate: effectiveTaxRate,
                    notes: notes.isEmpty ? nil : notes, dueDate: dueDate
                )
            }
            state = .done
        } catch {
            state = .error(error.localizedDescription)
        }
    }

    func sendViaSMS(pdfHandler: @escaping (Data) -> Void) async {
        guard let phone = selectedClient?.phone, !phone.isEmpty else {
            state = .error("Enter a client phone number before sending.")
            return
        }
        if case .create = mode, createdInvoice == nil { await save() }
        if case .fromQuote = mode, createdInvoice == nil { await save() }
        guard let inv = createdInvoice else { return }
        state = .sendingPDF
        do {
            let pdfData = try await repo.sendViaSMS(invoiceId: inv.id, toPhone: phone)
            state = .done
            pdfHandler(pdfData)
        } catch {
            state = .error(error.localizedDescription)
        }
    }

    func sharePDF(pdfHandler: @escaping (Data) -> Void) async {
        if case .create = mode, createdInvoice == nil { await save() }
        if case .fromQuote = mode, createdInvoice == nil { await save() }
        guard let inv = createdInvoice else { return }
        state = .sendingPDF
        do {
            let pdfData = try await repo.generatePDF(invoiceId: inv.id)
            state = .idle
            pdfHandler(pdfData)
        } catch {
            state = .error(error.localizedDescription)
        }
    }
}

struct InvoiceFormView: View {
    var fromQuote: QuoteDTO? = nil
    var editInvoice: InvoiceDTO? = nil
    let onSaved: (InvoiceDTO) -> Void

    @Environment(FlashStore.self) private var flash
    @Environment(\.dismiss) private var dismiss

    @State private var store: InvoiceFormStore
    @State private var showingLineEditor = false
    @State private var editingDraft = LineItemDraft()
    @State private var showingClientPicker = false
    @State private var pdfShareItems: [Any] = []
    @State private var showingShareSheet = false

    init(fromQuote: QuoteDTO? = nil, editInvoice: InvoiceDTO? = nil, onSaved: @escaping (InvoiceDTO) -> Void) {
        self.fromQuote = fromQuote
        self.editInvoice = editInvoice
        self.onSaved = onSaved
        let mode: InvoiceFormStore.Mode
        if let q = fromQuote { mode = .fromQuote(q) }
        else if let inv = editInvoice { mode = .edit(inv) }
        else { mode = .create }
        _store = State(initialValue: InvoiceFormStore(mode: mode))
    }

    var body: some View {
        NavigationStack {
            Form {
                clientSection
                detailsSection
                lineItemsSection
                totalsSection
                notesSection
            }
            .navigationTitle(editInvoice == nil ? "New Invoice" : "Edit Invoice")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { toolbarContent }
            .disabled(isBusy)
            .overlay { if isBusy { loadingOverlay } }
            .sheet(isPresented: $showingClientPicker) {
                ClientPickerSheet(selected: $store.selectedClient)
            }
            .sheet(isPresented: $showingLineEditor) {
                LineItemEditorView(draft: $editingDraft) {
                    store.lineItems.append(editingDraft)
                    editingDraft = LineItemDraft()
                }
            }
            .sheet(isPresented: $showingShareSheet) {
                ShareSheet(items: pdfShareItems)
            }
            .onChange(of: store.state) { _, newState in
                if case .done = newState, let inv = store.createdInvoice {
                    onSaved(inv)
                    flash.success("Invoice saved")
                    dismiss()
                } else if case .error(let msg) = newState {
                    flash.error(msg)
                    store.state = .idle
                }
            }
        }
    }

    // MARK: – Sections

    private var clientSection: some View {
        Section("Client") {
            if let client = store.selectedClient {
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(client.name).flynnType(FlynnTypography.bodyMedium)
                        if !client.phone.isEmpty {
                            Text(client.phone).flynnType(FlynnTypography.caption).foregroundColor(FlynnColor.textTertiary)
                        }
                    }
                    Spacer()
                    Button("Change") { showingClientPicker = true }
                        .flynnType(FlynnTypography.caption).foregroundColor(FlynnColor.primary)
                }
            } else {
                Button(action: { showingClientPicker = true }) {
                    Label("Select client…", systemImage: "person.circle").foregroundColor(FlynnColor.primary)
                }
            }
        }
    }

    private var detailsSection: some View {
        Section("Invoice details") {
            TextField("Title", text: $store.title, axis: .vertical).lineLimit(1...2)
            DatePicker("Due date", selection: $store.dueDate, displayedComponents: .date)
        }
    }

    private var lineItemsSection: some View {
        Section {
            ForEach($store.lineItems) { $item in
                lineItemRow(item: item) {
                    editingDraft = item
                    showingLineEditor = true
                }
            }
            .onDelete { store.lineItems.remove(atOffsets: $0) }
            Button(action: {
                editingDraft = LineItemDraft()
                showingLineEditor = true
            }) {
                Label("Add item", systemImage: "plus.circle.fill").foregroundColor(FlynnColor.primary)
            }
        } header: { Text("Line items") }
    }

    private func lineItemRow(item: LineItemDraft, onTap: @escaping () -> Void) -> some View {
        Button(action: onTap) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(item.description.isEmpty ? "Untitled item" : item.description)
                        .flynnType(FlynnTypography.bodyMedium).foregroundColor(FlynnColor.textPrimary)
                    Text("\(item.quantity.formatted()) × \(FlynnFormatter.currency(item.unitPrice))")
                        .flynnType(FlynnTypography.caption).foregroundColor(FlynnColor.textTertiary)
                }
                Spacer()
                Text(FlynnFormatter.currency(item.total)).flynnType(FlynnTypography.label).foregroundColor(FlynnColor.textPrimary)
            }
        }.buttonStyle(.plain)
    }

    private var totalsSection: some View {
        Section("Totals") {
            HStack {
                Text("Subtotal").foregroundColor(FlynnColor.textSecondary)
                Spacer()
                Text(FlynnFormatter.currency(store.subtotal))
            }
            Toggle("Include GST", isOn: $store.includeTax)
            if store.includeTax {
                HStack {
                    Text("GST (10%)").foregroundColor(FlynnColor.textSecondary)
                    Spacer()
                    Text(FlynnFormatter.currency(store.taxAmount))
                }
            }
            HStack {
                Text("Total").fontWeight(.semibold)
                Spacer()
                Text(FlynnFormatter.currency(store.total)).flynnType(FlynnTypography.h4).foregroundColor(FlynnColor.primary)
            }
        }
    }

    private var notesSection: some View {
        Section("Notes (optional)") {
            TextField("Any details for the client…", text: $store.notes, axis: .vertical).lineLimit(3...8)
        }
    }

    @ToolbarContentBuilder
    private var toolbarContent: some ToolbarContent {
        ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
        ToolbarItem(placement: .primaryAction) {
            Menu {
                Button(action: { Task { await store.save() } }) {
                    Label("Save draft", systemImage: "doc")
                }
                Button(action: {
                    Task { await store.sendViaSMS { data in pdfShareItems = [data]; showingShareSheet = true } }
                }) {
                    Label("Send via SMS", systemImage: "message.fill")
                }
                Button(action: {
                    Task { await store.sharePDF { data in pdfShareItems = [data]; showingShareSheet = true } }
                }) {
                    Label("Share PDF", systemImage: "square.and.arrow.up")
                }
            } label: {
                Text("Send").fontWeight(.semibold)
                    .foregroundColor(store.lineItems.isEmpty ? FlynnColor.textTertiary : FlynnColor.primary)
            }
            .disabled(store.lineItems.isEmpty)
        }
    }

    private var isBusy: Bool {
        if case .saving = store.state { return true }
        if case .sendingPDF = store.state { return true }
        return false
    }

    private var loadingOverlay: some View {
        ZStack {
            Color.black.opacity(0.15).ignoresSafeArea()
            VStack(spacing: FlynnSpacing.sm) {
                ProgressView().tint(FlynnColor.primary)
                Text(isSendingPDF ? "Sending…" : "Saving…")
                    .flynnType(FlynnTypography.caption).foregroundColor(FlynnColor.textSecondary)
            }
            .padding(FlynnSpacing.lg)
            .background(RoundedRectangle(cornerRadius: FlynnRadii.md).fill(FlynnColor.backgroundSecondary))
        }
    }

    private var isSendingPDF: Bool {
        if case .sendingPDF = store.state { return true }
        return false
    }
}
