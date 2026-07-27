import SwiftUI

enum PartsOrderStatusBadgeMapper {
    static func variant(for status: String) -> FlynnBadgeVariant {
        switch status.lowercased() {
        case "placed": return .primary
        case "confirmed": return .primary
        case "ready_for_pickup": return .warning
        case "picked_up": return .success
        case "cancelled", "canceled": return .error
        default: return .neutral
        }
    }

    static func label(for status: String) -> String {
        switch status.lowercased() {
        case "ready_for_pickup": return "Ready for pickup"
        case "picked_up": return "Picked up"
        default: return status.prefix(1).uppercased() + status.dropFirst()
        }
    }
}

struct PartsOrdersListView: View {
    @State private var store = PartsOrdersListStore()
    @State private var selectedOrder: PartsOrderDTO?

    var body: some View {
        Group {
            switch store.state {
            case .idle, .loading:
                ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
            case .error(let message):
                ContentUnavailableView {
                    Label("Couldn't load orders", systemImage: "exclamationmark.triangle")
                } description: {
                    Text(message)
                } actions: {
                    FlynnButton(title: "Retry", action: { Task { await store.load() } }, variant: .secondary, size: .small)
                }
            case .loaded:
                if store.orders.isEmpty {
                    emptyState
                } else {
                    list
                }
            }
        }
        .sheet(item: $selectedOrder) { order in
            PartsOrderDetailSheet(order: order)
        }
        .task { await store.load() }
        .refreshable { await store.load() }
    }

    private var emptyState: some View {
        VStack(spacing: FlynnSpacing.md) {
            Image(systemName: "shippingbox")
                .font(.system(size: 48))
                .foregroundColor(FlynnColor.textTertiary)
            Text("No orders yet")
                .flynnType(FlynnTypography.h3)
                .foregroundColor(FlynnColor.textPrimary)
            Text("Ask Flynn to price up materials and put an order on your account — it'll land here.")
                .flynnType(FlynnTypography.bodyMedium)
                .foregroundColor(FlynnColor.textSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, FlynnSpacing.lg)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(FlynnSpacing.lg)
    }

    private var list: some View {
        ScrollView {
            LazyVStack(spacing: FlynnSpacing.md) {
                if store.outstandingTotal > 0 {
                    HStack {
                        Text("To collect")
                            .flynnType(FlynnTypography.label)
                            .foregroundColor(FlynnColor.textSecondary)
                        Spacer()
                        Text(FlynnFormatter.currency(store.outstandingTotal))
                            .flynnType(FlynnTypography.h4)
                            .foregroundColor(FlynnColor.textPrimary)
                    }
                    .padding(.horizontal, FlynnSpacing.xxs)
                }

                ForEach(store.orders) { order in
                    Button {
                        selectedOrder = order
                    } label: {
                        PartsOrderRow(order: order)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, FlynnSpacing.lg)
            .padding(.vertical, FlynnSpacing.md)
        }
    }
}

struct PartsOrderRow: View {
    let order: PartsOrderDTO

    var body: some View {
        FlynnCard(shadow: .sm) {
            VStack(alignment: .leading, spacing: FlynnSpacing.xs) {
                HStack(alignment: .firstTextBaseline) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(order.supplier)
                            .flynnType(FlynnTypography.h4)
                            .foregroundColor(FlynnColor.textPrimary)
                            .lineLimit(1)
                        Text(summary)
                            .flynnType(FlynnTypography.caption)
                            .foregroundColor(FlynnColor.textTertiary)
                            .lineLimit(1)
                    }
                    Spacer()
                    Text(FlynnFormatter.currency(order.total))
                        .flynnType(FlynnTypography.h4)
                        .foregroundColor(FlynnColor.textPrimary)
                }

                HStack(spacing: FlynnSpacing.xs) {
                    FlynnBadge(
                        label: PartsOrderStatusBadgeMapper.label(for: order.status),
                        variant: PartsOrderStatusBadgeMapper.variant(for: order.status)
                    )
                    Spacer()
                    Text(FlynnFormatter.relativeDate(order.createdAt))
                        .flynnType(FlynnTypography.caption)
                        .foregroundColor(FlynnColor.textTertiary)
                }
            }
        }
    }

    private var summary: String {
        if let first = order.lineItems.first {
            let extras = order.lineItems.count - 1
            return extras > 0 ? "\(first.description) +\(extras) more" : first.description
        }
        return "\(order.itemCount) items"
    }
}

struct PartsOrderDetailSheet: View {
    let order: PartsOrderDTO
    @Environment(\.dismiss) private var dismiss

    /// Whole units read as "30", fractional ones keep a decimal ("4.5 hrs" style).
    static func quantityLabel(_ value: Double) -> String {
        value == value.rounded()
            ? String(Int(value))
            : String(format: "%.1f", value)
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: FlynnSpacing.md) {
                    FlynnCard {
                        VStack(alignment: .leading, spacing: FlynnSpacing.sm) {
                            HStack {
                                FlynnBadge(
                                    label: PartsOrderStatusBadgeMapper.label(for: order.status),
                                    variant: PartsOrderStatusBadgeMapper.variant(for: order.status)
                                )
                                Spacer()
                                Text(FlynnFormatter.relativeDate(order.createdAt))
                                    .flynnType(FlynnTypography.caption)
                                    .foregroundColor(FlynnColor.textTertiary)
                            }

                            ForEach(order.lineItems) { item in
                                HStack(alignment: .firstTextBaseline) {
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(item.description)
                                            .flynnType(FlynnTypography.bodyMedium)
                                            .foregroundColor(FlynnColor.textPrimary)
                                        if let unit = item.unitPrice {
                                            Text("\(Self.quantityLabel(item.quantity)) × \(FlynnFormatter.currency(unit))")
                                                .flynnType(FlynnTypography.caption)
                                                .foregroundColor(FlynnColor.textTertiary)
                                        }
                                    }
                                    Spacer()
                                    if let total = item.resolvedTotal {
                                        Text(FlynnFormatter.currency(total))
                                            .flynnType(FlynnTypography.bodyMedium)
                                            .foregroundColor(FlynnColor.textPrimary)
                                    }
                                }
                            }

                            Divider()

                            HStack {
                                Text("Total")
                                    .flynnType(FlynnTypography.h4)
                                    .foregroundColor(FlynnColor.textPrimary)
                                Spacer()
                                Text(FlynnFormatter.currency(order.total))
                                    .flynnType(FlynnTypography.h4)
                                    .foregroundColor(FlynnColor.textPrimary)
                            }

                            if let ref = order.confirmationRef {
                                Text("Order ref \(ref)")
                                    .flynnType(FlynnTypography.caption)
                                    .foregroundColor(FlynnColor.textTertiary)
                            }
                        }
                    }
                }
                .padding(FlynnSpacing.lg)
            }
            .background(FlynnColor.background)
            .navigationTitle(order.supplier)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }
}
