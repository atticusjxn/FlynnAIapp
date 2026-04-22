import Foundation
import SwiftUI

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

struct FlashBanner: View {
    @Environment(FlashStore.self) private var store

    var body: some View {
        VStack {
            if let msg = store.current {
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
                .onTapGesture { store.dismiss() }
            }
            Spacer()
        }
        .animation(.spring(response: 0.35, dampingFraction: 0.85), value: store.current)
        .allowsHitTesting(store.current != nil)
    }
}
