import SwiftUI

struct EventDetailView: View {
    let eventId: UUID

    @Environment(\.dismiss) private var dismiss
    @Environment(FlashStore.self) private var flash

    @State private var event: EventDTO?
    @State private var errorMessage: String?
    @State private var isLoading = true
    @State private var showingEditSheet = false
    @State private var showingDeleteAlert = false
    @State private var isMutating = false

    private let repository: EventsRepositoryType = EventsRepository()

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: FlynnSpacing.lg) {
                if isLoading {
                    ProgressView()
                        .frame(maxWidth: .infinity)
                        .padding(.top, FlynnSpacing.xl)
                } else if let event {
                    headerCard(event: event)
                    quickActions(event: event)
                    if let notes = event.notes, !notes.isEmpty {
                        notesCard(notes: notes)
                    }
                } else if let errorMessage {
                    ContentUnavailableView(
                        "Couldn't load event",
                        systemImage: "exclamationmark.triangle",
                        description: Text(errorMessage)
                    )
                }
            }
            .padding(FlynnSpacing.lg)
        }
        .background(FlynnColor.background)
        .navigationTitle("Event")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if event != nil {
                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        Button {
                            showingEditSheet = true
                        } label: {
                            Label("Edit", systemImage: "pencil")
                        }
                        Button(role: .destructive) {
                            showingDeleteAlert = true
                        } label: {
                            Label("Delete", systemImage: "trash")
                        }
                    } label: {
                        Image(systemName: "ellipsis.circle")
                    }
                    .disabled(isMutating)
                }
            }
        }
        .sheet(isPresented: $showingEditSheet) {
            if let event {
                EventFormView(mode: .edit(event)) { updated in
                    self.event = updated
                }
            }
        }
        .alert("Delete this event?", isPresented: $showingDeleteAlert) {
            Button("Cancel", role: .cancel) { }
            Button("Delete", role: .destructive) { delete() }
        } message: {
            Text("This removes the event permanently.")
        }
        .task { await load() }
    }

    // MARK: Quick actions

    @ViewBuilder
    private func quickActions(event: EventDTO) -> some View {
        let currentStatus = event.status?.lowercased()
        VStack(spacing: FlynnSpacing.sm) {
            if currentStatus != "complete" {
                FlynnButton(
                    title: "Mark complete",
                    action: { setStatus("complete") },
                    variant: .success,
                    fullWidth: true,
                    isLoading: isMutating,
                    icon: Image(systemName: "checkmark")
                )
            }
            if currentStatus == "pending" {
                FlynnButton(
                    title: "Start",
                    action: { setStatus("in-progress") },
                    variant: .secondary,
                    fullWidth: true,
                    isLoading: isMutating,
                    icon: Image(systemName: "play.fill")
                )
            }
        }
    }

    private func setStatus(_ newStatus: String) {
        isMutating = true
        Task {
            defer { isMutating = false }
            do {
                let updated = try await repository.setStatus(id: eventId, status: newStatus)
                event = updated
                flash.success("Event updated")
            } catch {
                FlynnLog.network.error("Status change failed: \(error.localizedDescription, privacy: .public)")
                flash.error("Couldn't update status")
            }
        }
    }

    private func delete() {
        isMutating = true
        Task {
            defer { isMutating = false }
            do {
                try await repository.delete(id: eventId)
                flash.success("Event deleted")
                dismiss()
            } catch {
                FlynnLog.network.error("Event delete failed: \(error.localizedDescription, privacy: .public)")
                flash.error("Couldn't delete event")
            }
        }
    }

    private func headerCard(event: EventDTO) -> some View {
        FlynnCard {
            VStack(alignment: .leading, spacing: FlynnSpacing.sm) {
                HStack {
                    Text(event.clientName ?? "Unknown client")
                        .flynnType(FlynnTypography.h2)
                    Spacer()
                    if let status = event.status {
                        FlynnBadge(label: status)
                    }
                }
                if let service = event.serviceType {
                    Text(service)
                        .flynnType(FlynnTypography.bodyLarge)
                        .foregroundColor(FlynnColor.textSecondary)
                }
                if let location = event.location {
                    Label(location, systemImage: "mappin.and.ellipse")
                        .flynnType(FlynnTypography.bodyMedium)
                        .foregroundColor(FlynnColor.textSecondary)
                }
                if let date = event.scheduledDate {
                    Label(date.formatted(date: .abbreviated, time: .omitted), systemImage: "calendar")
                        .flynnType(FlynnTypography.bodyMedium)
                        .foregroundColor(FlynnColor.textSecondary)
                }
                if let time = event.scheduledTime {
                    Label(time, systemImage: "clock")
                        .flynnType(FlynnTypography.bodyMedium)
                        .foregroundColor(FlynnColor.textSecondary)
                }
            }
        }
    }

    private func notesCard(notes: String) -> some View {
        FlynnCard(shadow: .sm) {
            VStack(alignment: .leading, spacing: FlynnSpacing.xs) {
                Text("Notes")
                    .flynnType(FlynnTypography.overline)
                    .foregroundColor(FlynnColor.textTertiary)
                Text(notes)
                    .flynnType(FlynnTypography.bodyMedium)
            }
        }
    }

    private func load() async {
        isLoading = true
        defer { isLoading = false }
        do {
            event = try await repository.fetch(id: eventId)
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
