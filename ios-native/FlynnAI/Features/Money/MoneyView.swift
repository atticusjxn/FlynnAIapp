import SwiftUI

enum MoneyTab: String, CaseIterable, Identifiable {
    case quotes, invoices
    var id: String { rawValue }
    var title: String { rawValue.capitalized }
}

struct MoneyView: View {
    @State private var tab: MoneyTab = .quotes

    var body: some View {
        VStack(spacing: 0) {
            Picker("Section", selection: $tab) {
                ForEach(MoneyTab.allCases) { option in
                    Text(option.title).tag(option)
                }
            }
            .pickerStyle(.segmented)
            .padding(.horizontal, FlynnSpacing.lg)
            .padding(.top, FlynnSpacing.sm)
            .padding(.bottom, FlynnSpacing.xs)

            Divider()

            Group {
                switch tab {
                case .quotes: QuotesListView()
                case .invoices: InvoicesListView()
                }
            }
        }
        .background(FlynnColor.background)
        .navigationTitle("Money")
    }
}
