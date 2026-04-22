import SwiftUI

struct CallsListView: View {
    @State private var store = CallsListStore()

    var body: some View {
        Group {
            switch store.state {
            case .idle, .loading:
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            case .error(let message):
                ContentUnavailableView {
                    Label("Couldn't load calls", systemImage: "exclamationmark.triangle")
                } description: {
                    Text(message)
                } actions: {
                    FlynnButton(title: "Retry", action: { Task { await store.load() } }, variant: .secondary, size: .small)
                }
            case .loaded:
                if store.calls.isEmpty {
                    ContentUnavailableView(
                        "No calls yet",
                        systemImage: "phone",
                        description: Text("Incoming calls will show up here once your number is live.")
                    )
                } else {
                    list
                }
            }
        }
        .background(FlynnColor.background)
        .navigationTitle("Calls")
        .task { await store.load() }
        .refreshable { await store.load() }
    }

    private var list: some View {
        ScrollView {
            LazyVStack(spacing: FlynnSpacing.md) {
                ForEach(store.calls) { call in
                    NavigationLink(value: Route.callDetail(id: call.id)) {
                        CallRow(call: call)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, FlynnSpacing.lg)
            .padding(.vertical, FlynnSpacing.md)
        }
    }
}
