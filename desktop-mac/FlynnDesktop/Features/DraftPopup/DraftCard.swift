import SwiftUI

/// Single draft card — brutalist design matching the iOS keyboard card.
struct DraftCard: View {
    let text: String
    let index: Int
    let total: Int
    let isSelected: Bool
    let onInsert: () -> Void
    let onPrev: () -> Void
    let onNext: () -> Void

    var body: some View {
        Button(action: onInsert) {
            HStack(spacing: 0) {
                // Left arrow
                arrowButton(systemName: "chevron.left", action: onPrev)
                    .opacity(index > 0 ? 1 : 0.25)
                    .disabled(index == 0)

                // Draft text
                VStack(spacing: FlynnSpacing.xxs) {
                    Text(text)
                        .font(.system(size: 15, weight: .regular))
                        .foregroundColor(FlynnColor.textPrimary)
                        .multilineTextAlignment(.leading)
                        .fixedSize(horizontal: false, vertical: true)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.vertical, FlynnSpacing.xs)

                    if total > 1 {
                        Text("\(index + 1) / \(total)")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundColor(FlynnColor.textTertiary)
                    }
                }
                .padding(.horizontal, FlynnSpacing.xs)

                // Right arrow
                arrowButton(systemName: "chevron.right", action: onNext)
                    .opacity(index < total - 1 ? 1 : 0.25)
                    .disabled(index == total - 1)
            }
            .padding(.horizontal, FlynnSpacing.sm)
            .padding(.vertical, FlynnSpacing.sm)
        }
        .buttonStyle(.plain)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(FlynnColor.creamCard)
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(FlynnColor.border, lineWidth: 2)
                )
                // Brutalist offset shadow
                .shadow(color: FlynnColor.border.opacity(0.8), radius: 0, x: 3, y: 3)
        )
    }

    private func arrowButton(systemName: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: systemName)
                .font(.system(size: 18, weight: .semibold))
                .foregroundColor(FlynnColor.primary)
                .frame(width: 32, height: 32)
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Loading shimmer card

struct DraftCardSkeleton: View {
    @State private var shimmer = false

    var body: some View {
        VStack(spacing: FlynnSpacing.xxs) {
            shimmerLine(width: 320)
            shimmerLine(width: 240)
            shimmerLine(width: 180)
        }
        .padding(FlynnSpacing.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(FlynnColor.creamCard)
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(FlynnColor.border, lineWidth: 2))
                .shadow(color: FlynnColor.border.opacity(0.8), radius: 0, x: 3, y: 3)
        )
        .onAppear { withAnimation(.easeInOut(duration: 1).repeatForever()) { shimmer = true } }
    }

    private func shimmerLine(width: CGFloat) -> some View {
        RoundedRectangle(cornerRadius: 4)
            .fill(LinearGradient(
                colors: [FlynnColor.gray200, FlynnColor.gray100, FlynnColor.gray200],
                startPoint: shimmer ? .leading : .trailing,
                endPoint: shimmer ? .trailing : .leading
            ))
            .frame(width: width, height: 14)
    }
}
