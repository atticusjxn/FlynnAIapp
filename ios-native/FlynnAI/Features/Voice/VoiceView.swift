import SwiftUI
import UIKit

/// Voice tab — manage the tone samples that make Flynn's drafts sound like you,
/// and preview your current voice.
struct VoiceView: View {
    @State private var store = VoiceStore()
    @State private var showingAdd = false
    @State private var editing: ToneSampleDTO?
    @State private var preview: PreviewState = .idle

    enum PreviewState: Equatable { case idle, loading, ready(String), failed }

    private let previewCustomerMessage = "Hi, are you free this week and how much would it cost?"

    var body: some View {
        List {
            Section {
                previewCard
            } header: {
                Text("Preview my voice")
            } footer: {
                Text("Flynn drafts a reply to a sample customer text using your current voice.")
            }

            if !store.written.isEmpty {
                Section("Your examples") {
                    ForEach(store.written) { sampleRow($0) }
                }
            }
            if !store.learned.isEmpty {
                Section("Learned from your replies") {
                    ForEach(store.learned) { sampleRow($0) }
                }
            }
            if store.state == .loaded && store.samples.isEmpty {
                Section {
                    HStack(spacing: FlynnSpacing.md) {
                        Mascot(.peek, size: 72)
                        Text("Add a few replies so Flynn sounds like you.")
                            .flynnType(FlynnTypography.bodyMedium)
                            .foregroundColor(FlynnColor.textSecondary)
                    }
                    .padding(.vertical, FlynnSpacing.xs)
                }
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle("Voice")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button { showingAdd = true } label: { Image(systemName: "plus") }
            }
        }
        .sheet(isPresented: $showingAdd) {
            AddReplySheet { Task { await store.load() } }
        }
        .sheet(item: $editing) { sample in
            EditSampleSheet(initial: sample.sampleText) { newText in
                Task { await store.update(sample.id, text: newText) }
            }
        }
        .task { await store.load() }
        .refreshable { await store.load() }
    }

    private var previewCard: some View {
        VStack(alignment: .leading, spacing: FlynnSpacing.sm) {
            Text(previewCustomerMessage)
                .flynnType(FlynnTypography.bodySmall)
                .foregroundColor(FlynnColor.textSecondary)
            switch preview {
            case .idle:
                Button("Preview my voice") { runPreview() }
                    .flynnType(FlynnTypography.button)
                    .foregroundColor(FlynnColor.primary)
            case .loading:
                HStack(spacing: FlynnSpacing.sm) { ProgressView(); Text("Drafting…").foregroundColor(FlynnColor.textSecondary) }
            case .ready(let draft):
                Text(draft)
                    .flynnType(FlynnTypography.bodyMedium)
                    .foregroundColor(FlynnColor.textPrimary)
                    .fixedSize(horizontal: false, vertical: true)
                Button("Try again") { runPreview() }
                    .flynnType(FlynnTypography.caption)
                    .foregroundColor(FlynnColor.primary)
            case .failed:
                Text("Couldn't draft just now.").foregroundColor(FlynnColor.textSecondary)
                Button("Retry") { runPreview() }
                    .flynnType(FlynnTypography.caption)
                    .foregroundColor(FlynnColor.primary)
            }
        }
        .padding(.vertical, FlynnSpacing.xxs)
    }

    private func sampleRow(_ sample: ToneSampleDTO) -> some View {
        Text(sample.sampleText)
            .flynnType(FlynnTypography.bodyMedium)
            .foregroundColor(FlynnColor.textPrimary)
            .contentShape(Rectangle())
            .onTapGesture { editing = sample }
            .swipeActions {
                Button(role: .destructive) {
                    Task { await store.delete(sample.id) }
                } label: { Label("Delete", systemImage: "trash") }
            }
    }

    private func runPreview() {
        preview = .loading
        Task {
            struct Req: Encodable { let messages: [String] }
            struct Resp: Decodable { let drafts: [String] }
            do {
                let session = try await FlynnSupabase.client.auth.session
                var req = URLRequest(url: FlynnEnv.flynnAPIBaseURL.appendingPathComponent("api/keyboard/draft-replies"), timeoutInterval: 20)
                req.httpMethod = "POST"
                req.setValue("Bearer \(session.accessToken)", forHTTPHeaderField: "Authorization")
                req.setValue("application/json", forHTTPHeaderField: "Content-Type")
                req.httpBody = try JSONEncoder().encode(Req(messages: [previewCustomerMessage]))
                let (data, response) = try await URLSession.shared.data(for: req)
                guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode),
                      let decoded = try? JSONDecoder().decode(Resp.self, from: data),
                      let first = decoded.drafts.first else {
                    preview = .failed
                    return
                }
                preview = .ready(first)
            } catch {
                preview = .failed
            }
        }
    }
}

/// Minimal edit sheet for a single tone sample.
struct EditSampleSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var text: String
    let onSave: (String) -> Void

    init(initial: String, onSave: @escaping (String) -> Void) {
        _text = State(initialValue: initial)
        self.onSave = onSave
    }

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: FlynnSpacing.md) {
                FlynnTextField(label: "Your reply", text: $text, autocapitalization: .sentences)
                FlynnButton(title: "Save", action: {
                    onSave(text.trimmingCharacters(in: .whitespacesAndNewlines))
                    dismiss()
                }, fullWidth: true, isDisabled: text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                Spacer()
            }
            .padding(FlynnSpacing.lg)
            .background(FlynnColor.background)
            .navigationTitle("Edit reply")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) { Button("Cancel") { dismiss() } }
                ToolbarItemGroup(placement: .keyboard) {
                    Spacer()
                    Button("Done") {
                        UIApplication.shared.sendAction(
                            #selector(UIResponder.resignFirstResponder),
                            to: nil, from: nil, for: nil
                        )
                    }
                }
            }
        }
    }
}
