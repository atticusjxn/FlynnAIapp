import SwiftUI

struct ClientDetailView: View {
    let clientId: UUID

    @Environment(\.dismiss) private var dismiss
    @Environment(FlashStore.self) private var flash

    @State private var client: ClientDTO?
    @State private var errorMessage: String?
    @State private var isLoading = true
    @State private var showingEditSheet = false
    @State private var showingDeleteAlert = false
    @State private var isDeleting = false

    private let repository: ClientsRepositoryType = ClientsRepository()

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: FlynnSpacing.lg) {
                if isLoading {
                    ProgressView()
                        .frame(maxWidth: .infinity)
                        .padding(.top, FlynnSpacing.xl)
                } else if let client {
                    identityCard(client: client)
                    contactCard(client: client)
                    statsCard(client: client)
                    if let notes = client.notes, !notes.isEmpty {
                        notesCard(notes: notes)
                    }
                } else if let errorMessage {
                    ContentUnavailableView(
                        "Couldn't load client",
                        systemImage: "exclamationmark.triangle",
                        description: Text(errorMessage)
                    )
                }
            }
            .padding(FlynnSpacing.lg)
        }
        .background(FlynnColor.background)
        .navigationTitle("Client")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if let client {
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
                    .disabled(isDeleting)
                }
            }
        }
        .sheet(isPresented: $showingEditSheet) {
            if let client {
                ClientFormView(mode: .edit(client)) { updated in
                    self.client = updated
                }
            }
        }
        .alert("Delete this client?", isPresented: $showingDeleteAlert) {
            Button("Cancel", role: .cancel) { }
            Button("Delete", role: .destructive) { delete() }
        } message: {
            Text("This will remove the client and their contact info. Jobs tied to them stay in place.")
        }
        .task { await load() }
    }

    private func delete() {
        isDeleting = true
        Task {
            defer { isDeleting = false }
            do {
                try await repository.delete(id: clientId)
                flash.success("Client deleted")
                dismiss()
            } catch {
                FlynnLog.network.error("Client delete failed: \(error.localizedDescription, privacy: .public)")
                flash.error("Couldn't delete client")
            }
        }
    }

    private func identityCard(client: ClientDTO) -> some View {
        FlynnCard {
            VStack(alignment: .leading, spacing: FlynnSpacing.xs) {
                Text(client.name)
                    .flynnType(FlynnTypography.h2)
                if let businessType = client.businessType {
                    Text(businessType.capitalized)
                        .flynnType(FlynnTypography.bodyMedium)
                        .foregroundColor(FlynnColor.textSecondary)
                }
                if let preferred = client.preferredContactMethod {
                    HStack(spacing: FlynnSpacing.xs) {
                        Text("Prefers")
                            .flynnType(FlynnTypography.caption)
                            .foregroundColor(FlynnColor.textTertiary)
                        FlynnBadge(label: preferred.capitalized, variant: .primary)
                    }
                    .padding(.top, FlynnSpacing.xxs)
                }
            }
        }
    }

    private func contactCard(client: ClientDTO) -> some View {
        FlynnCard(shadow: .sm) {
            VStack(alignment: .leading, spacing: FlynnSpacing.sm) {
                Text("Contact")
                    .flynnType(FlynnTypography.overline)
                    .foregroundColor(FlynnColor.textTertiary)

                if let phone = client.phone, !phone.isEmpty {
                    contactRow(
                        systemImage: "phone",
                        value: FlynnFormatter.phone(phone),
                        url: URL(string: "tel:\(phone.filter { $0.isNumber || $0 == "+" })")
                    )
                }
                if let email = client.email, !email.isEmpty {
                    contactRow(
                        systemImage: "envelope",
                        value: email,
                        url: URL(string: "mailto:\(email)")
                    )
                }
                if let address = client.address, !address.isEmpty {
                    contactRow(
                        systemImage: "mappin.and.ellipse",
                        value: address,
                        url: nil
                    )
                }
            }
        }
    }

    private func contactRow(systemImage: String, value: String, url: URL?) -> some View {
        Group {
            if let url {
                Link(destination: url) {
                    Label(value, systemImage: systemImage)
                        .flynnType(FlynnTypography.bodyLarge)
                        .foregroundColor(FlynnColor.primary)
                }
            } else {
                Label(value, systemImage: systemImage)
                    .flynnType(FlynnTypography.bodyLarge)
                    .foregroundColor(FlynnColor.textPrimary)
            }
        }
    }

    private func statsCard(client: ClientDTO) -> some View {
        FlynnCard(shadow: .sm) {
            VStack(alignment: .leading, spacing: FlynnSpacing.sm) {
                Text("Activity")
                    .flynnType(FlynnTypography.overline)
                    .foregroundColor(FlynnColor.textTertiary)
                HStack {
                    VStack(alignment: .leading, spacing: FlynnSpacing.xxs) {
                        Text("\(client.totalJobs ?? 0)")
                            .flynnType(FlynnTypography.h2)
                        Text("Total jobs")
                            .flynnType(FlynnTypography.caption)
                            .foregroundColor(FlynnColor.textTertiary)
                    }
                    Spacer()
                    if let last = client.lastJobDate {
                        VStack(alignment: .trailing, spacing: FlynnSpacing.xxs) {
                            Text(FlynnFormatter.relativeDate(last))
                                .flynnType(FlynnTypography.bodyLarge)
                            Text("Last job")
                                .flynnType(FlynnTypography.caption)
                                .foregroundColor(FlynnColor.textTertiary)
                        }
                    }
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
            client = try await repository.fetch(id: clientId)
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
