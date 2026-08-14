import Foundation
import SwiftUI
import UIKit

enum FlashKind: Equatable {
    case success, error, info

    var systemImage: String {
        switch self {
        case .success: return "checkmark.circle.fill"
        case .error: return "xmark.octagon.fill"
        case .info: return "info.circle.fill"
        }
    }

    var tint: Color {
        switch self {
        case .success: return FlynnColor.success
        case .error: return FlynnColor.error
        case .info: return FlynnColor.primary
        }
    }

    var background: Color {
        switch self {
        case .success: return FlynnColor.successLight
        case .error: return FlynnColor.errorLight
        case .info: return FlynnColor.primaryLight
        }
    }
}

struct FlashMessage: Identifiable, Equatable {
    let id = UUID()
    let kind: FlashKind
    let text: String
}

@MainActor
@Observable
final class FlashStore {
    var current: FlashMessage?
    private var dismissTask: Task<Void, Never>?

    func show(_ text: String, kind: FlashKind = .info, duration: Duration = .seconds(3)) {
        dismissTask?.cancel()
        current = FlashMessage(kind: kind, text: text)
        // This banner is the app's only channel for "invoice sent", "couldn't
        // save", and every auth failure, and it is purely visual — it appears
        // for three seconds and goes. Without this a VoiceOver user gets no
        // signal at all that anything happened. `.announcement` is the right
        // notification here rather than `.screenChanged`: focus should stay
        // where the user put it.
        UIAccessibility.post(notification: .announcement, argument: text)
        dismissTask = Task { [weak self] in
            try? await Task.sleep(for: duration)
            if !Task.isCancelled {
                await MainActor.run { self?.current = nil }
            }
        }
    }

    func success(_ text: String) { show(text, kind: .success) }
    func error(_ text: String) { show(text, kind: .error, duration: .seconds(4)) }
    func info(_ text: String) { show(text, kind: .info) }

    func dismiss() {
        dismissTask?.cancel()
        current = nil
    }
}

extension View {
    /// Attach a flash banner to a view that is presented **modally**.
    ///
    /// The app-wide banner lives in `RootView`'s ZStack, which sits *below* any
    /// presented sheet in SwiftUI's window hierarchy. A flash raised from inside
    /// a sheet — Save on Payment details, a StoreKit purchase failure on the
    /// paywall, a failed account delete — therefore rendered underneath the
    /// modal where nobody could see it, and the action read as silently doing
    /// nothing. Every sheet root that can raise a flash opts in with this.
    func flynnFlashOverlay() -> some View {
        overlay(FlashBanner())
    }
}

struct FlashBanner: View {
    /// Deliberately optional.
    ///
    /// `@Environment(FlashStore.self)` with a non-optional type is a hard
    /// `fatalError` when the object isn't in scope, and this view gets attached
    /// as an overlay from a dozen places — including sheets, which don't inherit
    /// the scene environment. One wrong modifier order killed the app on the
    /// paywall, which is the single most expensive screen to lose. A banner is
    /// decorative; it has no business being able to crash anything, so a missing
    /// store now renders nothing instead of taking the process with it.
    @Environment(FlashStore.self) private var store: FlashStore?

    var body: some View {
        VStack {
            if let msg = store?.current {
                HStack(spacing: FlynnSpacing.sm) {
                    Image(systemName: msg.kind.systemImage)
                        .foregroundColor(msg.kind.tint)
                    Text(msg.text)
                        .flynnType(FlynnTypography.bodyMedium)
                        .foregroundColor(FlynnColor.textPrimary)
                        .fixedSize(horizontal: false, vertical: true)
                    Spacer()
                }
                .padding(.vertical, FlynnSpacing.sm)
                .padding(.horizontal, FlynnSpacing.md)
                .background(
                    RoundedRectangle(cornerRadius: FlynnRadii.md, style: .continuous)
                        .fill(msg.kind.background)
                )
                .brutalistBorder(cornerRadius: FlynnRadii.md, color: msg.kind.tint, lineWidth: 2)
                .brutalistShadow(.sm, cornerRadius: FlynnRadii.md)
                .padding(.horizontal, FlynnSpacing.md)
                .padding(.top, FlynnSpacing.sm)
                .transition(.move(edge: .top).combined(with: .opacity))
                .onTapGesture { store?.dismiss() }
            }
            Spacer()
        }
        .animation(.spring(response: 0.35, dampingFraction: 0.85), value: store?.current)
        .allowsHitTesting(store?.current != nil)
    }
}
