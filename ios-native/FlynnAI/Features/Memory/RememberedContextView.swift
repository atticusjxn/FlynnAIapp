import SwiftUI

/// "What Flynn remembers" — the per-customer facts Flynn weaves into future drafts.
/// Passively-found facts wait under "To review" until the owner keeps them; only
/// kept facts are ever used (human-in-the-loop).
struct RememberedContextView: View {
    @Environment(FlashStore.self) private var flash
    @State private var store = MemoryStore()
    @State private var showingAdd = false

    var body: some View {
        List {
            if !store.toReview.isEmpty {
                Section {
                    ForEach(store.toReview) { fact in
                        VStack(alignment: .leading, spacing: FlynnSpacing.xs) {
                            Text(fact.fact)
                                .flynnType(FlynnTypography.bodyMedium)
                                .foregroundColor(FlynnColor.textPrimary)
                            if fact.subjectLabel?.isEmpty == false {
                                Text(fact.subjectTitle)
                                    .flynnType(FlynnTypography.caption)
                                    .foregroundColor(FlynnColor.textSecondary)
                            }
                            HStack(spacing: FlynnSpacing.sm) {
                                Button("Keep") { Task { await store.keep(fact) } }
                                    .buttonStyle(.borderedProminent)
                                Button("Discard") { Task { await store.discard(fact) } }
                                    .buttonStyle(.bordered)
                            }
                            .font(.subheadline)
                            .padding(.top, 2)
                        }
                        .padding(.vertical, 2)
                    }
                } header: {
                    Text("To review")
                } footer: {
                    Text("Flynn spotted these in your conversations. Keep the useful ones.")
                }
            }

            ForEach(store.rememberedBySubject, id: \.subject) { group in
                Section(group.subject) {
                    ForEach(group.facts) { fact in
                        Text(fact.fact)
                            .flynnType(FlynnTypography.bodyMedium)
                            .foregroundColor(FlynnColor.textPrimary)
                            .swipeActions {
                                Button(role: .destructive) { Task { await store.delete(fact) } } label: {
                                    Label("Delete", systemImage: "trash")
                                }
                            }
                    }
                }
            }

            if store.facts.isEmpty && !store.isLoading {
                Section {
                    Text("Nothing yet. Flynn learns as you reply to customers — or tell it something with the mic (\u{201C}note that Dave\u{2019}s gate code is 4821\u{201D}).")
                        .flynnType(FlynnTypography.bodyMedium)
                        .foregroundColor(FlynnColor.textSecondary)
                }
            }
        }
        .navigationTitle("What Flynn remembers")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button { showingAdd = true } label: { Image(systemName: "plus") }
            }
        }
        .overlay { if store.isLoading && store.facts.isEmpty { ProgressView() } }
        .sheet(isPresented: $showingAdd) {
            AddMemoryFactView { fact, subject in
                Task {
                    await store.add(fact: fact, subject: subject)
                    flash.show("Flynn will remember that.", kind: .success)
                }
            }
        }
        .task { await store.load() }
        .onChange(of: store.errorMessage) { _, message in
            if let message { flash.show(message, kind: .error); store.errorMessage = nil }
        }
    }
}

/// Small sheet to add a fact by hand.
private struct AddMemoryFactView: View {
    @Environment(\.dismiss) private var dismiss
    let onSave: (_ fact: String, _ subject: String?) -> Void
    @State private var fact = ""
    @State private var subject = ""

    var body: some View {
        NavigationStack {
            Form {
                Section("What should Flynn remember?") {
                    TextField("e.g. Gate code is 4821", text: $fact, axis: .vertical).lineLimit(1...4)
                }
                Section("About who / where (optional)") {
                    TextField("e.g. Dave / 12 Oak St", text: $subject)
                }
            }
            .navigationTitle("Add a note")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Save") {
                        onSave(fact, subject.isEmpty ? nil : subject)
                        dismiss()
                    }
                    .disabled(fact.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
        }
    }
}
