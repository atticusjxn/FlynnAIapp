import SwiftUI

struct QuoteRow: View {
    let quote: QuoteDTO

    var body: some View {
        FlynnCard(shadow: .sm) {
            VStack(alignment: .leading, spacing: FlynnSpacing.xs) {
                HStack(alignment: .firstTextBaseline) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(quote.title ?? quote.quoteNumber)
                            .flynnType(FlynnTypography.h4)
                            .foregroundColor(FlynnColor.textPrimary)
                            .lineLimit(1)
                        Text(quote.quoteNumber)
                            .flynnType(FlynnTypography.caption)
                            .foregroundColor(FlynnColor.textTertiary)
                    }
                    Spacer()
                    Text(FlynnFormatter.currency(quote.total))
                        .flynnType(FlynnTypography.h4)
                        .foregroundColor(FlynnColor.textPrimary)
                }

                HStack(spacing: FlynnSpacing.xs) {
                    FlynnBadge(
                        label: QuoteStatusBadgeMapper.label(for: quote.status),
                        variant: QuoteStatusBadgeMapper.variant(for: quote.status)
                    )
                    Spacer()
                    Text(FlynnFormatter.relativeDate(quote.createdAt))
                        .flynnType(FlynnTypography.caption)
                        .foregroundColor(FlynnColor.textTertiary)
                }
            }
        }
    }
}

struct InvoiceRow: View {
    let invoice: InvoiceDTO

    var body: some View {
        FlynnCard(shadow: .sm) {
            VStack(alignment: .leading, spacing: FlynnSpacing.xs) {
                HStack(alignment: .firstTextBaseline) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(invoice.title ?? invoice.invoiceNumber)
                            .flynnType(FlynnTypography.h4)
                            .foregroundColor(FlynnColor.textPrimary)
                            .lineLimit(1)
                        Text(invoice.invoiceNumber)
                            .flynnType(FlynnTypography.caption)
                            .foregroundColor(FlynnColor.textTertiary)
                    }
                    Spacer()
                    VStack(alignment: .trailing, spacing: 2) {
                        Text(FlynnFormatter.currency(invoice.total))
                            .flynnType(FlynnTypography.h4)
                            .foregroundColor(FlynnColor.textPrimary)
                        if invoice.amountDue > 0 && invoice.status.lowercased() != "paid" {
                            Text("\(FlynnFormatter.currency(invoice.amountDue)) due")
                                .flynnType(FlynnTypography.caption)
                                .foregroundColor(FlynnColor.error)
                        }
                    }
                }

                HStack(spacing: FlynnSpacing.xs) {
                    FlynnBadge(
                        label: InvoiceStatusBadgeMapper.label(for: invoice.status),
                        variant: InvoiceStatusBadgeMapper.variant(for: invoice.status)
                    )
                    Spacer()
                    if let due = invoice.dueDate {
                        Text("Due \(FlynnFormatter.relativeDate(due))")
                            .flynnType(FlynnTypography.caption)
                            .foregroundColor(FlynnColor.textTertiary)
                    }
                }
            }
        }
    }
}
