import SwiftUI

/// Editor for the caller's single `business_profiles` row. Phase 1 scope covers
/// the fields Mode A (SMS Link Follow-Up) needs. JSONB builders for services,
/// business hours, and FAQs are deferred to a later phase.
struct BusinessProfileEditorView: View {
    @Environment(FlashStore.self) private var flash
    @Environment(\.dismiss) private var dismiss
    @State private var store = BusinessProfileEditorStore()
    @State private var errorMessage: String?

    @FocusState private var focusedField: Field?

    enum Field: Hashable {
        case businessName, industry, websiteUrl, bookingLink, quoteLink,
             bookingTemplate, quoteTemplate, aiInstructions
    }

    var body: some View {
        ScrollView {
            VStack(spacing: FlynnSpacing.md) {
                switch store.loadState {
                case .idle, .loading:
                    ProgressView()
                        .frame(maxWidth: .infinity, minHeight: 160)
                case .error(let message):
                    errorState(message)
                case .loaded:
                    form
                }
            }
            .padding(FlynnSpacing.lg)
        }
        .scrollDismissesKeyboard(.interactively)
        .background(FlynnColor.background)
        .navigationTitle("Business profile")
        .navigationBarTitleDisplayMode(.large)
        .task { await store.load() }
    }

    private func errorState(_ message: String) -> some View {
        VStack(spacing: FlynnSpacing.sm) {
            Text("Couldn't load your profile")
                .flynnType(FlynnTypography.h4)
                .foregroundColor(FlynnColor.textPrimary)
            Text(message)
                .flynnType(FlynnTypography.bodyMedium)
                .foregroundColor(FlynnColor.textSecondary)
                .multilineTextAlignment(.center)
            FlynnButton(title: "Retry", action: { Task { await store.load() } })
        }
        .padding(FlynnSpacing.md)
    }

    @ViewBuilder
    private var form: some View {
        basicsSection
        smsLinksSection
        aiSection

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

    // MARK: Sections

    private var basicsSection: some View {
        SectionBox(title: "Basics") {
            FlynnTextField(
                label: "Business name",
                text: bindingString(\.businessName),
                placeholder: "Flynn's Plumbing",
                autocapitalization: .words,
                submitLabel: .next,
                onSubmit: { focusedField = .industry }
            )
            .focused($focusedField, equals: .businessName)

            FlynnTextField(
                label: "Industry",
                text: bindingString(\.industry),
                placeholder: "Plumbing, electrical, beauty…",
                autocapitalization: .sentences,
                submitLabel: .next,
                onSubmit: { focusedField = .websiteUrl }
            )
            .focused($focusedField, equals: .industry)

            FlynnTextField(
                label: "Website",
                text: bindingString(\.websiteUrl),
                placeholder: "https://example.com.au",
                textContentType: .URL,
                autocapitalization: .never,
                submitLabel: .next,
                onSubmit: { focusedField = .bookingLink }
            )
            .focused($focusedField, equals: .websiteUrl)
        }
    }

    private var smsLinksSection: some View {
        SectionBox(title: "SMS link follow-up") {
            Toggle("Send booking link", isOn: $store.input.bookingLinkEnabled)
                .tint(FlynnColor.primary)

            FlynnTextField(
                label: "Booking link URL",
                text: bindingString(\.bookingLinkUrl),
                placeholder: "https://flynnbooking.com/your-slug",
                textContentType: .URL,
                autocapitalization: .never,
                submitLabel: .next,
                onSubmit: { focusedField = .bookingTemplate }
            )
            .focused($focusedField, equals: .bookingLink)

            FlynnTextField(
                label: "Booking SMS template",
                text: bindingString(\.smsBookingTemplate),
                placeholder: "Hi, this is {business_name}. Book here: {link}",
                submitLabel: .next,
                onSubmit: { focusedField = .quoteLink }
            )
            .focused($focusedField, equals: .bookingTemplate)

            Divider().padding(.vertical, FlynnSpacing.xs)

            Toggle("Send quote link", isOn: $store.input.quoteLinkEnabled)
                .tint(FlynnColor.primary)

            FlynnTextField(
                label: "Quote link URL",
                text: bindingString(\.quoteLinkUrl),
                placeholder: "https://flynnai.app/quote/your-slug",
                textContentType: .URL,
                autocapitalization: .never,
                submitLabel: .next,
                onSubmit: { focusedField = .quoteTemplate }
            )
            .focused($focusedField, equals: .quoteLink)

            FlynnTextField(
                label: "Quote SMS template",
                text: bindingString(\.smsQuoteTemplate),
                placeholder: "Hi, this is {business_name}. Share details: {link}",
                submitLabel: .next,
                onSubmit: { focusedField = .aiInstructions }
            )
            .focused($focusedField, equals: .quoteTemplate)
        }
    }

    private var aiSection: some View {
        SectionBox(title: "AI receptionist (optional)") {
            FlynnTextField(
                label: "AI greeting",
                text: Binding(
                    get: { store.input.aiGreetingText ?? "" },
                    set: { store.input.aiGreetingText = $0.isEmpty ? nil : $0 }
                ),
                placeholder: "Hi, thanks for calling Flynn's Plumbing…"
            )

            FlynnTextField(
                label: "AI instructions",
                text: Binding(
                    get: { store.input.aiInstructions ?? "" },
                    set: { store.input.aiInstructions = $0.isEmpty ? nil : $0 }
                ),
                placeholder: "Tone, do's and don'ts, escalation rules"
            )
            .focused($focusedField, equals: .aiInstructions)
        }
    }

    // MARK: Binding helpers

    private func bindingString(_ keyPath: WritableKeyPath<BusinessProfileInput, String?>) -> Binding<String> {
        Binding(
            get: { store.input[keyPath: keyPath] ?? "" },
            set: { newValue in
                store.input[keyPath: keyPath] = newValue.isEmpty ? nil : newValue
            }
        )
    }

    // MARK: Actions

    private func submit() {
        focusedField = nil
        errorMessage = nil
        Task {
            do {
                _ = try await store.save()
                flash.success("Business profile saved")
                dismiss()
            } catch {
                FlynnLog.network.error("BusinessProfile save failed: \(error.localizedDescription, privacy: .public)")
                errorMessage = error.localizedDescription
                flash.error("Couldn't save profile")
            }
        }
    }
}

/// Simple titled container with brutalist border, matching the editor aesthetic.
private struct SectionBox<Content: View>: View {
    let title: String
    @ViewBuilder let content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: FlynnSpacing.sm) {
            Text(title)
                .flynnType(FlynnTypography.h4)
                .foregroundColor(FlynnColor.textPrimary)
            VStack(spacing: FlynnSpacing.sm) {
                content
            }
            .padding(FlynnSpacing.md)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: FlynnRadii.md, style: .continuous)
                    .fill(FlynnColor.backgroundSecondary)
            )
            .brutalistBorder(cornerRadius: FlynnRadii.md)
        }
    }
}
