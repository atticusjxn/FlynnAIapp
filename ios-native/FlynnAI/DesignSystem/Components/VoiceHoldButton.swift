import SwiftUI

/// Hold to talk, release to submit, slide away to scrap.
///
/// Pulled out of the Home agent bar so every place that wants dictation gets the
/// same control rather than a re-implementation that drifts: the same cancel
/// threshold, the same three haptic beats, and — importantly — the same
/// VoiceOver behaviour, since press-and-hold cannot be expressed under VoiceOver
/// and has to fall back to tap-to-start / tap-to-stop.
///
/// The caller owns the `VoiceCaptureManager` so it can read `transcript` live.
struct VoiceHoldButton: View {
    @Bindable var voice: VoiceCaptureManager

    /// Fired on release with the final transcript. Not called when cancelled or
    /// when nothing was heard.
    var onSubmit: (String) -> Void
    /// Fired when the user slides away to scrap the recording.
    var onCancel: () -> Void = {}
    /// Fired on release when the recogniser heard nothing.
    var onNothingHeard: () -> Void = {}
    var size: CGFloat = 58
    /// Called when a hold starts, so the caller can drop focus or stash state.
    var onStart: () -> Void = {}
    /// Reports the slide-to-cancel arming so callers can render their own hint
    /// (strike the transcript, swap the caption) without owning the gesture.
    var onCancelArmedChange: (Bool) -> Void = { _ in }

    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.accessibilityVoiceOverEnabled) private var voiceOverEnabled

    @State private var isHolding = false
    @State private var pulse = false
    @State private var cancelArmed = false
    @State private var dragDistance: CGFloat = 0

    /// How far the finger travels before releasing cancels instead of submits.
    private let cancelThreshold: CGFloat = 90

    var isListening: Bool { voice.state == .listening }

    var body: some View {
        Group {
            if voiceOverEnabled {
                Button { voiceOverToggle() } label: { visual }
                    .buttonStyle(.plain)
            } else {
                visual.simultaneousGesture(holdGesture)
            }
        }
        .accessibilityLabel(isListening ? "Stop and use what I said" : "Hold to talk")
        .accessibilityHint(
            voiceOverEnabled
                ? (isListening ? "Double tap to stop and use it" : "Double tap to start talking")
                : "Hold to talk, release when you're done"
        )
        .accessibilityAddTraits(.isButton)
        // onEnded never fires if the gesture is interrupted by a call or a
        // backgrounding; without these the latch sticks and the button dies.
        .onChange(of: scenePhase) { _, phase in
            guard phase != .active, isHolding else { return }
            reset()
            if isListening { voice.stopListening() }
        }
        .onDisappear {
            reset()
            if isListening { voice.stopListening() }
        }
    }

    // MARK: - Gesture

    private var holdGesture: some Gesture {
        DragGesture(minimumDistance: 0)
            .onChanged { value in
                if !isHolding {
                    isHolding = true
                    cancelArmed = false
                    dragDistance = 0
                    onStart()
                    Task { await voice.startListening() }
                    return
                }
                // Leftward and upward both count — thumbs arc rather than
                // sliding in a straight line.
                dragDistance = max(0, max(-value.translation.width, -value.translation.height))
                let armed = dragDistance >= cancelThreshold
                if armed != cancelArmed {
                    cancelArmed = armed
                    onCancelArmedChange(armed)
                }
            }
            .onEnded { _ in
                if cancelArmed { cancel() } else { finish() }
            }
    }

    private func voiceOverToggle() {
        if isListening {
            finish()
        } else {
            isHolding = true
            cancelArmed = false
            onStart()
            Task { await voice.startListening() }
        }
    }

    private func reset() {
        isHolding = false
        if cancelArmed { onCancelArmedChange(false) }
        cancelArmed = false
        dragDistance = 0
    }

    private func cancel() {
        reset()
        if isListening { voice.stopListening() }
        onCancel()
    }

    private func finish() {
        reset()
        guard isListening else { return }
        voice.stopListening()
        // The recogniser keeps finalising briefly after stopListening, so give
        // it a beat or the tail of the sentence is lost.
        Task {
            try? await Task.sleep(for: .milliseconds(400))
            let text = voice.transcript.trimmingCharacters(in: .whitespacesAndNewlines)
            if text.isEmpty { onNothingHeard() } else { onSubmit(text) }
        }
    }

    // MARK: - Visual

    private var fill: Color {
        if cancelArmed { return FlynnColor.error }
        return isListening ? FlynnColor.primary : FlynnColor.backgroundSecondary
    }

    private var visual: some View {
        Image(systemName: cancelArmed ? "xmark" : (isListening ? "waveform" : "mic.fill"))
            .font(.system(size: isListening ? 24 : 22, weight: .semibold))
            .foregroundColor(isListening || cancelArmed ? FlynnColor.textInverse : FlynnColor.primary)
            .frame(width: size, height: size)
            .background(Circle().fill(fill))
            .overlay(
                Circle().stroke(
                    cancelArmed ? FlynnColor.error : (isListening ? FlynnColor.primary : FlynnColor.border),
                    lineWidth: FlynnStroke.outline
                )
            )
            .overlay(
                Circle()
                    .stroke(cancelArmed ? FlynnColor.error : FlynnColor.primary, lineWidth: 2)
                    .scaleEffect(isListening && pulse ? 1.75 : 1.0)
                    .opacity(isListening && pulse ? 0 : 0.55)
                    .animation(
                        isListening ? .easeOut(duration: 1.1).repeatForever(autoreverses: false) : .default,
                        value: pulse
                    )
                    .allowsHitTesting(false)
            )
            .scaleEffect(isListening ? (cancelArmed ? 1.05 : 1.22) : 1.0)
            .animation(.spring(response: 0.3, dampingFraction: 0.6), value: isListening)
            .animation(.spring(response: 0.25, dampingFraction: 0.7), value: cancelArmed)
            // Legible without looking: a firm thump on start, a sharp tick the
            // instant cancel arms, a light tap when it's scrapped.
            .sensoryFeedback(.impact(weight: .heavy, intensity: 0.9), trigger: isListening) { _, now in now }
            .sensoryFeedback(.impact(flexibility: .rigid, intensity: 1.0), trigger: cancelArmed) { _, now in now }
            .onAppear { pulse = true }
    }
}

/// The "slide left to cancel" strip shown beside a live recording.
struct VoiceCancelHint: View {
    var armed: Bool

    var body: some View {
        HStack(spacing: FlynnSpacing.xxs) {
            Image(systemName: armed ? "trash.fill" : "chevron.left")
                .font(.system(size: 11, weight: .bold))
            Text(armed ? "release to scrap" : "slide left to cancel")
                .flynnType(FlynnTypography.caption)
        }
        .foregroundColor(armed ? FlynnColor.error : FlynnColor.textTertiary)
        .animation(.easeOut(duration: 0.15), value: armed)
    }
}
