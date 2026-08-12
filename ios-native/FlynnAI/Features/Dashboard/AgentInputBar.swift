import SwiftUI

/// The Home screen's persistent input — "hold to talk, or type" — the
/// centrepiece of the agent-first pivot.
///
/// It floats as a Liquid Glass capsule lifted off the tab bar, rather than a
/// full-width slab pinned flush to the bottom edge (which read as cramped and
/// sat too low, right on top of the tab bar). Pinned via
/// `.safeAreaInset(edge: .bottom)` on DashboardView so it never scrolls away and
/// the keyboard never covers it.
struct AgentInputBar: View {
    @Bindable var conversation: AgentConversationStore
    @State private var voice = VoiceCaptureManager()
    @State private var draft: String = ""
    /// What the user had typed before they started holding the mic. The
    /// transcript is appended to this rather than replacing it, so starting a
    /// voice note no longer destroys a half-typed message.
    @State private var draftBeforeVoice: String = ""
    @State private var nothingHeard = false
    @State private var tapHint = false
    /// Slide-to-cancel: armed once the finger has travelled far enough from the
    /// mic while holding. Releasing armed discards instead of sending.
    @State private var cancelArmed = false
    @State private var didCancel = false
    @FocusState private var isFocused: Bool

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
            statusRow

            FlynnGlassGroup(spacing: FlynnSpacing.xs) {
                HStack(spacing: FlynnSpacing.sm) {
                    field

                    // A single trailing control that morphs: the mic when
                    // there's nothing typed (and while listening), the send
                    // arrow the moment there's a draft to send. One control
                    // reads calmer than a mic and a send button side by side.
                    if hasDraft && !isListening {
                        sendButton
                            .transition(.scale.combined(with: .opacity))
                    } else {
                        micButton
                            .transition(.scale.combined(with: .opacity))
                    }
                }
            }
            .animation(.spring(response: 0.3, dampingFraction: 0.72), value: hasDraft)
            .animation(.spring(response: 0.3, dampingFraction: 0.72), value: isListening)
        }
        .padding(.horizontal, FlynnSpacing.md)
        .padding(.top, FlynnSpacing.md)
        .padding(.bottom, FlynnSpacing.sm)
        // Ground the floating bar: fade the scrolling content into the page
        // background as it passes behind the glass, so text never clashes with
        // the input. The glass capsule then floats over a clean fade rather than
        // over live content.
        .background(
            LinearGradient(
                stops: [
                    .init(color: FlynnColor.background.opacity(0), location: 0),
                    .init(color: FlynnColor.background.opacity(0.96), location: 0.4),
                    .init(color: FlynnColor.background, location: 0.75),
                ],
                startPoint: .top, endPoint: .bottom
            )
            .ignoresSafeArea(edges: .bottom)
            .allowsHitTesting(false)
        )
    }

    // MARK: - Field

    private var field: some View {
        TextField("Ask Flynn, or hold to talk", text: $draft, axis: .vertical)
            .flynnType(FlynnTypography.bodyLarge)
            .foregroundColor(FlynnColor.textPrimary)
            .lineLimit(1...4)
            .focused($isFocused)
            .padding(.horizontal, FlynnSpacing.md)
            .padding(.vertical, 14)
            .frame(maxWidth: .infinity)
            .flynnGlass(in: Capsule(style: .continuous), interactive: true)
            // A semi-opaque fill sits behind the glass so typed text and the
            // placeholder stay legible over whatever is scrolling underneath —
            // real Liquid Glass is translucent by design and clear glass over
            // high-contrast content is unreadable.
            .background {
                Capsule(style: .continuous).fill(FlynnColor.backgroundSecondary.opacity(0.72))
            }
            .overlay(
                Capsule(style: .continuous)
                    .strokeBorder(
                        isFocused ? FlynnColor.primary.opacity(0.55) : FlynnColor.borderSubtle.opacity(0.6),
                        lineWidth: isFocused ? 1.5 : 1
                    )
            )
            .disabled(isListening)
            .onChange(of: voice.transcript) { _, newValue in
                guard isListening else { return }
                draft = merged(with: newValue)
            }
            // Multi-line (axis: .vertical) means Return inserts a newline, so a
            // keyboard toolbar Done is the only way off the keyboard here.
            .toolbar {
                ToolbarItemGroup(placement: .keyboard) {
                    Spacer()
                    Button("Done") { isFocused = false }
                }
            }
    }

    // MARK: - Status row (listening transcript, errors, hints)

    @ViewBuilder
    private var statusRow: some View {
        if isListening {
            listeningHint
        } else if case .error(let message) = voice.state {
            hintText(message, color: FlynnColor.error)
        } else if voice.state == .denied {
            hintText("Turn on microphone + speech recognition in Settings to talk to Flynn.", color: FlynnColor.textTertiary)
        } else if didCancel {
            hintText("scrapped that one", color: FlynnColor.textTertiary)
        } else if tapHint {
            hintText("hold the mic to talk", color: FlynnColor.textTertiary)
        } else if nothingHeard {
            hintText("didn't catch that, hold the mic and try again", color: FlynnColor.textTertiary)
        }
    }

    private func hintText(_ text: String, color: Color) -> some View {
        Text(text)
            .flynnType(FlynnTypography.caption)
            .foregroundColor(color)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, FlynnSpacing.sm)
            .transition(.opacity)
    }

    /// Live transcript while holding, in a glass card so it reads as one piece
    /// with the bar below it. Body-sized and multi-line — as a caption the words
    /// were too small to read, which is the whole point of showing them.
    private var listeningHint: some View {
        VStack(alignment: .leading, spacing: FlynnSpacing.xxs) {
            HStack(alignment: .top, spacing: FlynnSpacing.xs) {
                VoiceLevelMeter(
                    level: voice.level,
                    barCount: 4,
                    tint: cancelArmed ? FlynnColor.textTertiary : FlynnColor.error
                )
                .padding(.top, 2)

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
            VoiceCancelHint(armed: cancelArmed)
        }
        .padding(.horizontal, FlynnSpacing.md)
        .padding(.vertical, FlynnSpacing.sm)
        .flynnGlass(in: RoundedRectangle(cornerRadius: FlynnRadii.lg, style: .continuous))
        .transition(.opacity.combined(with: .move(edge: .bottom)))
        // One element with a live-updating value, so VoiceOver reads the
        // transcript as it grows instead of announcing a pulsing dot.
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Listening")
        .accessibilityValue(voice.transcript.isEmpty ? "No speech heard yet" : voice.transcript)
        .accessibilityAddTraits(.updatesFrequently)
    }

    private var isListening: Bool { voice.state == .listening }

    // MARK: - Controls

    private var micButton: some View {
        VoiceHoldButton(
            voice: voice,
            onSubmit: { transcript in
                let text = merged(with: transcript)
                guard !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
                    showHint { nothingHeard = true }
                    return
                }
                draft = ""
                draftBeforeVoice = ""
                Task { await conversation.send(text) }
            },
            onCancel: {
                draft = draftBeforeVoice
                draftBeforeVoice = ""
                showHint { didCancel = true }
            },
            onNothingHeard: { showHint { nothingHeard = true } },
            onTapTooQuick: { showHint { tapHint = true } },
            onStart: {
                nothingHeard = false
                didCancel = false
                tapHint = false
                isFocused = false
                draftBeforeVoice = draft
            },
            onCancelArmedChange: { cancelArmed = $0 }
        )
    }

    /// Show one transient hint, clearing the others, then clear it after a beat.
    /// The three hints (nothing heard / scrapped / hold-to-talk) share one
    /// debounce so a fast retry doesn't stack them.
    private func showHint(_ set: () -> Void) {
        nothingHeard = false; didCancel = false; tapHint = false
        set()
        Task { @MainActor in
            try? await Task.sleep(for: .seconds(2))
            nothingHeard = false; didCancel = false; tapHint = false
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
                .font(.system(size: 20, weight: .semibold))
                .foregroundColor(FlynnColor.textInverse)
                .frame(width: 52, height: 52)
                .background(
                    Circle()
                        .fill(FlynnColor.primary)
                        .overlay(
                            Circle().fill(
                                LinearGradient(colors: [.white.opacity(0.28), .clear],
                                               startPoint: .top, endPoint: .center)
                            )
                        )
                )
                .overlay(Circle().strokeBorder(Color.white.opacity(0.22), lineWidth: 1))
                .shadow(color: FlynnColor.primary.opacity(conversation.isSending ? 0 : 0.4), radius: 10, y: 4)
                .opacity(conversation.isSending ? 0.6 : 1)
                .animation(.easeOut(duration: 0.15), value: conversation.isSending)
        }
        .disabled(conversation.isSending)
        .accessibilityLabel(conversation.isSending ? "Sending" : "Send")
        .accessibilityHint("Sends your message to Flynn")
    }
}
