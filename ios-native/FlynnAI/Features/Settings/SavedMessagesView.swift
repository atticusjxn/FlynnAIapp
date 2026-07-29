import SwiftUI

/// Manage the canned "quick messages" the Flynn keyboard offers for one-tap insert.
/// Stored in the App Group via `SharedStore.savedMessages`, so edits show up in the
/// keyboard's "Saved" list immediately. Handy for an away/holiday reply, standard
/// availability, a booking link, deposit terms — anything you type often.
struct SavedMessagesView: View {
    @State private var messages: [SavedMessage] = []
    @State private var editing: SavedMessage?
    @State private var isAdding = false

    var body: some View {
        List {
            Section {
                ForEach(messages) { message in
                    Button {
                        editing = message
                    } label: {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(message.title.isEmpty ? "Untitled" : message.title)
                                .flynnType(FlynnTypography.h4)
                                .foregroundColor(FlynnColor.textPrimary)
                            Text(message.body)
                                .flynnType(FlynnTypography.bodySmall)
                                .foregroundColor(FlynnColor.textSecondary)
                                .lineLimit(2)
                        }
                        .padding(.vertical, 2)
                    }
                }
                .onDelete { offsets in
                    messages.remove(atOffsets: offsets)
                    persist()
                }
                .onMove { from, to in
                    messages.move(fromOffsets: from, toOffset: to)
                    persist()
                }
            } footer: {
                Text("Open the Flynn keyboard, tap \u{201C}Saved\u{201D}, then tap a message to drop it straight into any chat.")
            }

            Section {
                Button {
                    isAdding = true
                } label: {
                    Label("Add a message", systemImage: "plus.circle.fill")
                        .foregroundStyle(FlynnColor.primary)
                }
            }
        }
        .listStyle(.insetGrouped)
        .flynnListSurface()
        .navigationTitle("Quick messages")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar { ToolbarItem(placement: .topBarTrailing) { EditButton() } }
        .onAppear { messages = SharedStore.savedMessages }
        .sheet(isPresented: $isAdding) {
            SavedMessageEditor(message: SavedMessage(title: "", body: "")) { saved in
                messages.append(saved)
                persist()
            }
        }
        .sheet(item: $editing) { message in
            SavedMessageEditor(message: message) { saved in
                if let i = messages.firstIndex(where: { $0.id == saved.id }) {
                    messages[i] = saved
                } else {
                    messages.append(saved)
                }
                persist()
            }
        }
    }

    private func persist() {
        SharedStore.savedMessages = messages
    }
}

/// Add/edit a single saved message. Title is a short label shown on the keyboard
/// card; body is the text inserted on tap.
private struct SavedMessageEditor: View {
    @Environment(\.dismiss) private var dismiss
    @State private var title: String
    @State private var messageBody: String
    let id: UUID
    let onSave: (SavedMessage) -> Void

    init(message: SavedMessage, onSave: @escaping (SavedMessage) -> Void) {
        self.id = message.id
        self._title = State(initialValue: message.title)
        self._messageBody = State(initialValue: message.body)
        self.onSave = onSave
    }

    private var canSave: Bool {
        !messageBody.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    var body: some View {
        NavigationStack {
            Form {
                Section(header: FlynnSectionHeader("Label")) {
                    TextField("e.g. Away, Availability, Book me in", text: $title)
                }
                Section(header: FlynnSectionHeader("Message")) {
                    TextField("What gets inserted", text: $messageBody, axis: .vertical)
                        .lineLimit(4...12)
                }
            }
            .flynnListSurface()
            .navigationTitle("Quick message")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        let cleanTitle = title.trimmingCharacters(in: .whitespacesAndNewlines)
                        onSave(SavedMessage(
                            id: id,
                            title: cleanTitle,
                            body: messageBody.trimmingCharacters(in: .whitespacesAndNewlines)
                        ))
                        dismiss()
                    }
                    .disabled(!canSave)
                }
            }
        }
    }
}
