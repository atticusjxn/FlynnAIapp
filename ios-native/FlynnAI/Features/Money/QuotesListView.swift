import SwiftUI

struct QuotesListView: View {
    @State private var store = QuotesListStore()

    var body: some View {
        Group {
            switch store.state {
            case .idle, .loading:
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            case .error(let message):
                ContentUnavailableView {
                    Label("Couldn't load quotes", systemImage: "exclamationmark.triangle")
                } description: {
                    Text(message)
                } actions: {
                    FlynnButton(title: "Retry", action: { Task { await store.load() } }, variant: .secondary, size: .small)
                }
            case .loaded:
                if store.quotes.isEmpty {
                    ContentUnavailableView(
                        "No quotes yet",
                        systemImage: "doc.text",
                        description: Text("Quotes you send to clients will appear here.")
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
                ForEach(store.quotes) { quote in
                    NavigationLink(value: Route.quoteDetail(id: quote.id)) {
                        QuoteRow(quote: quote)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, FlynnSpacing.lg)
            .padding(.vertical, FlynnSpacing.md)
        }
    }
}
