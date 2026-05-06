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

        // Templates are the only hard dependency — if the user has never upserted
        // a business_profiles row, profileRepo.fetch() either returns nil or throws
        // a DecodingError on a half-populated row. Either way, fall through to an
        // empty input rather than hard-erroring — the user can still pick a template.
        do {
            self.templates = try await templateRepo.list(industry: nil)
        } catch {
            loadState = .error(error.localizedDescription)
            return
        }

        do {
            if let profile = try await profileRepo.fetch() {
                input = BusinessProfileInput(from: profile)
            } else {
                input = .empty
            }
        } catch {
            FlynnLog.network.error(
                "IVRScript profile fetch failed (falling back to empty input): \(error.localizedDescription, privacy: .public)"
            )
            input = .empty
        }

        loadState = .loaded
    }

    func selectTemplate(_ template: IvrTemplateDTO) {
        input.ivrTemplateId = template.id
        input.ivrCustomScript = template.scriptBody
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
        .navigationTitle("Call greeting")
        .navigationBarTitleDisplayMode(.large)
        .task { await store.load() }
    }

    @ViewBuilder
    private var content: some View {
        header
        templatesSection
        editSection

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
            Text("What callers hear when Flynn answers")
                .flynnType(FlynnTypography.h3)
                .foregroundColor(FlynnColor.textPrimary)
            Text("Pick a template or write your own. Placeholders like {business_name} get filled in automatically.")
                .flynnType(FlynnTypography.bodyMedium)
                .foregroundColor(FlynnColor.textSecondary)
        }
    }

    private var templatesSection: some View {
        VStack(alignment: .leading, spacing: FlynnSpacing.sm) {
            Text("Greeting templates")
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

    private var editSection: some View {
        VStack(alignment: .leading, spacing: FlynnSpacing.xs) {
            Text("Edit greeting")
                .flynnType(FlynnTypography.h4)
                .foregroundColor(FlynnColor.textPrimary)

            TextEditor(text: Binding(
                get: { store.input.ivrCustomScript ?? "" },
                set: { store.input.ivrCustomScript = $0.isEmpty ? nil : $0 }
            ))
            .flynnType(FlynnTypography.bodyMedium)
            .frame(minHeight: 120)
            .padding(FlynnSpacing.sm)
            .background(
                RoundedRectangle(cornerRadius: FlynnRadii.md, style: .continuous)
                    .fill(FlynnColor.backgroundSecondary)
            )
            .brutalistBorder(cornerRadius: FlynnRadii.md)

            Text("{business_name} · {booking_option} · {quote_option}")
                .flynnType(FlynnTypography.caption)
                .foregroundColor(FlynnColor.textTertiary)
        }
    }

    private func errorState(_ message: String) -> some View {
        VStack(spacing: FlynnSpacing.sm) {
            Text("Couldn't load greeting templates")
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
                flash.success("Greeting saved")
                dismiss()
            } catch {
                errorMessage = error.localizedDescription
                flash.error("Couldn't save greeting")
                FlynnLog.network.error("Greeting save failed: \(error.localizedDescription, privacy: .public)")
            }
        }
    }
}
