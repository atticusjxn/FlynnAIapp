import SwiftUI

/// Hands-on practice: a fully simulated Messages thread + a mock Flynn keyboard,
/// so the user rehearses the real gesture once — copy the customer's text →
/// switch to the Flynn keyboard → tap a draft → it inserts → send — WITHOUT
/// needing the real keyboard installed yet (that's the very last step).
struct PracticeStepView: View {
    let onContinue: () -> Void

    @State private var stage: Stage = .copy
    @State private var composed: String = ""

    enum Stage { case copy, switchKeyboard, tapReply, send, done }

    private let customerMessage = "Hey, are you free Saturday to take a look?"
    private let drafts = [
        "Yeah I'm free Saturday! What time suits you?",
        "Saturday works — morning or arvo better for you?",
        "Sure, can do Saturday. Whereabouts are you?"
    ]

    var body: some View {
        VStack(spacing: 0) {
            header
            hintBanner
            thread
            keyboardArea
        }
        .background(FlynnColor.background)
    }

    // MARK: Header

    private var header: some View {
        VStack(alignment: .leading, spacing: FlynnSpacing.xs) {
            Text("Try it")
                .flynnType(FlynnTypography.overline)
                .foregroundColor(FlynnColor.primary)
            Text("Send your first reply with Flynn")
                .flynnType(FlynnTypography.h2)
                .foregroundColor(FlynnColor.textPrimary)
            Text("A quick practice run — this is exactly how it works in Messages.")
                .flynnType(FlynnTypography.bodyMedium)
                .foregroundColor(FlynnColor.textSecondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, FlynnSpacing.lg)
        .padding(.top, FlynnSpacing.lg)
        .padding(.bottom, FlynnSpacing.sm)
    }

    private var hintText: String {
        switch stage {
        case .copy:           return "1. Copy the customer's message"
        case .switchKeyboard: return "2. Switch to the Flynn keyboard"
        case .tapReply:       return "3. Tap the reply that sounds like you"
        case .send:           return "4. Send it 🎉"
        case .done:           return "That's it — you're ready"
        }
    }

    private var hintBanner: some View {
        Text(hintText)
            .flynnType(FlynnTypography.label)
            .foregroundColor(FlynnColor.primary)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(FlynnSpacing.sm)
            .background(FlynnColor.primaryLight)
            .padding(.horizontal, FlynnSpacing.lg)
            .padding(.bottom, FlynnSpacing.sm)
    }

    // MARK: Fake Messages thread

    private var thread: some View {
        VStack(alignment: .leading, spacing: FlynnSpacing.sm) {
            // Inbound customer bubble with a Copy affordance.
            HStack {
                Text(customerMessage)
                    .flynnType(FlynnTypography.bodyMedium)
                    .foregroundColor(FlynnColor.textPrimary)
                    .padding(FlynnSpacing.sm)
                    .background(
                        RoundedRectangle(cornerRadius: FlynnRadii.lg, style: .continuous)
                            .fill(FlynnColor.backgroundSecondary)
                    )
                Spacer(minLength: FlynnSpacing.xl)
            }

            if stage == .copy {
                Button {
                    withAnimation { stage = .switchKeyboard }
                } label: {
                    Label("Copy message", systemImage: "doc.on.doc")
                        .flynnType(FlynnTypography.caption)
                        .foregroundColor(FlynnColor.primary)
                }
            } else {
                Label("Copied", systemImage: "checkmark.circle.fill")
                    .flynnType(FlynnTypography.caption)
                    .foregroundColor(FlynnColor.success)
            }

            // Outbound bubble appears once a draft is inserted.
            if !composed.isEmpty {
                HStack {
                    Spacer(minLength: FlynnSpacing.xl)
                    Text(composed)
                        .flynnType(FlynnTypography.bodyMedium)
                        .foregroundColor(.white)
                        .padding(FlynnSpacing.sm)
                        .background(
                            RoundedRectangle(cornerRadius: FlynnRadii.lg, style: .continuous)
                                .fill(FlynnColor.primary)
                        )
                        .transition(.move(edge: .trailing).combined(with: .opacity))
                }
            }

            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .padding(.horizontal, FlynnSpacing.lg)
    }

    // MARK: Mock keyboard area

    @ViewBuilder
    private var keyboardArea: some View {
        VStack(spacing: FlynnSpacing.sm) {
            // Compose row.
            HStack(spacing: FlynnSpacing.sm) {
                Text(composed.isEmpty ? "Message" : composed)
                    .flynnType(FlynnTypography.bodyMedium)
                    .foregroundColor(composed.isEmpty ? FlynnColor.textTertiary : FlynnColor.textPrimary)
                    .lineLimit(1)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, FlynnSpacing.sm)
                    .frame(height: 40)
                    .background(
                        Capsule().fill(FlynnColor.background)
                    )
                    .overlay(Capsule().stroke(FlynnColor.border, lineWidth: 1))

                Button(action: send) {
                    Image(systemName: "arrow.up.circle.fill")
                        .font(.system(size: 30))
                        .foregroundColor(stage == .send ? FlynnColor.primary : FlynnColor.gray300)
                }
                .disabled(stage != .send)
            }
            .padding(.horizontal, FlynnSpacing.md)
            .padding(.top, FlynnSpacing.sm)

            mockKeyboard
        }
        .background(FlynnColor.backgroundSecondary)
    }

    @ViewBuilder
    private var mockKeyboard: some View {
        switch stage {
        case .copy:
            keyboardPlaceholder(text: "Copy the message above to begin")
        case .switchKeyboard:
            // The "globe" switch — tap to bring up the Flynn keyboard.
            VStack(spacing: FlynnSpacing.sm) {
                keyboardPlaceholder(text: "Your normal keyboard")
                Button {
                    withAnimation { stage = .tapReply }
                } label: {
                    Label("Switch to Flynn", systemImage: "globe")
                        .flynnType(FlynnTypography.button)
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .frame(height: 44)
                        .background(RoundedRectangle(cornerRadius: FlynnRadii.md, style: .continuous).fill(FlynnColor.primary))
                }
                .padding(.horizontal, FlynnSpacing.md)
            }
            .padding(.bottom, FlynnSpacing.md)
        case .tapReply, .send, .done:
            flynnKeyboard
        }
    }

    private var flynnKeyboard: some View {
        VStack(alignment: .leading, spacing: FlynnSpacing.xs) {
            Text("Flynn")
                .flynnType(FlynnTypography.caption)
                .foregroundColor(FlynnColor.textSecondary)
                .padding(.horizontal, FlynnSpacing.md)
            ForEach(Array(drafts.enumerated()), id: \.offset) { _, draft in
                Button {
                    withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) {
                        composed = draft
                        stage = .send
                    }
                } label: {
                    Text(draft)
                        .flynnType(FlynnTypography.bodyMedium)
                        .foregroundColor(FlynnColor.textPrimary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(FlynnSpacing.sm)
                        .background(
                            RoundedRectangle(cornerRadius: FlynnRadii.md, style: .continuous)
                                .fill(FlynnColor.background)
                        )
                        .brutalistBorder(cornerRadius: FlynnRadii.md)
                }
                .padding(.horizontal, FlynnSpacing.md)
            }
        }
        .padding(.vertical, FlynnSpacing.sm)
    }

    private func keyboardPlaceholder(text: String) -> some View {
        Text(text)
            .flynnType(FlynnTypography.caption)
            .foregroundColor(FlynnColor.textTertiary)
            .frame(maxWidth: .infinity)
            .frame(height: 120)
            .background(FlynnColor.background)
    }

    private func send() {
        guard stage == .send else { return }
        withAnimation { stage = .done }
        // Brief beat so the user sees the sent bubble, then continue.
        Task {
            try? await Task.sleep(for: .milliseconds(700))
            onContinue()
        }
    }
}
