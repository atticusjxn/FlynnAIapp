import SwiftUI
import PhotosUI

/// "Teach Flynn how you quote" — capture a quote/invoice/proposal you've already
/// sent (any trade) and Flynn learns your structure, pricing, tax, wording and
/// terms so future voice quotes come out in your style.
struct QuoteStyleView: View {
    @Environment(FlashStore.self) private var flash
    @State private var store = QuoteStyleStore()
    @State private var pickedItem: PhotosPickerItem?
    @State private var showingPaste = false

    var body: some View {
        List {
            Section {
                Text("Show Flynn a quote, invoice or proposal you've already sent. It learns how you price and word things — labour, materials, day rates, packages, tax, deposit, terms — and matches it next time you make a quote by voice.")
                    .flynnType(FlynnTypography.bodyMedium)
                    .foregroundColor(FlynnColor.textSecondary)
            }

            Section {
                PhotosPicker(selection: $pickedItem, matching: .images) {
                    Label("Add a past quote (photo or screenshot)", systemImage: "photo.on.rectangle.angled")
                }
                Button {
                    showingPaste = true
                } label: {
                    Label("Paste quote text", systemImage: "doc.on.clipboard")
                }
            } footer: {
                if store.isWorking, let status = store.statusMessage {
                    HStack(spacing: FlynnSpacing.xs) { ProgressView(); Text(status) }
                }
            }
            .disabled(store.isWorking)

            if let style = store.style {
                Section("What Flynn learned") {
                    if let vertical = style.vertical { row("Business", vertical) }
                    if let currency = style.currency { row("Currency", currency) }
                    if let tax = style.taxSummary { row("Tax", tax) }
                    if let models = style.pricingModels, !models.isEmpty {
                        row("Pricing", models.joined(separator: ", "))
                    }
                    if let terms = style.paymentTerms { row("Payment", terms) }
                    if let validity = style.validity { row("Validity", validity) }
                    if let samples = style.sampleLineItems?.compactMap({ $0.description }), !samples.isEmpty {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Example items").flynnType(FlynnTypography.caption).foregroundColor(FlynnColor.textSecondary)
                            ForEach(samples.prefix(5), id: \.self) { Text("• \($0)").flynnType(FlynnTypography.bodySmall) }
                        }
                    }
                }
                Section {
                    Text("Learned from \(store.sampleCount) document\(store.sampleCount == 1 ? "" : "s"). Add more to refine it.")
                        .flynnType(FlynnTypography.caption)
                        .foregroundColor(FlynnColor.textTertiary)
                    Button(role: .destructive) {
                        Task { await store.reset(); flash.show("Forgot your quote style.", kind: .info) }
                    } label: {
                        Label("Forget my style", systemImage: "trash")
                    }
                }
            }
        }
        .navigationTitle("Your quote style")
        .navigationBarTitleDisplayMode(.inline)
        .task { await store.load() }
        .onChange(of: pickedItem) { _, item in
            guard let item else { return }
            Task {
                if let data = try? await item.loadTransferable(type: Data.self) {
                    await store.learnFromImage(data)
                    if store.errorMessage == nil { flash.show("Learned from your quote ✓", kind: .success) }
                }
                pickedItem = nil
            }
        }
        .onChange(of: store.errorMessage) { _, message in
            if let message { flash.show(message, kind: .error); store.errorMessage = nil }
        }
        .sheet(isPresented: $showingPaste) {
            PasteQuoteView { text in
                Task {
                    await store.learnFromText(text)
                    if store.errorMessage == nil { flash.show("Learned your style ✓", kind: .success) }
                }
            }
        }
    }

    private func row(_ label: String, _ value: String) -> some View {
        HStack {
            Text(label).foregroundColor(FlynnColor.textSecondary)
            Spacer()
            Text(value).foregroundColor(FlynnColor.textPrimary).multilineTextAlignment(.trailing)
        }
        .flynnType(FlynnTypography.bodyMedium)
    }
}

private struct PasteQuoteView: View {
    @Environment(\.dismiss) private var dismiss
    let onSubmit: (String) -> Void
    @State private var text = ""

    var body: some View {
        NavigationStack {
            TextEditor(text: $text)
                .padding(FlynnSpacing.md)
                .overlay(alignment: .topLeading) {
                    if text.isEmpty {
                        Text("Paste the text of a past quote…")
                            .foregroundColor(FlynnColor.textPlaceholder)
                            .padding(FlynnSpacing.md + 4)
                            .allowsHitTesting(false)
                    }
                }
                .navigationTitle("Paste quote")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .topBarLeading) { Button("Cancel") { dismiss() } }
                    ToolbarItem(placement: .topBarTrailing) {
                        Button("Learn") { onSubmit(text); dismiss() }
                            .disabled(text.trimmingCharacters(in: .whitespacesAndNewlines).count < 20)
                    }
                }
        }
    }
}
