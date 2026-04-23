import SwiftUI

@MainActor
@Observable
final class IVRScriptEditorStore {
    enum LoadState: Equatable { case idle, loading, loaded, error(String) }

    private(set) var loadState: LoadState = .idle
    private(set) var isSaving: Bool = false
    private(set) var templates: [IvrTemplateDTO] = []
    var input: BusinessProfileInput = .empty

    private let profileRepo: BusinessProfileRepositoryType
    private let templateRepo: IvrTemplatesRepositoryType

    init(
        profileRepo: BusinessProfileRepositoryType = BusinessProfileRepository(),
        templateRepo: IvrTemplatesRepositoryType = IvrTemplatesRepository()
    ) {
        self.profileRepo = profileRepo
        self.templateRepo = templateRepo
    }

    var selectedTemplate: IvrTemplateDTO? {
        guard let id = input.ivrTemplateId else { return nil }
        return templates.first { $0.id == id }
    }

    func load() async {
        loadState = .loading
        do {
            async let profileTask = profileRepo.fetch()
            async let templatesTask = templateRepo.list(locale: "en-AU", industry: nil)
            let (profile, templates) = try await (profileTask, templatesTask)
            if let profile { input = BusinessProfileInput(from: profile) }
            self.templates = templates
            loadState = .loaded
        } catch {
            loadState = .error(error.localizedDescription)
        }
    }

    func selectTemplate(_ template: IvrTemplateDTO) {
        input.ivrTemplateId = template.id
        // Wipe custom override when picking a fresh template — the preview will render
        // straight from `script_body`.
        input.ivrCustomScript = nil
    }

    func forkToCustom() {
        guard let template = selectedTemplate else { return }
        input.ivrCustomScript = template.scriptBody
    }

    func clearCustom() {
        input.ivrCustomScript = nil
    }

    func save() async throws {
        isSaving = true
        defer { isSaving = false }
        _ = try await profileRepo.upsert(input)
    }
}

struct IVRScriptEditorView: View {
    @Environment(FlashStore.self) private var flash
    @Environment(\.dismiss) private var dismiss
    @State private var store = IVRScriptEditorStore()
    @State private var errorMessage: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: FlynnSpacing.md) {
                switch store.loadState {
                case .idle, .loading:
                    ProgressView()
                        .frame(maxWidth: .infinity, minHeight: 200)
                case .error(let message):
                    errorState(message)
                case .loaded:
                    content
                }
            }
            .padding(FlynnSpacing.lg)
        }
        .scrollDismissesKeyboard(.interactively)
        .background(FlynnColor.background)
        .navigationTitle("IVR script")
        .navigationBarTitleDisplayMode(.large)
        .task { await store.load() }
    }

    @ViewBuilder
    private var content: some View {
        header
        templatesSection
        scriptSection
        previewSection

        if let errorMessage {
            Text(errorMessage)
                .flynnType(FlynnTypography.bodyMedium)
                .foregroundColor(FlynnColor.error)
                .frame(maxWidth: .infinity, alignment: .leading)
        }

        FlynnButton(
            title: "Save",
            action: submit,
            fullWidth: true,
            isLoading: store.isSaving
        )
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: FlynnSpacing.xs) {
            Text("What Flynn says when it answers")
                .flynnType(FlynnTypography.h3)
                .foregroundColor(FlynnColor.textPrimary)
            Text("Pick a template or write your own. Placeholders like `{business_name}` get filled in at call time.")
                .flynnType(FlynnTypography.bodyMedium)
                .foregroundColor(FlynnColor.textSecondary)
        }
    }

    private var templatesSection: some View {
        VStack(alignment: .leading, spacing: FlynnSpacing.sm) {
            Text("Templates")
                .flynnType(FlynnTypography.h4)
                .foregroundColor(FlynnColor.textPrimary)

            if store.templates.isEmpty {
                Text("No templates available yet.")
                    .flynnType(FlynnTypography.bodyMedium)
                    .foregroundColor(FlynnColor.textTertiary)
            } else {
                ForEach(store.templates) { template in
                    templateRow(template)
                }
            }
        }
    }

    private func templateRow(_ template: IvrTemplateDTO) -> some View {
        let isSelected = store.input.ivrTemplateId == template.id
        return Button(action: { store.selectTemplate(template) }) {
            HStack(alignment: .top, spacing: FlynnSpacing.sm) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(template.name)
                        .flynnType(FlynnTypography.label)
                        .foregroundColor(FlynnColor.textPrimary)
                    HStack(spacing: FlynnSpacing.xs) {
                        if let industry = template.industry {
                            FlynnBadge(label: industry.capitalized, variant: .neutral)
                        }
                        if let tone = template.tone {
                            FlynnBadge(label: tone.capitalized, variant: .primary)
                        }
                    }
                }
                Spacer()
                if isSelected {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundColor(FlynnColor.primary)
                }
            }
            .padding(FlynnSpacing.md)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: FlynnRadii.md, style: .continuous)
                    .fill(isSelected ? FlynnColor.primaryLight : FlynnColor.backgroundSecondary)
            )
            .brutalistBorder(
                cornerRadius: FlynnRadii.md,
                color: isSelected ? FlynnColor.primary : FlynnColor.border,
                lineWidth: isSelected ? 3 : 2
            )
        }
        .buttonStyle(.plain)
    }

    private var scriptSection: some View {
        VStack(alignment: .leading, spacing: FlynnSpacing.sm) {
            HStack {
                Text("Custom script")
                    .flynnType(FlynnTypography.h4)
                    .foregroundColor(FlynnColor.textPrimary)
                Spacer()
                if store.selectedTemplate != nil, store.input.ivrCustomScript == nil {
                    Button("Fork template") { store.forkToCustom() }
                        .flynnType(FlynnTypography.caption)
                        .foregroundColor(FlynnColor.primary)
                } else if store.input.ivrCustomScript != nil {
                    Button("Use template instead") { store.clearCustom() }
                        .flynnType(FlynnTypography.caption)
                        .foregroundColor(FlynnColor.primary)
                }
            }

            TextEditor(text: Binding(
                get: { store.input.ivrCustomScript ?? "" },
                set: { store.input.ivrCustomScript = $0.isEmpty ? nil : $0 }
            ))
            .frame(minHeight: 140)
            .padding(FlynnSpacing.sm)
            .background(
                RoundedRectangle(cornerRadius: FlynnRadii.md, style: .continuous)
                    .fill(FlynnColor.backgroundSecondary)
            )
            .brutalistBorder(cornerRadius: FlynnRadii.md)

            Text("Placeholders: {business_name}, {booking_option}, {quote_option}")
                .flynnType(FlynnTypography.caption)
                .foregroundColor(FlynnColor.textTertiary)
        }
    }

    private var previewSection: some View {
        let scriptBody: String = store.input.ivrCustomScript
            ?? store.selectedTemplate?.scriptBody
            ?? ""

        let rendered = scriptBody
            .replacingOccurrences(of: "{business_name}", with: store.input.businessName ?? "your business")
            .replacingOccurrences(of: "{booking_option}", with: store.input.bookingLinkEnabled ? " Press 1 for a booking link." : "")
            .replacingOccurrences(of: "{quote_option}", with: store.input.quoteLinkEnabled ? " Press 2 for a quote form." : "")

        return VStack(alignment: .leading, spacing: FlynnSpacing.sm) {
            Text("Preview")
                .flynnType(FlynnTypography.h4)
                .foregroundColor(FlynnColor.textPrimary)

            Text(rendered.isEmpty ? "Pick a template or write a script to preview." : rendered)
                .flynnType(FlynnTypography.bodyMedium)
                .foregroundColor(rendered.isEmpty ? FlynnColor.textTertiary : FlynnColor.textPrimary)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(FlynnSpacing.md)
                .background(
                    RoundedRectangle(cornerRadius: FlynnRadii.md, style: .continuous)
                        .fill(FlynnColor.backgroundSecondary)
                )
                .brutalistBorder(cornerRadius: FlynnRadii.md)
        }
    }

    private func errorState(_ message: String) -> some View {
        VStack(spacing: FlynnSpacing.sm) {
            Text("Couldn't load IVR settings")
                .flynnType(FlynnTypography.h4)
            Text(message)
                .flynnType(FlynnTypography.bodyMedium)
                .foregroundColor(FlynnColor.textSecondary)
            FlynnButton(title: "Retry", action: { Task { await store.load() } })
        }
    }

    private func submit() {
        errorMessage = nil
        Task {
            do {
                try await store.save()
                flash.success("IVR script saved")
                dismiss()
            } catch {
                errorMessage = error.localizedDescription
                flash.error("Couldn't save script")
                FlynnLog.network.error("IVRScript save failed: \(error.localizedDescription, privacy: .public)")
            }
        }
    }
}
