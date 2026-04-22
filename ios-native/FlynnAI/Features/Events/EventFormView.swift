import SwiftUI

enum EventFormMode: Equatable {
    case create
    case edit(EventDTO)

    var isEditing: Bool {
        if case .edit = self { return true }
        return false
    }

    var title: String {
        isEditing ? "Edit event" : "New event"
    }

    var submitTitle: String {
        isEditing ? "Save changes" : "Create event"
    }
}

struct EventFormView: View {
    let mode: EventFormMode
    var onSaved: (EventDTO) -> Void = { _ in }

    @Environment(\.dismiss) private var dismiss
    @Environment(FlashStore.self) private var flash

    @State private var input: EventInput
    @State private var selectedStatus: EventStatus
    @State private var selectedDate: Date
    @State private var hasDate: Bool
    @State private var selectedTime: Date
    @State private var hasTime: Bool
    @State private var isSubmitting = false
    @State private var errorMessage: String?

    @FocusState private var focusedField: Field?

    private let repository: EventsRepositoryType = EventsRepository()

    enum Field: Hashable {
        case clientName, serviceType, location, notes
    }

    init(mode: EventFormMode, onSaved: @escaping (EventDTO) -> Void = { _ in }) {
        self.mode = mode
        self.onSaved = onSaved

        switch mode {
        case .create:
            _input = State(initialValue: .newDraft)
            _selectedStatus = State(initialValue: .pending)
            _selectedDate = State(initialValue: Date())
            _hasDate = State(initialValue: false)
            _selectedTime = State(initialValue: Date())
            _hasTime = State(initialValue: false)
        case .edit(let dto):
            var seeded = EventInput(from: dto)
            _input = State(initialValue: seeded)
            _selectedStatus = State(initialValue: EventStatus(rawValue: seeded.status) ?? .pending)
            _selectedDate = State(initialValue: seeded.scheduledDate ?? Date())
            _hasDate = State(initialValue: seeded.scheduledDate != nil)
            _selectedTime = State(initialValue: Self.parseTime(seeded.scheduledTime) ?? Date())
            _hasTime = State(initialValue: seeded.scheduledTime != nil)
        }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: FlynnSpacing.md) {
                    FlynnTextField(
                        label: "Client name",
                        text: bindingString(\.clientName),
                        placeholder: "Jane Doe",
                        textContentType: .name,
                        autocapitalization: .words,
                        submitLabel: .next,
                        onSubmit: { focusedField = .serviceType }
                    )
                    .focused($focusedField, equals: .clientName)

                    FlynnTextField(
                        label: "Service",
                        text: bindingString(\.serviceType),
                        placeholder: "e.g. Roof repair",
                        autocapitalization: .sentences,
                        submitLabel: .next,
                        onSubmit: { focusedField = .location }
                    )
                    .focused($focusedField, equals: .serviceType)

                    FlynnTextField(
                        label: "Location",
                        text: bindingString(\.location),
                        placeholder: "Street, city",
                        textContentType: .fullStreetAddress,
                        submitLabel: .next,
                        onSubmit: { focusedField = .notes }
                    )
                    .focused($focusedField, equals: .location)

                    scheduleToggles

                    statusPicker

                    FlynnTextField(
                        label: "Notes",
                        text: bindingString(\.notes),
                        placeholder: "Details, special instructions",
                        submitLabel: .done,
                        onSubmit: { focusedField = nil }
                    )
                    .focused($focusedField, equals: .notes)

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

    // MARK: Subviews

    private var scheduleToggles: some View {
        VStack(spacing: FlynnSpacing.xs) {
            Toggle("Scheduled date", isOn: $hasDate.animation())
                .tint(FlynnColor.primary)
            if hasDate {
                DatePicker(
                    "",
                    selection: $selectedDate,
                    displayedComponents: .date
                )
                .labelsHidden()
                .datePickerStyle(.graphical)
            }

            Toggle("Scheduled time", isOn: $hasTime.animation())
                .tint(FlynnColor.primary)
            if hasTime {
                DatePicker(
                    "",
                    selection: $selectedTime,
                    displayedComponents: .hourAndMinute
                )
                .labelsHidden()
                .datePickerStyle(.wheel)
                .frame(maxHeight: 120)
            }
        }
        .padding(FlynnSpacing.md)
        .background(
            RoundedRectangle(cornerRadius: FlynnRadii.md, style: .continuous)
                .fill(FlynnColor.backgroundSecondary)
        )
        .brutalistBorder(cornerRadius: FlynnRadii.md)
    }

    private var statusPicker: some View {
        VStack(alignment: .leading, spacing: FlynnSpacing.xxs) {
            Text("Status")
                .flynnType(FlynnTypography.label)
                .foregroundColor(FlynnColor.textPrimary)
            Picker("Status", selection: $selectedStatus) {
                ForEach(EventStatus.allCases) { status in
                    Text(status.label).tag(status)
                }
            }
            .pickerStyle(.segmented)
        }
    }

    // MARK: Helpers

    private var isValid: Bool {
        !(input.clientName?.trimmingCharacters(in: .whitespaces).isEmpty ?? true) ||
        !(input.serviceType?.trimmingCharacters(in: .whitespaces).isEmpty ?? true)
    }

    private func bindingString(_ keyPath: WritableKeyPath<EventInput, String?>) -> Binding<String> {
        Binding(
            get: { input[keyPath: keyPath] ?? "" },
            set: { newValue in
                input[keyPath: keyPath] = newValue.isEmpty ? nil : newValue
            }
        )
    }

    private static func parseTime(_ raw: String?) -> Date? {
        guard let raw else { return nil }
        let formatter = DateFormatter()
        formatter.dateFormat = "HH:mm:ss"
        if let d = formatter.date(from: raw) { return d }
        formatter.dateFormat = "HH:mm"
        return formatter.date(from: raw)
    }

    private static func formatTime(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "HH:mm:ss"
        return formatter.string(from: date)
    }

    private func submit() {
        guard isValid else { return }
        focusedField = nil
        errorMessage = nil
        isSubmitting = true

        var payload = input
        payload.status = selectedStatus.rawValue
        payload.scheduledDate = hasDate ? selectedDate : nil
        payload.scheduledTime = hasTime ? Self.formatTime(selectedTime) : nil

        Task {
            defer { isSubmitting = false }
            do {
                let result: EventDTO
                switch mode {
                case .create:
                    result = try await repository.insert(payload)
                    flash.success("Event created")
                case .edit(let existing):
                    result = try await repository.update(id: existing.id, payload)
                    flash.success("Event updated")
                }
                onSaved(result)
                dismiss()
            } catch {
                FlynnLog.network.error("Event save failed: \(error.localizedDescription, privacy: .public)")
                errorMessage = error.localizedDescription
                flash.error("Couldn't save event")
            }
        }
    }
}
