import SwiftUI

struct InvoicesListView: View {
    @State private var store = InvoicesListStore()

    var body: some View {
        Group {
            switch store.state {
            case .idle, .loading:
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
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
                    ContentUnavailableView(
                        "No invoices yet",
                        systemImage: "doc.text",
                        description: Text("Invoices you issue will appear here.")
                    )
                } else {
                    list
                }
            }
        }
        .task { await store.load() }
        .refreshable { await store.load() }
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
