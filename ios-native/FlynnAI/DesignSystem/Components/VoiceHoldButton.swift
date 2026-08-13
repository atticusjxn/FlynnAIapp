import SwiftUI

/// Hold to talk, release to submit, slide away to scrap.
///
/// Pulled out of the Home agent bar so every place that wants dictation gets the
/// same control rather than a re-implementation that drifts: the same cancel
/// threshold, the same haptic beats, and — importantly — the same VoiceOver
/// behaviour, since press-and-hold cannot be expressed under VoiceOver and has
/// to fall back to tap-to-start / tap-to-stop.
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
    /// Fired when the press was too brief to be a hold — a stray tap. The old
    /// gesture started and instantly aborted a recording on any tap, surfacing
    /// "didn't catch that" for what was really a missed press; this lets the
    /// caller show "hold to talk" instead of a failure.
    var onTapTooQuick: () -> Void = {}
    var size: CGFloat = 60
    /// Called when a hold actually starts, so the caller can drop focus or stash
    /// state. Not called for a too-quick tap.
    var onStart: () -> Void = {}
    /// Reports the slide-to-cancel arming so callers can render their own hint
    /// (strike the transcript, swap the caption) without owning the gesture.
    var onCancelArmedChange: (Bool) -> Void = { _ in }

    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.accessibilityVoiceOverEnabled) private var voiceOverEnabled

    /// Finger is down. Distinct from `didStart`: there's a short guard window
    /// between touch-down and the recogniser actually opening.
    @State private var isPressing = false
    /// The recogniser actually opened (the press cleared the hold guard).
    @State private var didStart = false
    @State private var holdTask: Task<Void, Never>?
    @State private var pulse = false
    @State private var cancelArmed = false
    @State private var dragDistance: CGFloat = 0
    /// Bumped each time a recording is scrapped, to fire the release haptic.
    @State private var scrapTick = 0

    /// How far the finger travels before releasing cancels instead of submits.
    private let cancelThreshold: CGFloat = 90
    /// How long a press must be held before the recogniser opens. Below this
    /// it's a tap, not a hold, and nothing is recorded.
    private let holdGuard: Duration = .milliseconds(160)

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
        // `stopListening` is called unconditionally rather than behind an
        // `isListening` check: the recogniser may still be opening (first run,
        // behind the permission alert), and that in-flight start has to be
        // cancelled too or the mic latches on with nobody holding the button.
        .onChange(of: scenePhase) { _, phase in
            guard phase != .active, isPressing else { return }
            holdTask?.cancel()
            reset()
            voice.stopListening()
        }
        .onDisappear {
            holdTask?.cancel()
            reset()
            voice.stopListening()
        }
    }

    // MARK: - Gesture

    private var holdGesture: some Gesture {
        DragGesture(minimumDistance: 0)
            .onChanged { value in
                if !isPressing {
                    isPressing = true
                    didStart = false
                    cancelArmed = false
                    dragDistance = 0
                    scheduleStart()
                    return
                }
                // Leftward and upward both count — thumbs arc rather than
                // sliding in a straight line.
                let dist = max(0, max(-value.translation.width, -value.translation.height))
                dragDistance = dist
                // A deliberate drag away is itself an intentional hold — open
                // the recogniser now rather than waiting out the guard.
                if !didStart && dist > 12 { beginNow() }
                guard didStart else { return }
                let armed = dist >= cancelThreshold
                if armed != cancelArmed {
                    cancelArmed = armed
                    onCancelArmedChange(armed)
                }
            }
            .onEnded { _ in
                holdTask?.cancel()
                let started = didStart
                isPressing = false
                if !started {
                    // Too quick to be a hold — never opened the recogniser.
                    reset()
                    onTapTooQuick()
                    return
                }
                if cancelArmed { cancel() } else { finish() }
            }
    }

    private func scheduleStart() {
        holdTask?.cancel()
        holdTask = Task { @MainActor in
            try? await Task.sleep(for: holdGuard)
            guard isPressing, !didStart else { return }
            beginNow()
        }
    }

    private func beginNow() {
        guard !didStart else { return }
        didStart = true
        onStart()
        Task { @MainActor in await voice.startListening() }
    }

    private func voiceOverToggle() {
        if isListening {
            finish()
        } else {
            isPressing = true
            didStart = true
            cancelArmed = false
            onStart()
            Task { @MainActor in await voice.startListening() }
        }
    }

    private func reset() {
        isPressing = false
        didStart = false
        if cancelArmed { onCancelArmedChange(false) }
        cancelArmed = false
        dragDistance = 0
    }

    private func cancel() {
        scrapTick &+= 1
        let started = didStart
        reset()
        if started { voice.stopListening() }
        onCancel()
    }

    private func finish() {
        let started = didStart
        let wasListening = isListening
        reset()
        guard started else { return }
        // Stop even when `isListening` is still false — on a first run the
        // permission alert takes the touch, so the release lands while the
        // recogniser is only part-way open. Gating this on `isListening` is
        // what left the mic latched on and the bar stuck on "listening...".
        voice.stopListening()
        // Nothing was ever captured, so there's no transcript to wait for.
        guard wasListening else { return }
        // The recogniser keeps finalising briefly after stopListening, so give
        // it a beat or the tail of the sentence is lost.
        Task {
            try? await Task.sleep(for: .milliseconds(400))
            let text = voice.transcript.trimmingCharacters(in: .whitespacesAndNewlines)
            if text.isEmpty { onNothingHeard() } else { onSubmit(text) }
        }
    }

    // MARK: - Visual

    /// Idle and listening are both brand orange — this is the primary action on
    /// the bar and should read as filled, not as a hollow outline waiting to be
    /// discovered. State is carried by scale, the pulse ring and the level
    /// meter, not by colour swapping to grey.
    private var fill: Color {
        cancelArmed ? FlynnColor.error : FlynnColor.primary
    }

    /// How much the button grows on top of its listening scale, in response to
    /// actual mic level. Subtle on purpose — it should feel like it's breathing
    /// with your voice, not visibly resizing.
    private var levelBoost: CGFloat {
        guard isListening, !cancelArmed else { return 0 }
        return CGFloat(voice.level) * 0.09
    }

    // Broken into sub-views: the whole thing as one modifier chain tripped the
    // Swift type-checker's "unable to type-check in reasonable time" limit.

    private var iconLayer: some View {
        Group {
            if cancelArmed {
                Image(systemName: "xmark").font(.system(size: 23, weight: .semibold))
            } else if isListening {
                VoiceLevelMeter(level: voice.level, barCount: 4, tint: FlynnColor.textInverse)
            } else {
                Image(systemName: "mic.fill").font(.system(size: 23, weight: .semibold))
            }
        }
        .foregroundColor(FlynnColor.textInverse)
        .frame(width: size, height: size)
    }

    /// Filled circle with a top-down sheen so it reads as a lit pill, not a flat
    /// disc, plus a hairline white rim.
    private var filledCircle: some View {
        Circle()
            .fill(fill)
            .overlay(
                Circle().fill(
                    LinearGradient(colors: [.white.opacity(0.28), .clear],
                                   startPoint: .top, endPoint: .center)
                )
            )
            .overlay(Circle().strokeBorder(Color.white.opacity(0.22), lineWidth: 1))
    }

    private var pulseRing: some View {
        Circle()
            .stroke(cancelArmed ? FlynnColor.error : FlynnColor.primary, lineWidth: 2)
            .scaleEffect(isListening && pulse ? 1.7 : 1.0)
            .opacity(isListening && pulse ? 0 : 0.5)
            .animation(
                isListening ? .easeOut(duration: 1.1).repeatForever(autoreverses: false) : .default,
                value: pulse
            )
            .allowsHitTesting(false)
    }

    private var currentScale: CGFloat {
        guard isListening else { return 1.0 }
        return cancelArmed ? 1.06 : 1.24 + levelBoost
    }

    private var visual: some View {
        iconLayer
            .background(filledCircle)
            .overlay(pulseRing)
            .scaleEffect(currentScale)
            // A soft orange glow gives the mic lift over the glass bar.
            .shadow(color: FlynnColor.primary.opacity(isListening ? 0.5 : 0.32),
                    radius: isListening ? 16 : 9, y: 4)
            .animation(.spring(response: 0.3, dampingFraction: 0.6), value: isListening)
            .animation(.spring(response: 0.25, dampingFraction: 0.7), value: cancelArmed)
            .animation(.spring(response: 0.14, dampingFraction: 0.75), value: levelBoost)
            // Three beats you can feel without looking: a firm thump on start, a
            // sharp tick the instant cancel arms, a light tap when it's scrapped.
            .sensoryFeedback(.impact(weight: .heavy, intensity: 0.9), trigger: isListening) { _, now in now }
            .sensoryFeedback(.impact(flexibility: .rigid, intensity: 1.0), trigger: cancelArmed) { _, now in now }
            .sensoryFeedback(.impact(weight: .light, intensity: 0.7), trigger: scrapTick)
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
