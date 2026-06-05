import SwiftUI

struct InvoicesListView: View {
    @State private var store = InvoicesListStore()
    @State private var showingCreateSheet = false

    var body: some View {
        Group {
            switch store.state {
            case .idle, .loading:
                ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
            case .error(let message):
                ContentUnavailableView {
                    Label("Couldn't load invoices", systemImage: "exclamationmark.triangle")
                } description: {
                    Text(message)
                } actions: {
                    FlynnButton(title: "Retry", action: { Task { await store.load() } }, variant: .secondary, size: .small)
                }
            case .loaded:
                if store.invoices.isEmpty {
                    emptyState
                } else {
                    list
                }
            }
        }
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button { showingCreateSheet = true } label: {
                    Label("New invoice", systemImage: "plus")
                }
            }
        }
        .sheet(isPresented: $showingCreateSheet) {
            InvoiceFormView { _ in Task { await store.load() } }
        }
        .task { await store.load() }
        .refreshable { await store.load() }
    }

    private var emptyState: some View {
        VStack(spacing: FlynnSpacing.md) {
            Image(systemName: "doc.text.magnifyingglass")
                .font(.system(size: 48))
                .foregroundColor(FlynnColor.textTertiary)
            Text("No invoices yet")
                .flynnType(FlynnTypography.h3)
                .foregroundColor(FlynnColor.textPrimary)
            Text("Bill clients with a polished invoice — sent via SMS or share as a PDF.")
                .flynnType(FlynnTypography.bodyMedium)
                .foregroundColor(FlynnColor.textSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, FlynnSpacing.lg)
            FlynnButton(title: "New Invoice", action: { showingCreateSheet = true })
                .padding(.top, FlynnSpacing.sm)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(FlynnSpacing.lg)
    }

    private var list: some View {
        ScrollView {
            LazyVStack(spacing: FlynnSpacing.md) {
                ForEach(store.invoices) { invoice in
                    NavigationLink(value: Route.invoiceDetail(id: invoice.id)) {
                        InvoiceRow(invoice: invoice)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, FlynnSpacing.lg)
            .padding(.vertical, FlynnSpacing.md)
        }
    }
}
