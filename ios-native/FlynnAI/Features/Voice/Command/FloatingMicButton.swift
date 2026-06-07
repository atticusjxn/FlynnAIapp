import SwiftUI

/// App-wide press-and-hold mic. Hold to talk, release to send. Floats bottom-trailing
/// over the tab shell. The brutalist Flynn look: orange disc, hard border + shadow.
struct FloatingMicButton: View {
    @Bindable var store: VoiceCommandStore

    private var isRecording: Bool { store.phase == .recording }
    private var isProcessing: Bool { store.phase == .processing }

    var body: some View {
        VStack(spacing: FlynnSpacing.xs) {
            if isRecording || isProcessing {
                Text(isRecording ? "Listening…" : "On it…")
                    .flynnType(FlynnTypography.caption)
                    .foregroundColor(FlynnColor.textPrimary)
                    .padding(.horizontal, FlynnSpacing.sm)
                    .padding(.vertical, FlynnSpacing.xxs)
                    .background(
                        Capsule().fill(FlynnColor.backgroundSecondary)
                            .overlay(Capsule().strokeBorder(FlynnColor.border, lineWidth: 1.5))
                    )
                    .transition(.opacity.combined(with: .scale))
            }

            ZStack {
                Circle()
                    .fill(isRecording ? FlynnColor.error : FlynnColor.primary)
                    .frame(width: 64, height: 64)
                    .overlay(Circle().strokeBorder(FlynnColor.border, lineWidth: 2))
                    .shadow(color: FlynnColor.border.opacity(0.9), radius: 0, x: 3, y: 3)

                if isProcessing {
                    ProgressView().tint(.white)
                } else {
                    Image(systemName: isRecording ? "waveform" : "mic.fill")
                        .font(.system(size: 25, weight: .bold))
                        .foregroundColor(.white)
                }
            }
            .scaleEffect(isRecording ? 1.14 : 1)
            .animation(.spring(response: 0.25, dampingFraction: 0.6), value: store.phase)
            // Press-and-hold: onPressingChanged fires once on press and once on release.
            .onLongPressGesture(minimumDuration: 0.01, maximumDistance: .infinity, perform: {}, onPressingChanged: { pressing in
                if pressing {
                    Task { await store.beginRecording() }
                } else {
                    Task { await store.finishRecording() }
                }
            })
            .disabled(isProcessing)
            .accessibilityLabel("Hold to talk to Flynn")
            .accessibilityHint("Records a voice command and acts on it")
        }
        .animation(.easeOut(duration: 0.2), value: store.phase)
    }
}
