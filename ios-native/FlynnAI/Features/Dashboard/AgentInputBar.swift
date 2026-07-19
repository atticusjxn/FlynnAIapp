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
    @FocusState private var isFocused: Bool

    var body: some View {
        VStack(spacing: FlynnSpacing.xxs) {
            if voice.state == .listening {
                listeningHint
            } else if case .error(let message) = voice.state {
                Text(message)
                    .flynnType(FlynnTypography.caption)
                    .foregroundColor(FlynnColor.error)
            } else if voice.state == .denied {
                Text("Turn on microphone + speech recognition in Settings to talk to Flynn.")
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
                        draft = newValue
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

    private var listeningHint: some View {
        HStack(spacing: FlynnSpacing.xxs) {
            Circle().fill(FlynnColor.error).frame(width: 8, height: 8)
            Text(voice.transcript.isEmpty ? "listening…" : voice.transcript)
                .flynnType(FlynnTypography.caption)
                .foregroundColor(FlynnColor.textSecondary)
                .lineLimit(1)
        }
    }

    private var micButton: some View {
        Image(systemName: voice.state == .listening ? "waveform" : "mic.fill")
            .foregroundColor(voice.state == .listening ? FlynnColor.white : FlynnColor.primary)
            .frame(width: 44, height: 44)
            .background(Circle().fill(voice.state == .listening ? FlynnColor.primary : FlynnColor.background))
            .overlay(Circle().stroke(FlynnColor.border, lineWidth: 2))
            .scaleEffect(voice.state == .listening ? 1.08 : 1.0)
            .animation(.easeOut(duration: 0.15), value: voice.state)
            // Press-and-hold: gesture fires start on press, stop + send on release.
            .simultaneousGesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { _ in
                        guard voice.state != .listening else { return }
                        isFocused = false
                        Task { await voice.startListening() }
                    }
                    .onEnded { _ in
                        guard voice.state == .listening else { return }
                        voice.stopListening()
                        // The recognizer keeps finalising briefly after
                        // stopListening(); give it a beat before sending so we
                        // capture the tail of what was said.
                        Task {
                            try? await Task.sleep(for: .milliseconds(400))
                            let text = voice.transcript
                            if !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                                draft = ""
                                await conversation.send(text)
                            }
                        }
                    }
            )
    }

    private var sendButton: some View {
        Button {
            let text = draft
            draft = ""
            isFocused = false
            Task { await conversation.send(text) }
        } label: {
            Image(systemName: "arrow.up")
                .foregroundColor(FlynnColor.white)
                .frame(width: 44, height: 44)
                // Glass treatment to match FlynnGlassButton / the hosted
                // invoice page: brand gradient, inner top sheen, soft glow.
                .background(
                    ZStack {
                        LinearGradient(
                            colors: [Color(hex: "#ff8a4c"), FlynnColor.primary, Color(hex: "#d94e1c")],
                            startPoint: .top, endPoint: .bottom
                        )
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
                .shadow(color: FlynnColor.primary.opacity(0.42), radius: 10, x: 0, y: 4)
        }
        .disabled(conversation.isSending)
    }
}
