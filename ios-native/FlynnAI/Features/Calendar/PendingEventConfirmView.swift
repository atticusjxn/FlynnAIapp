import SwiftUI

/// Confirm sheet for a one-tap booking Flynn detected. Shows the job + time and
/// writes to the user's calendar only on their tap. Matches the Flynn brutalist
/// card look.
struct PendingEventConfirmView: View {
    let event: PendingCalendarEvent
    let writeState: PendingCalendarStore.WriteState
    let onConfirm: () -> Void
    let onDismiss: () -> Void

    private var whenText: String {
        guard let start = event.startDate else { return "" }
        let formatter = DateFormatter()
        formatter.locale = .current
        formatter.dateFormat = "EEEE d MMM · h:mm a"
        return formatter.string(from: start)
    }

    private var headerTitle: String {
        switch writeState {
        case .written: return "Added to your calendar"
        case .failed: return "Couldn't add it"
        default: return "Add this booking?"
        }
    }

    private var headerIcon: String {
        switch writeState {
        case .written: return "checkmark.circle.fill"
        case .failed: return "exclamationmark.triangle.fill"
        default: return "calendar.badge.plus"
        }
    }

    private var headerTint: Color {
        switch writeState {
        case .written: return FlynnColor.success
        case .failed: return FlynnColor.error
        default: return FlynnColor.primary
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: FlynnSpacing.lg) {
            HStack(spacing: FlynnSpacing.sm) {
                Image(systemName: headerIcon)
                    .font(.system(size: 24, weight: .semibold))
                    .foregroundColor(headerTint)
                Text(headerTitle)
                    .flynnType(FlynnTypography.h2)
                    .foregroundColor(FlynnColor.textPrimary)
            }

            VStack(alignment: .leading, spacing: FlynnSpacing.sm) {
                detailRow(icon: "briefcase", text: event.title)
                detailRow(icon: "clock", text: whenText)
                if let location = event.location, !location.isEmpty {
                    detailRow(icon: "mappin.and.ellipse", text: location)
                }
            }
            .padding(FlynnSpacing.md)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: FlynnRadii.xxl, style: .continuous)
                    .fill(FlynnColor.backgroundSecondary)
            )
            .overlay(
                RoundedRectangle(cornerRadius: FlynnRadii.xxl, style: .continuous)
                    .strokeBorder(FlynnColor.border, lineWidth: 2)
            )

            if case .failed(let message) = writeState {
                Text(message)
                    .flynnType(FlynnTypography.bodySmall)
                    .foregroundColor(FlynnColor.error)
            }

            footer

            Spacer(minLength: 0)
        }
        .padding(FlynnSpacing.lg)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .background(FlynnColor.background.ignoresSafeArea())
    }

    @ViewBuilder
    private var footer: some View {
        switch writeState {
        case .written:
            FlynnButton(title: "Done", action: onDismiss, variant: .success, fullWidth: true)
        case .failed:
            VStack(spacing: FlynnSpacing.sm) {
                FlynnButton(title: "Try again", action: onConfirm, fullWidth: true)
                FlynnButton(title: "Not now", action: onDismiss, variant: .ghost, fullWidth: true)
            }
        default:
            VStack(spacing: FlynnSpacing.sm) {
                FlynnButton(
                    title: "Add to calendar",
                    action: onConfirm,
                    fullWidth: true,
                    isLoading: writeState == .writing
                )
                FlynnButton(title: "Not now", action: onDismiss, variant: .ghost, fullWidth: true)
            }
        }
    }

    private func detailRow(icon: String, text: String) -> some View {
        HStack(spacing: FlynnSpacing.sm) {
            Image(systemName: icon)
                .font(.system(size: 15, weight: .semibold))
                .foregroundColor(FlynnColor.textSecondary)
                .frame(width: 22)
            Text(text)
                .flynnType(FlynnTypography.bodyMedium)
                .foregroundColor(FlynnColor.textPrimary)
        }
    }
}
