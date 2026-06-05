import SwiftUI

/// Quick sheet to add a reply in the user's voice (feeds tone samples). Shared by
/// Home and the Voice tab.
struct AddReplySheet: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(FlashStore.self) private var flash
    @State private var text = ""
    @State private var saving = false
    let onSaved: () -> Void

    private struct ToneSampleInsert: Encodable { let sample_text: String; let source: String }

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: FlynnSpacing.md) {
                Text("Add a reply you'd really send a customer. Flynn uses it to sound more like you.")
                    .flynnType(FlynnTypography.bodyMedium)
                    .foregroundColor(FlynnColor.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
                FlynnTextField(label: "Your reply", text: $text, placeholder: "e.g. yeah no worries, can swing by tomoz arvo", autocapitalization: .sentences)
                FlynnButton(title: "Save", action: save, fullWidth: true, isLoading: saving,
                            isDisabled: text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                Spacer()
            }
            .padding(FlynnSpacing.lg)
            .background(FlynnColor.background)
            .navigationTitle("Add a reply")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .topBarLeading) { Button("Cancel") { dismiss() } } }
        }
    }

    private func save() {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        saving = true
        Task {
            try? await FlynnSupabase.client
                .from("tone_samples")
                .insert(ToneSampleInsert(sample_text: trimmed, source: "onboarding"))
                .execute()
            saving = false
            flash.success("Saved — Flynn will sound more like you")
            onSaved()
            dismiss()
        }
    }
}
