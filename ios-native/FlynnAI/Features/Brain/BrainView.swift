import SwiftUI
import UIKit

/// Brain tab — the business knowledge Flynn cites in drafts. Saves in the shape
/// the backend draft formatter consumes (see BrainStore).
struct BrainView: View {
    @Environment(FlashStore.self) private var flash
    @State private var store = BrainStore()

    var body: some View {
        @Bindable var store = store
        return Form {
            Section("Your business") {
                TextField("What you do (e.g. plumber)", text: $store.businessType)
                TextField("Short description", text: $store.businessDescription, axis: .vertical)
                    .lineLimit(2...4)
            }

            Section {
                ForEach($store.services) { $svc in
                    VStack(alignment: .leading, spacing: 4) {
                        TextField("Service name", text: $svc.name)
                        HStack(spacing: 8) {
                            TextField("Price", text: $svc.priceRange)
                                .keyboardType(.numbersAndPunctuation)
                            Text("·")
                                .foregroundColor(FlynnColor.textTertiary)
                            TextField("Duration (e.g. 1-2 hrs)", text: $svc.typicalDuration)
                        }
                        .font(.subheadline)
                        .foregroundColor(FlynnColor.textSecondary)
                    }
                    .padding(.vertical, 2)
                }
                .onDelete { store.services.remove(atOffsets: $0) }
                Button {
                    store.services.append(.init(name: "", priceRange: ""))
                } label: { Label("Add service", systemImage: "plus") }
            } header: {
                Text("Services & rough pricing")
            }

            Section("Pricing notes") {
                TextField("e.g. $90 callout, quotes free", text: $store.pricingNotes, axis: .vertical)
                    .lineLimit(1...3)
            }

            Section("Hours") {
                ForEach($store.days) { $day in
                    VStack(spacing: 4) {
                        Toggle(day.label, isOn: $day.isOpen)
                        if day.isOpen {
                            HStack {
                                TextField("Open", text: $day.open).multilineTextAlignment(.center)
                                Text("–").foregroundColor(FlynnColor.textTertiary)
                                TextField("Close", text: $day.close).multilineTextAlignment(.center)
                            }
                            .font(.subheadline)
                        }
                    }
                }
            }

            Section {
                ForEach($store.faqs) { $faq in
                    VStack(alignment: .leading, spacing: 4) {
                        TextField("Question", text: $faq.question)
                            .font(.subheadline.weight(.semibold))
                        TextField("Answer", text: $faq.answer, axis: .vertical)
                            .lineLimit(1...3)
                    }
                }
                .onDelete { store.faqs.remove(atOffsets: $0) }
                Button {
                    store.faqs.append(.init(question: "", answer: ""))
                } label: { Label("Add FAQ", systemImage: "plus") }
            } header: {
                Text("Common questions")
            }

            Section("Service area") {
                TextField("e.g. Northern Beaches, North Shore", text: $store.serviceArea)
            }

            Section {
                NavigationLink {
                    RememberedContextView()
                } label: {
                    Label("What Flynn remembers", systemImage: "sparkles")
                }
                NavigationLink {
                    QuoteStyleView()
                } label: {
                    Label("Your quote style", systemImage: "doc.text.magnifyingglass")
                }
                NavigationLink {
                    CaptureHistoryView()
                } label: {
                    Label("Screenshot captures", systemImage: "camera.viewfinder")
                }
            } footer: {
                Text("Facts Flynn has learned about your customers, how you quote, and your screenshot capture history — woven into future replies and quotes.")
            }

            Section {
                TextField("https://yourbusiness.com", text: $store.websiteURL)
                    .textContentType(.URL)
                    .autocapitalization(.none)
                Button {
                    Task {
                        await store.rescan()
                        flash.success("Re-scanned your website")
                    }
                } label: {
                    HStack {
                        Label("Re-scan my website", systemImage: "arrow.clockwise")
                        Spacer()
                        if store.rescanning { ProgressView() }
                    }
                }
                .disabled(store.websiteURL.trimmingCharacters(in: .whitespaces).isEmpty || store.rescanning)
            } header: {
                Text("Website")
            } footer: {
                Text("Flynn pulls services, pricing and hours from your website.")
            }
        }
        .navigationTitle("Brain")
        .scrollDismissesKeyboard(.immediately)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button("Save") {
                    UIApplication.shared.sendAction(
                        #selector(UIResponder.resignFirstResponder),
                        to: nil, from: nil, for: nil
                    )
                    Task {
                        await store.save()
                        flash.success("Saved")
                    }
                }
                .disabled(store.saving)
            }
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
        .task { await store.load() }
    }
}
