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

    // Job notes thread + photo gallery — see ~/.claude/plans/iridescent-floating-moore.md
    // "system of record" job concept. Loaded alongside the job itself.
    @State private var notes: [JobNoteDTO] = []
    @State private var photos: [JobPhotoDTO] = []
    @State private var linkedClient: ClientDTO?
    @State private var newNoteBody: String = ""
    @State private var isAddingNote = false
    @FocusState private var noteFieldFocused: Bool

    private let repository: EventsRepositoryType = EventsRepository()
    private let notesRepository: JobNotesRepositoryType = JobNotesRepository()
    private let photosRepository: JobPhotosRepositoryType = JobPhotosRepository()
    private let clientsRepository: ClientsRepositoryType = ClientsRepository()

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
                    if let client = linkedClient {
                        clientLinkCard(client: client)
                    }
                    if let notes = event.notes, !notes.isEmpty {
                        notesCard(notes: notes)
                    }
                    photosSection
                    notesThreadSection
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

    // MARK: – Linked client

    private func clientLinkCard(client: ClientDTO) -> some View {
        NavigationLink(value: Route.clientDetail(id: client.id)) {
            FlynnCard(shadow: .sm) {
                HStack(spacing: FlynnSpacing.sm) {
                    Image(systemName: "person.crop.circle")
                        .foregroundColor(FlynnColor.primary)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(client.name)
                            .flynnType(FlynnTypography.bodyLarge)
                            .foregroundColor(FlynnColor.textPrimary)
                        Text("View client")
                            .flynnType(FlynnTypography.caption)
                            .foregroundColor(FlynnColor.textTertiary)
                    }
                    Spacer()
                    Image(systemName: "chevron.right")
                        .foregroundColor(FlynnColor.textTertiary)
                }
            }
        }
        .buttonStyle(.plain)
    }

    // MARK: – Photo gallery (read-only — see JobPhotoDTO for why capture/upload
    // isn't wired up here yet)

    @ViewBuilder
    private var photosSection: some View {
        if !photos.isEmpty {
            VStack(alignment: .leading, spacing: FlynnSpacing.sm) {
                Text("Job photos")
                    .flynnType(FlynnTypography.h4)
                    .foregroundColor(FlynnColor.textPrimary)
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: FlynnSpacing.sm) {
                        ForEach(photos) { photo in
                            AsyncImage(url: URL(string: photo.publicURL)) { phase in
                                switch phase {
                                case .success(let image):
                                    image.resizable().aspectRatio(contentMode: .fill)
                                case .failure:
                                    Image(systemName: "photo").foregroundColor(FlynnColor.textTertiary)
                                default:
                                    ProgressView()
                                }
                            }
                            .frame(width: 110, height: 110)
                            .clipShape(RoundedRectangle(cornerRadius: FlynnRadii.md, style: .continuous))
                            .brutalistBorder(cornerRadius: FlynnRadii.md)
                        }
                    }
                }
            }
        }
    }

    // MARK: – Notes thread (job_notes — replaces the single jobs.notes field
    // for anything added going forward; the legacy `notesCard` above still
    // shows the original free-text note if one exists)

    private var notesThreadSection: some View {
        VStack(alignment: .leading, spacing: FlynnSpacing.sm) {
            Text("Activity")
                .flynnType(FlynnTypography.h4)
                .foregroundColor(FlynnColor.textPrimary)

            ForEach(notes) { note in
                VStack(alignment: .leading, spacing: 2) {
                    Text(note.body)
                        .flynnType(FlynnTypography.bodyMedium)
                        .foregroundColor(FlynnColor.textPrimary)
                    Text(note.createdAt.formatted(date: .abbreviated, time: .shortened))
                        .flynnType(FlynnTypography.caption)
                        .foregroundColor(FlynnColor.textTertiary)
                }
                .padding(FlynnSpacing.sm)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(RoundedRectangle(cornerRadius: FlynnRadii.md, style: .continuous).fill(FlynnColor.backgroundSecondary))
                .brutalistBorder(cornerRadius: FlynnRadii.md)
            }

            HStack(spacing: FlynnSpacing.sm) {
                TextField("Add a note…", text: $newNoteBody, axis: .vertical)
                    .flynnType(FlynnTypography.bodyMedium)
                    .lineLimit(1...4)
                    .focused($noteFieldFocused)
                    .padding(.horizontal, FlynnSpacing.sm)
                    .padding(.vertical, FlynnSpacing.xs)
                    .background(RoundedRectangle(cornerRadius: FlynnRadii.md, style: .continuous).fill(FlynnColor.background))
                    .brutalistBorder(cornerRadius: FlynnRadii.md, color: noteFieldFocused ? FlynnColor.borderFocus : FlynnColor.border)

                Button(action: addNote) {
                    Image(systemName: "arrow.up")
                        .foregroundColor(FlynnColor.white)
                        .frame(width: 44, height: 44)
                        .background(Circle().fill(FlynnColor.primary))
                }
                .disabled(newNoteBody.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isAddingNote)
            }
        }
    }

    private func addNote() {
        let body = newNoteBody.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !body.isEmpty else { return }
        isAddingNote = true
        noteFieldFocused = false
        Task {
            defer { isAddingNote = false }
            do {
                let note = try await notesRepository.add(jobId: eventId, body: body)
                notes.append(note)
                newNoteBody = ""
            } catch {
                FlynnLog.network.error("Add job note failed: \(error.localizedDescription, privacy: .public)")
                flash.error("Couldn't add note")
            }
        }
    }

    private func load() async {
        isLoading = true
        defer { isLoading = false }
        do {
            let loaded = try await repository.fetch(id: eventId)
            event = loaded
            // Best-effort: notes/photos/client are additive system-of-record
            // data that may not exist for older jobs, and the backing tables
            // may not be migrated yet in every environment — a failure here
            // shouldn't block showing the job itself.
            async let notesTask = notesRepository.list(jobId: eventId)
            async let photosTask = photosRepository.list(jobId: eventId)
            notes = (try? await notesTask) ?? []
            photos = (try? await photosTask) ?? []
            if let clientId = loaded.clientId {
                linkedClient = try? await clientsRepository.fetch(id: clientId)
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
