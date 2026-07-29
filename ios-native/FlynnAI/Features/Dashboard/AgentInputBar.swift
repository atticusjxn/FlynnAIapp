import SwiftUI

/// The Home screen's persistent bottom bar — "hold a button, talk or type" —
/// the centrepiece of the agent-first pivot
/// (~/.claude/plans/iridescent-floating-moore.md). Pinned via
/// `.safeAreaInset(edge: .bottom)` on DashboardView so it never scrolls away
/// and never gets pushed offscreen by the keyboard (see the plan's "no
/// keyboard blocking text" quality bar).
struct AgentInputBar: View {
    @Bindable var conversation: AgentConversationStore
    @Environment(\.scenePhase) private var scenePhase
    /// VoiceOver reserves double-tap-and-hold for its own gestures, so a
    /// press-and-hold control is simply unusable with it on. When it's running
    /// the mic becomes tap-to-start / tap-to-send instead.
    @Environment(\.accessibilityVoiceOverEnabled) private var voiceOverEnabled
    @State private var voice = VoiceCaptureManager()
    @State private var draft: String = ""
    /// What the user had typed before they started holding the mic. The
    /// transcript is appended to this rather than replacing it, so starting a
    /// voice note no longer destroys a half-typed message.
    @State private var draftBeforeVoice: String = ""
    @State private var isHolding = false
    @State private var pulse = false
    @State private var nothingHeard = false
    /// Slide-to-cancel: armed once the finger has travelled far enough from the
    /// mic while holding. Releasing armed discards instead of sending.
    @State private var cancelArmed = false
    @State private var dragDistance: CGFloat = 0
    @State private var didCancel = false
    @FocusState private var isFocused: Bool

    /// How far the finger has to travel from the mic before a release cancels.
    private let cancelThreshold: CGFloat = 90
    private let micSize: CGFloat = 58

    private var hasDraft: Bool {
        !draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    /// Draft plus whatever has been transcribed so far.
    private func merged(with transcript: String) -> String {
        let base = draftBeforeVoice.trimmingCharacters(in: .whitespacesAndNewlines)
        let heard = transcript.trimmingCharacters(in: .whitespacesAndNewlines)
        if base.isEmpty { return heard }
        if heard.isEmpty { return base }
        return base + " " + heard
    }

    var body: some View {
        VStack(spacing: FlynnSpacing.xs) {
            if isListening {
                listeningHint
            } else if case .error(let message) = voice.state {
                Text(message)
                    .flynnType(FlynnTypography.caption)
                    .foregroundColor(FlynnColor.error)
            } else if voice.state == .denied {
                Text("Turn on microphone + speech recognition in Settings to talk to Flynn.")
                    .flynnType(FlynnTypography.caption)
                    .foregroundColor(FlynnColor.textTertiary)
            } else if didCancel {
                Text("scrapped that one")
                    .flynnType(FlynnTypography.caption)
                    .foregroundColor(FlynnColor.textTertiary)
            } else if nothingHeard {
                // Releasing the mic with an empty transcript used to do nothing
                // at all, which is indistinguishable from the feature being
                // broken. Say so instead.
                Text("didn't catch that, hold the mic and try again")
                    .flynnType(FlynnTypography.caption)
                    .foregroundColor(FlynnColor.textTertiary)
            }

            HStack(spacing: FlynnSpacing.sm) {
                TextField("Text Flynn…", text: $draft, axis: .vertical)
                    .flynnType(FlynnTypography.bodyMedium)
                    .lineLimit(1...4)
                    .focused($isFocused)
                    .padding(.horizontal, FlynnSpacing.sm)
                    .padding(.vertical, FlynnSpacing.xs)
                    .background(RoundedRectangle(cornerRadius: FlynnRadii.md, style: .continuous).fill(FlynnColor.background))
                    .brutalistBorder(cornerRadius: FlynnRadii.md, color: isFocused ? FlynnColor.borderFocus : FlynnColor.border)
                    .disabled(voice.state == .listening)
                    .onChange(of: voice.transcript) { _, newValue in
                        guard voice.state == .listening else { return }
                        draft = merged(with: newValue)
                    }
                    // The field is multi-line (axis: .vertical), so Return
                    // inserts a newline and can't dismiss. Without this there
                    // is no way off the keyboard at all once it's up.
                    .toolbar {
                        ToolbarItemGroup(placement: .keyboard) {
                            Spacer()
                            Button("Done") { isFocused = false }
                        }
                    }

                // Send sits INSIDE the mic's leading side, so the mic itself
                // stays pinned to the trailing edge. It used to be the other way
                // round, which slid the primary control out from under the
                // user's thumb the moment they started typing.
                if hasDraft && !isListening {
                    sendButton
                        .transition(.scale.combined(with: .opacity))
                }

                micButton
            }
            .animation(.spring(response: 0.28, dampingFraction: 0.75), value: hasDraft)
        }
        .padding(.horizontal, FlynnSpacing.md)
        .padding(.top, FlynnSpacing.sm)
        .padding(.bottom, FlynnSpacing.xs)
        .background(
            FlynnColor.backgroundSecondary
                .ignoresSafeArea(edges: .bottom)
                .shadow(color: .black.opacity(0.08), radius: 8, y: -2)
        )
    }

    /// Live transcript while holding. Deliberately body-sized and multi-line:
    /// as a one-line caption the words were too small to read on a phone
    /// screen, which is the whole point of showing them.
    private var listeningHint: some View {
        VStack(alignment: .leading, spacing: FlynnSpacing.xxs) {
            HStack(alignment: .top, spacing: FlynnSpacing.xs) {
                Circle()
                    .fill(cancelArmed ? FlynnColor.textTertiary : FlynnColor.error)
                    .frame(width: 8, height: 8)
                    .scaleEffect(pulse ? 1.35 : 0.85)
                    .animation(.easeInOut(duration: 0.6).repeatForever(autoreverses: true), value: pulse)
                    .padding(.top, 6)

                Text(voice.transcript.isEmpty ? "listening…" : voice.transcript)
                    .flynnType(FlynnTypography.bodyMedium)
                    .foregroundColor(
                        cancelArmed ? FlynnColor.textTertiary
                            : (voice.transcript.isEmpty ? FlynnColor.textTertiary : FlynnColor.textPrimary)
                    )
                    .strikethrough(cancelArmed)
                    .lineLimit(3)
                    .fixedSize(horizontal: false, vertical: true)
                    .animation(.easeOut(duration: 0.12), value: voice.transcript)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }

            // Slide-to-cancel affordance. The chevrons drift toward the finger
            // as it travels, so the gesture teaches itself.
            HStack(spacing: FlynnSpacing.xxs) {
                Image(systemName: cancelArmed ? "trash.fill" : "chevron.left")
                    .font(.system(size: 11, weight: .bold))
                Text(cancelArmed ? "release to scrap" : "slide left to cancel")
                    .flynnType(FlynnTypography.caption)
            }
            .foregroundColor(cancelArmed ? FlynnColor.error : FlynnColor.textTertiary)
            .opacity(cancelArmed ? 1 : max(0.35, 1 - dragDistance / cancelThreshold))
            .offset(x: -min(dragDistance, cancelThreshold) * 0.25)
            .animation(.easeOut(duration: 0.15), value: cancelArmed)
        }
        .padding(.horizontal, FlynnSpacing.xxs)
        .transition(.opacity.combined(with: .move(edge: .bottom)))
        .onAppear { pulse = true }
        .onDisappear { pulse = false }
        // One element with a live-updating value, so VoiceOver reads the
        // transcript as it grows instead of announcing a pulsing dot.
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Listening")
        .accessibilityValue(voice.transcript.isEmpty ? "No speech heard yet" : voice.transcript)
        .accessibilityAddTraits(.updatesFrequently)
    }

    private var isListening: Bool { voice.state == .listening }

    @ViewBuilder
    private var micButton: some View {
        Group {
            if voiceOverEnabled {
                // Tap to start, tap again to send. Same underlying calls as the
                // hold path, just driven by activation instead of a drag.
                Button {
                    if isListening {
                        endHold()
                    } else {
                        isHolding = true
                        nothingHeard = false
                        isFocused = false
                        draftBeforeVoice = draft
                        Task { await voice.startListening() }
                    }
                } label: {
                    micVisual
                }
                .buttonStyle(.plain)
            } else {
                micVisual.simultaneousGesture(holdGesture)
            }
        }
        .accessibilityLabel(isListening ? "Stop and send" : "Talk to Flynn")
        .accessibilityHint(
            voiceOverEnabled
                ? (isListening ? "Double tap to stop recording and send" : "Double tap to start recording")
                : "Hold to talk, release to send"
        )
        .accessibilityAddTraits(.isButton)
        // The latch above is the only thing gating a new hold, and onEnded
        // does not fire if the gesture is interrupted — an incoming call, a
        // backgrounding, or the view losing identity. Without these resets
        // isHolding stays true forever and the mic silently stops responding
        // to every subsequent press.
        .onChange(of: scenePhase) { _, phase in
            guard phase != .active, isHolding else { return }
            isHolding = false
            if voice.state == .listening { voice.stopListening() }
        }
        .onDisappear {
            isHolding = false
            if voice.state == .listening { voice.stopListening() }
        }
    }

    private var holdGesture: some Gesture {
        DragGesture(minimumDistance: 0)
            .onChanged { value in
                // onChanged fires on every touch movement, not just on
                // press. Latch locally so one hold starts one session —
                // voice.state can't do this, it turns .listening only
                // after the async start finishes.
                if !isHolding {
                    isHolding = true
                    nothingHeard = false
                    didCancel = false
                    cancelArmed = false
                    dragDistance = 0
                    isFocused = false
                    draftBeforeVoice = draft
                    Task { await voice.startListening() }
                    return
                }
                // Leftward or upward travel both count — thumbs arc, they don't
                // slide in a straight line.
                let travel = max(-value.translation.width, -value.translation.height)
                dragDistance = max(0, travel)
                let armed = dragDistance >= cancelThreshold
                if armed != cancelArmed { cancelArmed = armed }
            }
            .onEnded { _ in
                if cancelArmed {
                    cancelHold()
                } else {
                    endHold()
                }
            }
    }

    /// Discard without sending. The transcript is thrown away and the draft is
    /// restored to whatever was typed before the hold started.
    private func cancelHold() {
        isHolding = false
        cancelArmed = false
        dragDistance = 0
        if voice.state == .listening { voice.stopListening() }
        draft = draftBeforeVoice
        draftBeforeVoice = ""
        didCancel = true
        Task {
            try? await Task.sleep(for: .seconds(2))
            didCancel = false
        }
    }

    private var micFill: Color {
        if cancelArmed { return FlynnColor.error }
        return isListening ? FlynnColor.primary : FlynnColor.backgroundSecondary
    }

    private var micVisual: some View {
        Image(systemName: cancelArmed ? "xmark" : (isListening ? "waveform" : "mic.fill"))
            .font(.system(size: isListening ? 24 : 22, weight: .semibold))
            .foregroundColor(isListening || cancelArmed ? FlynnColor.textInverse : FlynnColor.primary)
            .frame(width: micSize, height: micSize)
            .background(Circle().fill(micFill))
            .overlay(
                Circle().stroke(
                    cancelArmed ? FlynnColor.error : (isListening ? FlynnColor.primary : FlynnColor.border),
                    lineWidth: FlynnStroke.outline
                )
            )
            // Expanding ring while held — reads as "live" at the size a phone
            // screen ends up in a video frame.
            .overlay(
                Circle()
                    .stroke(cancelArmed ? FlynnColor.error : FlynnColor.primary, lineWidth: 2)
                    .scaleEffect(isListening && pulse ? 1.75 : 1.0)
                    .opacity(isListening && pulse ? 0 : 0.55)
                    .animation(
                        isListening
                            ? .easeOut(duration: 1.1).repeatForever(autoreverses: false)
                            : .default,
                        value: pulse
                    )
                    .allowsHitTesting(false)
            )
            .scaleEffect(isListening ? (cancelArmed ? 1.05 : 1.22) : 1.0)
            .animation(.spring(response: 0.3, dampingFraction: 0.6), value: isListening)
            .animation(.spring(response: 0.25, dampingFraction: 0.7), value: cancelArmed)
            // Three distinct beats so the control is legible without looking at
            // it: a firm thump when recording starts, a sharp tick when the
            // cancel threshold is crossed, and a success chime on send.
            .sensoryFeedback(.impact(weight: .heavy, intensity: 0.9), trigger: isListening) { _, now in now }
            .sensoryFeedback(.impact(flexibility: .rigid, intensity: 1.0), trigger: cancelArmed) { _, now in now }
            .sensoryFeedback(.success, trigger: conversation.isSending) { _, now in now }
            .sensoryFeedback(.impact(weight: .light), trigger: didCancel) { _, now in now }
    }

    private func endHold() {
        isHolding = false
        cancelArmed = false
        dragDistance = 0
        guard voice.state == .listening else { return }
        voice.stopListening()
        // The recognizer keeps finalising briefly after stopListening(); give it
        // a beat before sending so we capture the tail of what was said.
        Task {
            try? await Task.sleep(for: .milliseconds(400))
            let text = merged(with: voice.transcript)
            guard !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
                nothingHeard = true
                return
            }
            draft = ""
            draftBeforeVoice = ""
            await conversation.send(text)
        }
    }

    private var sendButton: some View {
        Button {
            let text = draft
            draft = ""
            draftBeforeVoice = ""
            isFocused = false
            Task { await conversation.send(text) }
        } label: {
            Image(systemName: conversation.isSending ? "ellipsis" : "arrow.up")
                .font(.system(size: 18, weight: .semibold))
                .foregroundColor(FlynnColor.textInverse)
                // Deliberately smaller than the mic: voice is the primary
                // action on this bar, typing is the fallback.
                .frame(width: 48, height: 48)
                // Glass treatment to match FlynnGlassButton / the hosted
                // invoice page: brand gradient, inner top sheen, soft glow.
                .background(
                    ZStack {
                        // Shares the gradient with FlynnGlassButton rather than
                        // re-declaring it — this was a copy that drifted.
                        FlynnGlassVariant.primary.gradient
                        LinearGradient(
                            stops: [
                                .init(color: .white.opacity(0.42), location: 0),
                                .init(color: .white.opacity(0.08), location: 0.45),
                                .init(color: .white.opacity(0), location: 0.62),
                            ],
                            startPoint: .top, endPoint: .bottom
                        )
                    }
                )
                .clipShape(Circle())
                .overlay(Circle().strokeBorder(Color.white.opacity(0.3), lineWidth: 1))
                .shadow(
                    color: FlynnColor.primary.opacity(conversation.isSending ? 0 : 0.42),
                    radius: 10, x: 0, y: 4
                )
                // Without this the button looks identical while a send is in
                // flight, so a second tap reads as the app ignoring you.
                .opacity(conversation.isSending ? 0.5 : 1)
                .animation(.easeOut(duration: 0.15), value: conversation.isSending)
        }
        .disabled(conversation.isSending)
        .accessibilityLabel(conversation.isSending ? "Sending" : "Send")
        .accessibilityHint("Sends your message to Flynn")
    }
}
