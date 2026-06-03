import SwiftUI

struct SelectedClient: Equatable {
    var id: UUID?
    var name: String
    var phone: String
}

/// Sheet that lets the user either search existing clients or type name/phone inline.
struct ClientPickerSheet: View {
    @Binding var selected: SelectedClient?
    @Environment(\.dismiss) private var dismiss
    @Environment(FlashStore.self) private var flash

    @State private var query = ""
    @State private var clients: [ClientDTO] = []
    @State private var isLoading = false
    @State private var manualMode = false
    @State private var manualName = ""
    @State private var manualPhone = ""

    private let repo = ClientsRepository()

    var body: some View {
        NavigationStack {
            Group {
                if manualMode {
                    manualForm
                } else {
                    pickerList
                }
            }
            .navigationTitle("Select Client")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    if manualMode {
                        Button("Use") {
                            selected = SelectedClient(id: nil, name: manualName.trimmingCharacters(in: .whitespaces), phone: manualPhone.trimmingCharacters(in: .whitespaces))
                            dismiss()
                        }
                        .disabled(manualName.trimmingCharacters(in: .whitespaces).isEmpty)
                        .fontWeight(.semibold)
                    }
                }
            }
            .task { await loadClients() }
        }
    }

    // MARK: – Picker list

    private var pickerList: some View {
        VStack(spacing: 0) {
            HStack(spacing: FlynnSpacing.sm) {
                Image(systemName: "magnifyingglass").foregroundColor(FlynnColor.textTertiary)
                TextField("Search clients…", text: $query)
                    .textContentType(.name)
            }
            .padding(FlynnSpacing.sm)
            .background(FlynnColor.backgroundSecondary)
            .cornerRadius(FlynnRadii.sm)
            .padding(FlynnSpacing.md)

            if isLoading {
                ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                List {
                    ForEach(filteredClients) { client in
                        Button(action: {
                            selected = SelectedClient(id: client.id, name: client.name, phone: client.phone ?? "")
                            dismiss()
                        }) {
                            HStack {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(client.name)
                                        .flynnType(FlynnTypography.bodyMedium)
                                        .foregroundColor(FlynnColor.textPrimary)
                                    if let phone = client.phone, !phone.isEmpty {
                                        Text(phone)
                                            .flynnType(FlynnTypography.caption)
                                            .foregroundColor(FlynnColor.textTertiary)
                                    }
                                }
                                Spacer()
                                if selected?.id == client.id {
                                    Image(systemName: "checkmark").foregroundColor(FlynnColor.primary)
                                }
                            }
                        }
                        .buttonStyle(.plain)
                    }

                    Button(action: { manualMode = true }) {
                        Label("Enter manually", systemImage: "pencil")
                            .flynnType(FlynnTypography.bodyMedium)
                            .foregroundColor(FlynnColor.primary)
                    }
                }
                .listStyle(.insetGrouped)
            }
        }
        .background(FlynnColor.background)
    }

    private var filteredClients: [ClientDTO] {
        guard !query.isEmpty else { return clients }
        let q = query.lowercased()
        return clients.filter { $0.name.lowercased().contains(q) || ($0.phone ?? "").contains(q) }
    }

    // MARK: – Manual entry

    private var manualForm: some View {
        Form {
            Section("Client details") {
                TextField("Full name", text: $manualName)
                    .textContentType(.name)
                TextField("Mobile number", text: $manualPhone)
                    .textContentType(.telephoneNumber)
                    .keyboardType(.phonePad)
            }
            Section {
                Button("Choose from Clients instead") { manualMode = false }
                    .foregroundColor(FlynnColor.primary)
            }
        }
    }

    private func loadClients() async {
        isLoading = true
        defer { isLoading = false }
        do { clients = try await repo.list() } catch { clients = [] }
    }
}
