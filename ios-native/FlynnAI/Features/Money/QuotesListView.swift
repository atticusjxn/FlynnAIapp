import SwiftUI

struct QuotesListView: View {
    @State private var store = QuotesListStore()
    @State private var showingCreateSheet = false

    var body: some View {
        Group {
            switch store.state {
            case .idle, .loading:
                ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
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
                    emptyState
                } else {
                    list
                }
            }
        }
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button { showingCreateSheet = true } label: {
                    Label("New quote", systemImage: "plus")
                }
            }
        }
        .sheet(isPresented: $showingCreateSheet) {
            QuoteFormView { _ in
                Task { await store.load() }
            }
        }
        .task { await store.load() }
        .refreshable { await store.load() }
    }

    private var emptyState: some View {
        VStack(spacing: FlynnSpacing.md) {
            Image(systemName: "doc.text")
                .font(.system(size: 48))
                .foregroundColor(FlynnColor.textTertiary)
            Text("No quotes yet")
                .flynnType(FlynnTypography.h3)
                .foregroundColor(FlynnColor.textPrimary)
            Text("Send your first quote in 30 seconds — pick a client, add line items, tap Send.")
                .flynnType(FlynnTypography.bodyMedium)
                .foregroundColor(FlynnColor.textSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, FlynnSpacing.lg)
            FlynnButton(title: "New Quote", action: { showingCreateSheet = true })
                .padding(.top, FlynnSpacing.sm)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(FlynnSpacing.lg)
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
