import SwiftUI

enum ClientFormMode: Equatable {
    case create
    case edit(ClientDTO)

    var isEditing: Bool {
        if case .edit = self { return true }
        return false
    }

    var title: String {
        isEditing ? "Edit client" : "New client"
    }

    var submitTitle: String {
        isEditing ? "Save changes" : "Add client"
    }
}

/// Business-type options mirror `src/context/OnboardingContext.tsx` `businessTypes`.
enum ClientBusinessType: String, CaseIterable, Identifiable {
    case homeProperty = "home_property"
    case personalBeauty = "personal_beauty"
    case automotive = "automotive"
    case businessProfessional = "business_professional"
    case other = "other"

    var id: String { rawValue }
    var label: String {
        switch self {
        case .homeProperty: return "Home & Property"
        case .personalBeauty: return "Personal & Beauty"
        case .automotive: return "Automotive"
        case .businessProfessional: return "Business & Professional"
        case .other: return "Other"
        }
    }
}

enum ClientContactPreference: String, CaseIterable, Identifiable {
    case phone, text, email
    var id: String { rawValue }
    var label: String { rawValue.capitalized }
}

struct ClientFormView: View {
    let mode: ClientFormMode
    /// Called after a successful create/update, with the server DTO.
    var onSaved: (ClientDTO) -> Void = { _ in }

    @Environment(\.dismiss) private var dismiss
    @Environment(FlashStore.self) private var flash

    @State private var input: ClientInput
    @State private var isSubmitting = false
    @State private var errorMessage: String?

    @FocusState private var focusedField: Field?

    private let repository: ClientsRepositoryType = ClientsRepository()

    enum Field: Hashable {
        case name, phone, email, address, notes
    }

    init(mode: ClientFormMode, onSaved: @escaping (ClientDTO) -> Void = { _ in }) {
        self.mode = mode
        self.onSaved = onSaved
        switch mode {
        case .create:
            _input = State(initialValue: ClientInput(
                name: "", phone: nil, email: nil, address: nil,
                notes: nil, businessType: nil, preferredContactMethod: "phone"
            ))
        case .edit(let dto):
            _input = State(initialValue: ClientInput(from: dto))
        }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: FlynnSpacing.md) {
                    FlynnTextField(
                        label: "Name",
                        text: Binding(
                            get: { input.name },
                            set: { input.name = $0 }
                        ),
                        placeholder: "Client name",
                        textContentType: .name,
                        autocapitalization: .words,
                        submitLabel: .next,
                        isRequired: true,
                        onSubmit: { focusedField = .phone }
                    )
                    .focused($focusedField, equals: .name)

                    FlynnTextField(
                        label: "Phone",
                        text: bindingString(\.phone),
                        placeholder: "+1 (555) 123-4567",
                        keyboardType: .phonePad,
                        textContentType: .telephoneNumber,
                        autocapitalization: .never,
                        submitLabel: .next,
                        onSubmit: { focusedField = .email }
                    )
                    .focused($focusedField, equals: .phone)

                    FlynnTextField(
                        label: "Email",
                        text: bindingString(\.email),
                        placeholder: "client@example.com",
                        keyboardType: .emailAddress,
                        textContentType: .emailAddress,
                        autocapitalization: .never,
                        autocorrection: false,
                        submitLabel: .next,
                        onSubmit: { focusedField = .address }
                    )
                    .focused($focusedField, equals: .email)

                    FlynnTextField(
                        label: "Address",
                        text: bindingString(\.address),
                        placeholder: "Street, city, state",
                        textContentType: .fullStreetAddress,
                        submitLabel: .next,
                        onSubmit: { focusedField = .notes }
                    )
                    .focused($focusedField, equals: .address)

                    FlynnTextField(
                        label: "Notes",
                        text: bindingString(\.notes),
                        placeholder: "Preferences, reminders, context",
                        submitLabel: .done,
                        onSubmit: { focusedField = nil }
                    )
                    .focused($focusedField, equals: .notes)

                    businessTypePicker
                    contactPreferencePicker

                    if let errorMessage {
                        Text(errorMessage)
                            .flynnType(FlynnTypography.bodyMedium)
                            .foregroundColor(FlynnColor.error)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }

                    FlynnButton(
                        title: mode.submitTitle,
                        action: submit,
                        fullWidth: true,
                        isLoading: isSubmitting,
                        isDisabled: !isValid
                    )
                    .padding(.top, FlynnSpacing.sm)
                }
                .padding(FlynnSpacing.lg)
            }
            .scrollDismissesKeyboard(.interactively)
            .background(FlynnColor.background)
            .navigationTitle(mode.title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
    }

    private var businessTypePicker: some View {
        VStack(alignment: .leading, spacing: FlynnSpacing.xxs) {
            Text("Business type")
                .flynnType(FlynnTypography.label)
                .foregroundColor(FlynnColor.textPrimary)
            Picker("Business type", selection: Binding(
                get: { input.businessType ?? "" },
                set: { input.businessType = $0.isEmpty ? nil : $0 }
            )) {
                Text("Unspecified").tag("")
                ForEach(ClientBusinessType.allCases) { type in
                    Text(type.label).tag(type.rawValue)
                }
            }
            .pickerStyle(.menu)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, FlynnSpacing.sm)
            .frame(height: 48)
            .background(
                RoundedRectangle(cornerRadius: FlynnRadii.md, style: .continuous)
                    .fill(FlynnColor.backgroundSecondary)
            )
            .brutalistBorder(cornerRadius: FlynnRadii.md)
        }
    }

    private var contactPreferencePicker: some View {
        VStack(alignment: .leading, spacing: FlynnSpacing.xxs) {
            Text("Preferred contact")
                .flynnType(FlynnTypography.label)
                .foregroundColor(FlynnColor.textPrimary)
            Picker("Preferred contact", selection: Binding(
                get: { input.preferredContactMethod ?? "phone" },
                set: { input.preferredContactMethod = $0 }
            )) {
                ForEach(ClientContactPreference.allCases) { option in
                    Text(option.label).tag(option.rawValue)
                }
            }
            .pickerStyle(.segmented)
        }
    }

    private var isValid: Bool {
        !input.name.trimmingCharacters(in: .whitespaces).isEmpty
    }

    private func bindingString(_ keyPath: WritableKeyPath<ClientInput, String?>) -> Binding<String> {
        Binding(
            get: { input[keyPath: keyPath] ?? "" },
            set: { newValue in
                let trimmed = newValue.isEmpty ? nil : newValue
                input[keyPath: keyPath] = trimmed
            }
        )
    }

    private func submit() {
        guard isValid else { return }
        focusedField = nil
        errorMessage = nil
        isSubmitting = true
        Task {
            defer { isSubmitting = false }
            do {
                var payload = input
                payload.name = payload.name.trimmingCharacters(in: .whitespaces)
                let result: ClientDTO
                switch mode {
                case .create:
                    result = try await repository.insert(payload)
                    flash.success("Client added")
                case .edit(let existing):
                    result = try await repository.update(id: existing.id, payload)
                    flash.success("Client updated")
                }
                onSaved(result)
                dismiss()
            } catch {
                FlynnLog.network.error("Client save failed: \(error.localizedDescription, privacy: .public)")
                errorMessage = error.localizedDescription
                flash.error("Couldn't save client")
            }
        }
    }
}
