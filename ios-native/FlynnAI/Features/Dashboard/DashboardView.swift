import SwiftUI

struct DashboardView: View {
    @State private var store = DashboardStore()
    @State private var showingAddSheet = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: FlynnSpacing.lg) {
                header

                switch store.state {
                case .idle, .loading:
                    loadingCard
                case .error(let message):
                    errorCard(message: message)
                case .loaded:
                    if store.events.isEmpty {
                        emptyCard
                    } else {
                        upcomingSection
                    }
                }
            }
            .padding(.horizontal, FlynnSpacing.lg)
            .padding(.vertical, FlynnSpacing.lg)
        }
        .background(FlynnColor.background)
        .navigationTitle("Dashboard")
        .navigationBarTitleDisplayMode(.large)
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

    private var header: some View {
        VStack(alignment: .leading, spacing: FlynnSpacing.xs) {
            Text("Welcome back")
                .flynnType(FlynnTypography.overline)
                .foregroundColor(FlynnColor.textTertiary)
            Text("Your inbound revenue OS")
                .flynnType(FlynnTypography.h2)
        }
    }

    private var loadingCard: some View {
        FlynnCard {
            HStack(spacing: FlynnSpacing.sm) {
                ProgressView()
                Text("Loading your events…")
                    .flynnType(FlynnTypography.bodyMedium)
                    .foregroundColor(FlynnColor.textSecondary)
            }
        }
    }

    private func errorCard(message: String) -> some View {
        FlynnCard {
            VStack(alignment: .leading, spacing: FlynnSpacing.xs) {
                Text("Couldn't load events")
                    .flynnType(FlynnTypography.h4)
                    .foregroundColor(FlynnColor.error)
                Text(message)
                    .flynnType(FlynnTypography.bodySmall)
                    .foregroundColor(FlynnColor.textSecondary)
                FlynnButton(title: "Retry", action: { Task { await store.load() } }, variant: .secondary, size: .small)
                    .padding(.top, FlynnSpacing.xs)
            }
        }
    }

    private var emptyCard: some View {
        FlynnCard {
            VStack(alignment: .leading, spacing: FlynnSpacing.xs) {
                Text("No events yet")
                    .flynnType(FlynnTypography.h4)
                Text("When Flynn captures a lead, it'll show up here.")
                    .flynnType(FlynnTypography.bodyMedium)
                    .foregroundColor(FlynnColor.textSecondary)
            }
        }
    }

    private var upcomingSection: some View {
        VStack(alignment: .leading, spacing: FlynnSpacing.sm) {
            Text("Recent events")
                .flynnType(FlynnTypography.h3)
            VStack(spacing: FlynnSpacing.md) {
                ForEach(store.events) { event in
                    NavigationLink(value: Route.eventDetail(id: event.id)) {
                        EventRow(event: event)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }
}
