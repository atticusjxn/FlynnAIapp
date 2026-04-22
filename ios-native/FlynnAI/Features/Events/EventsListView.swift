import SwiftUI

struct EventsListView: View {
    @State private var store = EventsListStore()
    @State private var showingAddSheet = false

    var body: some View {
        Group {
            switch store.state {
            case .idle, .loading:
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            case .error(let message):
                ContentUnavailableView {
                    Label("Couldn't load events", systemImage: "exclamationmark.triangle")
                } description: {
                    Text(message)
                } actions: {
                    FlynnButton(title: "Retry", action: { Task { await store.load() } }, variant: .secondary, size: .small)
                }
            case .loaded:
                if store.events.isEmpty {
                    ContentUnavailableView(
                        "No events yet",
                        systemImage: "calendar",
                        description: Text("Captured leads and scheduled jobs will show here.")
                    )
                } else {
                    list
                }
            }
        }
        .background(FlynnColor.background)
        .navigationTitle("Events")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    showingAddSheet = true
                } label: {
                    Label("New event", systemImage: "plus")
                }
            }
        }
        .sheet(isPresented: $showingAddSheet) {
            EventFormView(mode: .create) { _ in
                Task { await store.load() }
            }
        }
        .task { await store.load() }
        .refreshable { await store.load() }
    }

    private var list: some View {
        ScrollView {
            LazyVStack(spacing: FlynnSpacing.md) {
                ForEach(store.events) { event in
                    NavigationLink(value: Route.eventDetail(id: event.id)) {
                        EventRow(event: event)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, FlynnSpacing.lg)
            .padding(.vertical, FlynnSpacing.md)
        }
    }
}

@MainActor
@Observable
final class EventsListStore {
    enum State: Equatable {
        case idle, loading, loaded, error(String)
    }

    var state: State = .idle
    var events: [EventDTO] = []

    private let repository: EventsRepositoryType

    init(repository: EventsRepositoryType = EventsRepository()) {
        self.repository = repository
    }

    func load() async {
        state = .loading
        do {
            events = try await repository.list(limit: 100)
            state = .loaded
        } catch {
            state = .error(error.localizedDescription)
        }
    }
}
