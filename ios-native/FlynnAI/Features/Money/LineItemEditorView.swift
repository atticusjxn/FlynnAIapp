import SwiftUI

/// Sheet for adding or editing a single line item.
struct LineItemEditorView: View {
    @Binding var draft: LineItemDraft
    let onSave: () -> Void

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Form {
                Section("Description") {
                    TextField("e.g. Labour (2 hrs), Materials…", text: $draft.description, axis: .vertical)
                        .lineLimit(2...4)
                }

                Section("Quantity & Price") {
                    HStack {
                        Text("Qty")
                            .foregroundColor(FlynnColor.textSecondary)
                        Spacer()
                        TextField("1", value: $draft.quantity, format: .number)
                            .multilineTextAlignment(.trailing)
                            .keyboardType(.decimalPad)
                            .frame(width: 80)
                    }
                    HStack {
                        Text("Unit price")
                            .foregroundColor(FlynnColor.textSecondary)
                        Spacer()
                        TextField("0.00", value: $draft.unitPrice, format: .currency(code: "AUD"))
                            .multilineTextAlignment(.trailing)
                            .keyboardType(.decimalPad)
                            .frame(width: 120)
                    }
                }

                Section {
                    HStack {
                        Text("Line total")
                            .flynnType(FlynnTypography.bodyMedium)
                            .foregroundColor(FlynnColor.textSecondary)
                        Spacer()
                        Text(FlynnFormatter.currency(draft.total))
                            .flynnType(FlynnTypography.h4)
                            .foregroundColor(FlynnColor.textPrimary)
                    }
                }
            }
            .navigationTitle("Line Item")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Add") {
                        onSave()
                        dismiss()
                    }
                    .disabled(draft.description.trimmingCharacters(in: .whitespaces).isEmpty || draft.unitPrice <= 0)
                    .fontWeight(.semibold)
                }
            }
        }
    }
}
