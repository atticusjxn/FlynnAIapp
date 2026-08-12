import SwiftUI

/// "Hold it and tell Flynn what to do about what you're looking at."
///
/// Deliberately NOT on every screen. It belongs where there's a specific thing in
/// focus to act on — an invoice, a job, a client — because that's where speaking
/// beats tapping through a form. On a list you're reading, a mic just competes
/// with the screen's actual purpose.
///
/// The context string is sent alongside the transcript so the agent can resolve
/// "add two hours labour at 95" against *this* invoice.
struct ContextualVoiceBar: View {
    /// One factual line: "invoice INV-1042 for Molloy Builders, $1,452 due, overdue".
    let context: String
    /// What to hint at the user when idle.
    var prompt: String
    /// Called after a turn completes, so the screen can reload.
    var onCompleted: () -> Void = {}

    @State private var voice = VoiceCaptureManager()
    @State private var conversation = AgentConversationStore()
    @State private var cancelArmed = false
    @State private var reply: AgentReply?
    @State private var errorText: String?

    struct AgentReply: Identifiable {
        let id = UUID()
        let said: String
        let bubbles: [String]
        let cards: [AgentClient.AgentCard]
    }

    var body: some View {
        FlynnGlassGroup(spacing: FlynnSpacing.xs) {
            HStack(spacing: FlynnSpacing.sm) {
                statusPill
                VoiceHoldButton(
                    voice: voice,
                    onSubmit: { transcript in Task { await send(transcript) } },
                    onCancel: { errorText = nil },
                    onNothingHeard: { errorText = "didn't catch that, hold and try again" },
                    onTapTooQuick: {},   // hold guard already blocks the stray-tap recording
                    onStart: { errorText = nil },
                    onCancelArmedChange: { cancelArmed = $0 }
                )
                .disabled(conversation.isSending)
            }
        }
        .padding(.horizontal, FlynnSpacing.md)
        .padding(.top, FlynnSpacing.md)
        .padding(.bottom, FlynnSpacing.sm)
        // Same grounding scrim as the Home agent bar so content fades into the
        // page behind the floating glass instead of clashing with it.
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
        .sheet(item: $reply) { r in
            ContextualVoiceReplySheet(reply: r) { onCompleted() }
        }
    }

    /// The floating glass pill that mirrors the Home agent bar's field, but shows
    /// state (prompt / live transcript / sending / error) rather than being an
    /// input — on a detail screen you talk, you don't type.
    private var statusPill: some View {
        pillContent
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, FlynnSpacing.md)
            .padding(.vertical, 14)
            .flynnGlass(in: Capsule(style: .continuous), interactive: true)
            .background {
                Capsule(style: .continuous).fill(FlynnColor.backgroundSecondary.opacity(0.72))
            }
            .overlay(
                Capsule(style: .continuous)
                    .strokeBorder(FlynnColor.borderSubtle.opacity(0.6), lineWidth: 1)
            )
            .accessibilityElement(children: .combine)
    }

    @ViewBuilder
    private var pillContent: some View {
        if voice.state == .listening {
            VStack(alignment: .leading, spacing: FlynnSpacing.xxs) {
                HStack(alignment: .center, spacing: FlynnSpacing.xs) {
                    VoiceLevelMeter(level: voice.level, barCount: 4,
                                    tint: cancelArmed ? FlynnColor.textTertiary : FlynnColor.primary)
                    Text(voice.transcript.isEmpty ? "listening…" : voice.transcript)
                        .flynnType(FlynnTypography.bodyMedium)
                        .foregroundColor(cancelArmed ? FlynnColor.textTertiary
                                         : (voice.transcript.isEmpty ? FlynnColor.textTertiary : FlynnColor.textPrimary))
                        .strikethrough(cancelArmed)
                        .lineLimit(2)
                        .fixedSize(horizontal: false, vertical: true)
                }
                VoiceCancelHint(armed: cancelArmed)
            }
        } else if conversation.isSending {
            HStack(spacing: FlynnSpacing.xs) {
                ProgressView().controlSize(.small)
                Text("Flynn's on it…")
                    .flynnType(FlynnTypography.bodyMedium)
                    .foregroundColor(FlynnColor.textSecondary)
            }
        } else if let errorText {
            Text(errorText)
                .flynnType(FlynnTypography.bodyMedium)
                .foregroundColor(FlynnColor.error)
                .lineLimit(2)
        } else {
            Text(prompt)
                .flynnType(FlynnTypography.bodyMedium)
                .foregroundColor(FlynnColor.textSecondary)
                .lineLimit(2)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private func send(_ transcript: String) async {
        await conversation.send(transcript, screenContext: context)
        guard let turn = conversation.turns.last else { return }
        if let error = turn.errorMessage {
            errorText = error
            return
        }
        reply = AgentReply(said: turn.message, bubbles: turn.bubbles, cards: turn.cards)
    }
}

/// What Flynn did about it. Shown over the screen you were looking at rather
/// than sending you back to Home, so you keep your place.
private struct ContextualVoiceReplySheet: View {
    @Environment(\.dismiss) private var dismiss
    let reply: ContextualVoiceBar.AgentReply
    let onDone: () -> Void

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: FlynnSpacing.md) {
                    VStack(alignment: .leading, spacing: FlynnSpacing.xxs) {
                        Text("You said")
                            .flynnType(FlynnTypography.overline)
                            .foregroundColor(FlynnColor.textTertiary)
                        Text(reply.said)
                            .flynnType(FlynnTypography.bodyMedium)
                            .foregroundColor(FlynnColor.textSecondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .padding(FlynnSpacing.md)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .flynnCardSurface(.quiet)
                    .accessibilityElement(children: .combine)

                    ForEach(reply.cards) { card in
                        AgentCardView(card: card) { _ in }
                    }

                    ForEach(Array(reply.bubbles.enumerated()), id: \.offset) { _, bubble in
                        Text(bubble)
                            .flynnType(FlynnTypography.bodyLarge)
                            .foregroundColor(FlynnColor.textPrimary)
                            .fixedSize(horizontal: false, vertical: true)
                            .padding(FlynnSpacing.md)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .flynnCardSurface(.flat)
                    }
                }
                .padding(.horizontal, FlynnSpacing.lg)
                .padding(.vertical, FlynnSpacing.md)
            }
            .background(FlynnColor.background)
            .navigationTitle("Flynn")
            .navigationBarTitleDisplayMode(.inline)
            .safeAreaInset(edge: .bottom) {
                FlynnButton(title: "Done", action: { onDone(); dismiss() }, fullWidth: true)
                    .padding(.horizontal, FlynnSpacing.lg)
                    .padding(.vertical, FlynnSpacing.sm)
                    .background(FlynnColor.background.ignoresSafeArea(edges: .bottom))
            }
        }
        .presentationDetents([.medium, .large])
    }
}
