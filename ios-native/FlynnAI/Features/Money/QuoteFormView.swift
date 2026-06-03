import SwiftUI

@MainActor
@Observable
final class QuoteFormStore {
    enum Mode { case create; case edit(QuoteDTO) }
    enum State: Equatable { case idle, saving, sendingPDF, done, error(String) }

    var title: String = ""
    var selectedClient: SelectedClient?
    var lineItems: [LineItemDraft] = []
    var taxRate: Double = 10
    var includeTax: Bool = true
    var notes: String = ""
    var validUntil: Date = Calendar.current.date(byAdding: .day, value: 30, to: Date()) ?? Date()
    var state: State = .idle
    var createdQuote: QuoteDTO?

    var effectiveTaxRate: Double { includeTax ? taxRate : 0 }
    var subtotal: Double { lineItems.reduce(0) { $0 + $1.total } }
    var taxAmount: Double { subtotal * (effectiveTaxRate / 100) }
    var total: Double { subtotal + taxAmount }

    private let repo: QuotesRepositoryType
    private var orgId: UUID?
    private let mode: Mode

    init(mode: Mode, repo: QuotesRepositoryType = QuotesRepository()) {
        self.mode = mode
        self.repo = repo
        if case .edit(let q) = mode {
            title = q.title ?? ""
            lineItems = q.lineItems.map { LineItemDraft.from($0) }
            taxRate = q.taxRate
            includeTax = q.taxRate > 0
            notes = q.notes ?? ""
            validUntil = q.validUntil ?? validUntil
        }
    }

    func saveDraft() async {
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
            case .create:
                createdQuote = try await repo.create(
                    orgId: resolvedOrgId, title: title.isEmpty ? "Quote" : title,
                    clientId: selectedClient?.id, clientName: selectedClient?.name,
                    clientPhone: selectedClient?.phone.isEmpty == false ? selectedClient?.phone : nil,
                    lineItems: items, taxRate: effectiveTaxRate,
                    notes: notes.isEmpty ? nil : notes, validUntil: validUntil
                )
            case .edit(let q):
                createdQuote = try await repo.update(
                    id: q.id, title: title.isEmpty ? "Quote" : title,
                    clientPhone: selectedClient?.phone,
                    lineItems: items, taxRate: effectiveTaxRate,
                    notes: notes.isEmpty ? nil : notes, validUntil: validUntil
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
        // Save first if create mode
        if case .create = mode, createdQuote == nil { await saveDraft() }
        guard let quote = createdQuote else { return }
        guard case .done = state else { return }
        state = .sendingPDF
        do {
            let pdfData = try await repo.sendViaSMS(quoteId: quote.id, toPhone: phone)
            state = .done
            pdfHandler(pdfData)
        } catch {
            state = .error(error.localizedDescription)
        }
    }

    func sharePDF(pdfHandler: @escaping (Data) -> Void) async {
        if case .create = mode, createdQuote == nil { await saveDraft() }
        guard let quote = createdQuote else { return }
        state = .sendingPDF
        do {
            let pdfData = try await repo.generatePDF(quoteId: quote.id)
            state = .idle
            pdfHandler(pdfData)
        } catch {
            state = .error(error.localizedDescription)
        }
    }
}

struct QuoteFormView: View {
    var editQuote: QuoteDTO? = nil
    let onSaved: (QuoteDTO) -> Void

    @Environment(FlashStore.self) private var flash
    @Environment(\.dismiss) private var dismiss

    @State private var store: QuoteFormStore
    @State private var showingLineEditor = false
    @State private var editingDraft = LineItemDraft()
    @State private var showingClientPicker = false
    @State private var pdfShareItems: [Any] = []
    @State private var showingShareSheet = false

    init(editQuote: QuoteDTO? = nil, onSaved: @escaping (QuoteDTO) -> Void) {
        self.editQuote = editQuote
        self.onSaved = onSaved
        _store = State(initialValue: QuoteFormStore(
            mode: editQuote.map { .edit($0) } ?? .create
        ))
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
            .navigationTitle(editQuote == nil ? "New Quote" : "Edit Quote")
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
                if case .done = newState, let q = store.createdQuote {
                    onSaved(q)
                    flash.success("Quote saved")
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
                        Text(client.name)
                            .flynnType(FlynnTypography.bodyMedium)
                        if !client.phone.isEmpty {
                            Text(client.phone)
                                .flynnType(FlynnTypography.caption)
                                .foregroundColor(FlynnColor.textTertiary)
                        }
                    }
                    Spacer()
                    Button("Change") { showingClientPicker = true }
                        .flynnType(FlynnTypography.caption)
                        .foregroundColor(FlynnColor.primary)
                }
            } else {
                Button(action: { showingClientPicker = true }) {
                    Label("Select client…", systemImage: "person.circle")
                        .foregroundColor(FlynnColor.primary)
                }
            }
        }
    }

    private var detailsSection: some View {
        Section("Quote details") {
            TextField("Title (e.g. Roof repair – 42 Smith St)", text: $store.title, axis: .vertical)
                .lineLimit(1...2)
            DatePicker("Valid until", selection: $store.validUntil, displayedComponents: .date)
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
                Label("Add item", systemImage: "plus.circle.fill")
                    .foregroundColor(FlynnColor.primary)
            }
        } header: {
            Text("Line items")
        } footer: {
            if store.lineItems.isEmpty {
                Text("Add at least one item to create a quote.")
                    .foregroundColor(FlynnColor.textTertiary)
            }
        }
    }

    private func lineItemRow(item: LineItemDraft, onTap: @escaping () -> Void) -> some View {
        Button(action: onTap) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(item.description.isEmpty ? "Untitled item" : item.description)
                        .flynnType(FlynnTypography.bodyMedium)
                        .foregroundColor(FlynnColor.textPrimary)
                    Text("\(item.quantity.formatted()) × \(FlynnFormatter.currency(item.unitPrice))")
                        .flynnType(FlynnTypography.caption)
                        .foregroundColor(FlynnColor.textTertiary)
                }
                Spacer()
                Text(FlynnFormatter.currency(item.total))
                    .flynnType(FlynnTypography.label)
                    .foregroundColor(FlynnColor.textPrimary)
            }
        }
        .buttonStyle(.plain)
    }

    private var totalsSection: some View {
        Section("Totals") {
            HStack {
                Text("Subtotal")
                    .foregroundColor(FlynnColor.textSecondary)
                Spacer()
                Text(FlynnFormatter.currency(store.subtotal))
            }
            Toggle("Include GST", isOn: $store.includeTax)
            if store.includeTax {
                HStack {
                    Text("GST (10%)")
                        .foregroundColor(FlynnColor.textSecondary)
                    Spacer()
                    Text(FlynnFormatter.currency(store.taxAmount))
                }
            }
            HStack {
                Text("Total").fontWeight(.semibold)
                Spacer()
                Text(FlynnFormatter.currency(store.total))
                    .flynnType(FlynnTypography.h4)
                    .foregroundColor(FlynnColor.primary)
            }
        }
    }

    private var notesSection: some View {
        Section("Notes (optional)") {
            TextField("Any extra details for the client…", text: $store.notes, axis: .vertical)
                .lineLimit(3...8)
        }
    }

    // MARK: – Toolbar

    @ToolbarContentBuilder
    private var toolbarContent: some ToolbarContent {
        ToolbarItem(placement: .cancellationAction) {
            Button("Cancel") { dismiss() }
        }
        ToolbarItem(placement: .primaryAction) {
            Menu {
                Button(action: { Task { await store.saveDraft() } }) {
                    Label("Save draft", systemImage: "doc")
                }
                Button(action: {
                    Task {
                        await store.sendViaSMS { data in
                            pdfShareItems = [data]
                            showingShareSheet = true
                        }
                    }
                }) {
                    Label("Send via SMS", systemImage: "message.fill")
                }
                Button(action: {
                    Task {
                        await store.sharePDF { data in
                            pdfShareItems = [data]
                            showingShareSheet = true
                        }
                    }
                }) {
                    Label("Share PDF", systemImage: "square.and.arrow.up")
                }
            } label: {
                Text("Send")
                    .fontWeight(.semibold)
                    .foregroundColor(store.lineItems.isEmpty ? FlynnColor.textTertiary : FlynnColor.primary)
            }
            .disabled(store.lineItems.isEmpty)
        }
    }

    // MARK: – Helpers

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
                Text(store.state.isSendingPDF ? "Sending…" : "Saving…")
                    .flynnType(FlynnTypography.caption)
                    .foregroundColor(FlynnColor.textSecondary)
            }
            .padding(FlynnSpacing.lg)
            .background(RoundedRectangle(cornerRadius: FlynnRadii.md).fill(FlynnColor.backgroundSecondary))
        }
    }
}

// MARK: – UIActivityViewController wrapper

struct ShareSheet: UIViewControllerRepresentable {
    let items: [Any]
    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }
    func updateUIViewController(_ vc: UIActivityViewController, context: Context) {}
}

private extension QuoteFormStore.State {
    var isSendingPDF: Bool { if case .sendingPDF = self { return true }; return false }
}
