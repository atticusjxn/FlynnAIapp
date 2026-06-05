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
                    Label("Couldn't load bookings", systemImage: "exclamationmark.triangle")
                } description: {
                    Text(message)
                } actions: {
                    FlynnButton(title: "Retry", action: { Task { await store.load() } }, variant: .secondary, size: .small)
                }
            case .loaded:
                if store.events.isEmpty {
                    MascotEmptyState(
                        pose: .sleep,
                        title: "No bookings yet",
                        message: "Jobs you book with Flynn — and ones you add — show up here, synced to your calendar."
                    )
                } else {
                    list
                }
            }
        }
        .background(FlynnColor.background)
        .navigationTitle("Bookings")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    showingAddSheet = true
                } label: {
                    Label("New booking", systemImage: "plus")
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
            LazyVStack(alignment: .leading, spacing: FlynnSpacing.md) {
                if !store.upcoming.isEmpty {
                    sectionHeader("Upcoming")
                    ForEach(store.upcoming) { eventRow($0) }
                }
                if !store.past.isEmpty {
                    sectionHeader("Past")
                    ForEach(store.past) { eventRow($0) }
                }
            }
            .padding(.horizontal, FlynnSpacing.lg)
            .padding(.vertical, FlynnSpacing.md)
        }
    }

    private func sectionHeader(_ title: String) -> some View {
        Text(title)
            .flynnType(FlynnTypography.overline)
            .foregroundColor(FlynnColor.textTertiary)
            .padding(.top, FlynnSpacing.xs)
    }

    private func eventRow(_ event: EventDTO) -> some View {
        NavigationLink(value: Route.eventDetail(id: event.id)) {
            EventRow(event: event)
        }
        .buttonStyle(.plain)
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

    var upcoming: [EventDTO] { events.filter { isUpcoming($0) } }
    var past: [EventDTO] { events.filter { !isUpcoming($0) } }

    private func isUpcoming(_ e: EventDTO) -> Bool {
        if e.status == "complete" { return false }
        if let d = e.scheduledDate { return d >= Calendar.current.startOfDay(for: Date()) }
        return true
    }

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
