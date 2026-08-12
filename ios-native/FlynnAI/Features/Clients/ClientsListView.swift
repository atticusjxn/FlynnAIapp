import SwiftUI

struct ClientsListView: View {
    @State private var store = ClientsListStore()
    @State private var showingAddSheet = false

    var body: some View {
        Group {
            switch store.state {
            case .idle, .loading:
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            case .error(let message):
                ContentUnavailableView {
                    Label("Couldn't load clients", systemImage: "exclamationmark.triangle")
                } description: {
                    Text(message)
                } actions: {
                    FlynnButton(title: "Retry", action: { Task { await store.load() } }, variant: .secondary, size: .small)
                }
            case .loaded:
                if store.clients.isEmpty {
                    MascotEmptyState(
                        pose: .wave,
                        title: "No clients yet",
                        message: "Clients you've captured leads or jobs for show up here — Flynn adds them automatically from calls and texts."
                    )
                } else {
                    list
                }
            }
        }
        .background(FlynnColor.background)
        .navigationTitle("Clients")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    showingAddSheet = true
                } label: {
                    Label("New client", systemImage: "plus")
                }
            }
        }
        .sheet(isPresented: $showingAddSheet) {
            ClientFormView(mode: .create) { _ in
                Task { await store.load() }
            }
        }
        .task { await store.load() }
        .refreshable { await store.load() }
    }

    private var list: some View {
        ScrollView {
            LazyVStack(spacing: FlynnSpacing.md) {
                ForEach(store.clients) { client in
                    NavigationLink(value: Route.clientDetail(id: client.id)) {
                        ClientRow(client: client)
                    }
                    .buttonStyle(FlynnPressable())
                }
            }
            .padding(.horizontal, FlynnSpacing.lg)
            .padding(.vertical, FlynnSpacing.md)
        }
    }
}
