import SwiftUI

/// Flynn the chat-bubble mascot. One round orange character in a set of poses,
/// shipped as transparent imagesets under `Assets.xcassets/Mascots`. Use it to
/// bring warmth to onboarding steps, empty states, and hero moments.
///
/// ```swift
/// Mascot(.wave, size: 120)                 // bare, transparent
/// Mascot(.sleep, size: 96, backdrop: .cream) // on a soft cream disc
/// ```
enum MascotPose: String, CaseIterable {
    case wave, thumbsup, thinking, point, peek, write, sleep, phone

    var assetName: String { "mascot-\(rawValue)" }
}

enum MascotBackdrop {
    case none
    /// A soft cream disc behind the character — matches the app icon.
    case cream
    /// A faint primary-tinted disc, for moments that want a little brand energy.
    case primary
}

struct Mascot: View {
    let pose: MascotPose
    var size: CGFloat = 120
    var backdrop: MascotBackdrop = .none

    init(_ pose: MascotPose, size: CGFloat = 120, backdrop: MascotBackdrop = .none) {
        self.pose = pose
        self.size = size
        self.backdrop = backdrop
    }

    var body: some View {
        ZStack {
            switch backdrop {
            case .none:
                EmptyView()
            case .cream:
                Circle().fill(FlynnColor.cream).frame(width: size, height: size)
            case .primary:
                Circle().fill(FlynnColor.primaryLight).frame(width: size, height: size)
            }

            Image(pose.assetName)
                .resizable()
                .scaledToFit()
                // The character fills more of the frame when it floats free;
                // on a disc it tucks inside with a little breathing room.
                .frame(width: size * inset, height: size * inset)
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }

    private var inset: CGFloat {
        backdrop == .none ? 1.0 : 0.78
    }
}

/// A warm empty-state built around the mascot — drop-in replacement for
/// `ContentUnavailableView` when a screen has nothing to show yet.
struct MascotEmptyState<Actions: View>: View {
    let pose: MascotPose
    let title: String
    let message: String
    @ViewBuilder var actions: () -> Actions

    init(
        pose: MascotPose,
        title: String,
        message: String,
        @ViewBuilder actions: @escaping () -> Actions = { EmptyView() }
    ) {
        self.pose = pose
        self.title = title
        self.message = message
        self.actions = actions
    }

    var body: some View {
        VStack(spacing: FlynnSpacing.md) {
            Mascot(pose, size: 144, backdrop: .cream)
            VStack(spacing: FlynnSpacing.xs) {
                Text(title)
                    .flynnType(FlynnTypography.h3)
                    .foregroundColor(FlynnColor.textPrimary)
                    .multilineTextAlignment(.center)
                Text(message)
                    .flynnType(FlynnTypography.bodyMedium)
                    .foregroundColor(FlynnColor.textSecondary)
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
            }
            actions()
        }
        .padding(FlynnSpacing.xl)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

#Preview {
    ScrollView {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 110))], spacing: 16) {
            ForEach(MascotPose.allCases, id: \.self) { pose in
                VStack(spacing: 6) {
                    Mascot(pose, size: 96, backdrop: .cream)
                    Text(pose.rawValue).flynnType(FlynnTypography.caption)
                }
            }
        }
        .padding()
    }
    .background(FlynnColor.background)
}
