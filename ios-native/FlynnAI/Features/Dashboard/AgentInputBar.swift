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
    @State private var voice = VoiceCaptureManager()
    @State private var draft: String = ""
    /// What the user had typed before they started holding the mic. The
    /// transcript is appended to this rather than replacing it, so starting a
    /// voice note no longer destroys a half-typed message.
    @State private var draftBeforeVoice: String = ""
    @State private var isHolding = false
    @State private var pulse = false
    @State private var nothingHeard = false
    @FocusState private var isFocused: Bool

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

                micButton

                if !draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    sendButton
                }
            }
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
        HStack(alignment: .top, spacing: FlynnSpacing.xs) {
            Circle()
                .fill(FlynnColor.error)
                .frame(width: 8, height: 8)
                .scaleEffect(pulse ? 1.35 : 0.85)
                .animation(.easeInOut(duration: 0.6).repeatForever(autoreverses: true), value: pulse)
                .padding(.top, 6)

            Text(voice.transcript.isEmpty ? "listening…" : voice.transcript)
                .flynnType(FlynnTypography.bodyMedium)
                .foregroundColor(voice.transcript.isEmpty ? FlynnColor.textTertiary : FlynnColor.textPrimary)
                .lineLimit(3)
                .fixedSize(horizontal: false, vertical: true)
                .animation(.easeOut(duration: 0.12), value: voice.transcript)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.horizontal, FlynnSpacing.xxs)
        .transition(.opacity.combined(with: .move(edge: .bottom)))
        .onAppear { pulse = true }
        .onDisappear { pulse = false }
    }

    private var isListening: Bool { voice.state == .listening }

    private var micButton: some View {
        Image(systemName: isListening ? "waveform" : "mic.fill")
            .font(.system(size: isListening ? 20 : 17, weight: .semibold))
            .foregroundColor(isListening ? FlynnColor.white : FlynnColor.primary)
            .frame(width: 44, height: 44)
            .background(Circle().fill(isListening ? FlynnColor.primary : FlynnColor.background))
            .overlay(Circle().stroke(isListening ? FlynnColor.primary : FlynnColor.border, lineWidth: 2))
            // Expanding ring while held — reads as "live" at the size a phone
            // screen ends up in a video frame.
            .overlay(
                Circle()
                    .stroke(FlynnColor.primary, lineWidth: 2)
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
            .scaleEffect(isListening ? 1.28 : 1.0)
            .animation(.spring(response: 0.3, dampingFraction: 0.6), value: isListening)
            .sensoryFeedback(.impact(weight: .medium), trigger: isListening)
            // Press-and-hold: gesture fires start on press, stop + send on release.
            .simultaneousGesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { _ in
                        // onChanged fires on every touch movement, not just on
                        // press. Latch locally so one hold starts one session —
                        // voice.state can't do this, it turns .listening only
                        // after the async start finishes.
                        guard !isHolding else { return }
                        isHolding = true
                        nothingHeard = false
                        isFocused = false
                        draftBeforeVoice = draft
                        Task { await voice.startListening() }
                    }
                    .onEnded { _ in
                        endHold()
                    }
            )
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

    private func endHold() {
        isHolding = false
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
                .foregroundColor(FlynnColor.white)
                .frame(width: 44, height: 44)
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
    }
}
