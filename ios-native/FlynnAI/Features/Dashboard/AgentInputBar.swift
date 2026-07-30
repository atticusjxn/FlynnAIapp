import SwiftUI

/// The Home screen's persistent bottom bar — "hold a button, talk or type" —
/// the centrepiece of the agent-first pivot
/// (~/.claude/plans/iridescent-floating-moore.md). Pinned via
/// `.safeAreaInset(edge: .bottom)` on DashboardView so it never scrolls away
/// and never gets pushed offscreen by the keyboard (see the plan's "no
/// keyboard blocking text" quality bar).
struct AgentInputBar: View {
    @Bindable var conversation: AgentConversationStore
    @State private var voice = VoiceCaptureManager()
    @State private var draft: String = ""
    /// What the user had typed before they started holding the mic. The
    /// transcript is appended to this rather than replacing it, so starting a
    /// voice note no longer destroys a half-typed message.
    @State private var draftBeforeVoice: String = ""
    @State private var nothingHeard = false
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
                VoiceLevelMeter(
                    level: voice.level,
                    barCount: 4,
                    tint: cancelArmed ? FlynnColor.textTertiary : FlynnColor.error
                )
                .padding(.top, 1)

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
        .padding(.horizontal, FlynnSpacing.xxs)
        .transition(.opacity.combined(with: .move(edge: .bottom)))
        // One element with a live-updating value, so VoiceOver reads the
        // transcript as it grows instead of announcing a pulsing dot.
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Listening")
        .accessibilityValue(voice.transcript.isEmpty ? "No speech heard yet" : voice.transcript)
        .accessibilityAddTraits(.updatesFrequently)
    }

    private var isListening: Bool { voice.state == .listening }

    private var micButton: some View {
        VoiceHoldButton(
            voice: voice,
            onSubmit: { transcript in
                let text = merged(with: transcript)
                guard !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
                    nothingHeard = true
                    return
                }
                draft = ""
                draftBeforeVoice = ""
                Task { await conversation.send(text) }
            },
            onCancel: {
                // Put back whatever was typed before the hold started.
                draft = draftBeforeVoice
                draftBeforeVoice = ""
                didCancel = true
                Task {
                    try? await Task.sleep(for: .seconds(2))
                    didCancel = false
                }
            },
            onNothingHeard: { nothingHeard = true },
            onStart: {
                nothingHeard = false
                didCancel = false
                isFocused = false
                draftBeforeVoice = draft
            },
            onCancelArmedChange: { cancelArmed = $0 }
        )
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
