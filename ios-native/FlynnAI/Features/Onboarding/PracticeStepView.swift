import SwiftUI

/// Hands-on practice: a fully simulated Messages thread + a mock Flynn keyboard,
/// so the user rehearses the real gesture once — copy the message →
/// switch to the Flynn keyboard → tap a draft → it inserts → send — WITHOUT
/// needing the real keyboard installed yet (that's the very last step).
/// Rendered on the cream onboarding surface; kept clean so the thread reads well.
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
        .background(OB.cream.ignoresSafeArea())
        .environment(\.colorScheme, .light)
    }

    // MARK: Header

    private var header: some View {
        OnboardingHeadline(
            eyebrow: "Try it",
            title: "Send your first",
            accentTitle: "reply with Flynn",
            subtitle: "A quick practice run — this is exactly how it works in Messages."
        )
        .padding(.horizontal, 24)
        .padding(.top, 8)
        .padding(.bottom, 12)
    }

    private var hintText: String {
        switch stage {
        case .copy:           return "1. Copy the message"
        case .switchKeyboard: return "2. Switch to the Flynn keyboard"
        case .tapReply:       return "3. Tap the reply that sounds like you"
        case .send:           return "4. Send it 🎉"
        case .done:           return "That's it — you're ready"
        }
    }

    private var hintBanner: some View {
        Text(hintText)
            .font(.custom(FlynnFontName.interMedium, size: 14))
            .foregroundColor(OB.ink)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(12)
            .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(OB.mustard.opacity(0.30)))
            .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(OB.ink, lineWidth: OB.outline))
            .padding(.horizontal, 24)
            .padding(.bottom, 12)
    }

    // MARK: Fake Messages thread

    private var thread: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text(customerMessage)
                    .font(.custom(FlynnFontName.interRegular, size: 15))
                    .foregroundColor(OB.ink)
                    .padding(12)
                    .background(RoundedRectangle(cornerRadius: 18, style: .continuous).fill(OB.card))
                    .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).stroke(OB.ink, lineWidth: OB.outline))
                Spacer(minLength: 40)
            }

            if stage == .copy {
                Button { withAnimation { stage = .switchKeyboard } } label: {
                    Label("Copy message", systemImage: "doc.on.doc")
                        .font(.custom(FlynnFontName.interMedium, size: 13))
                        .foregroundColor(OB.orange)
                }
                .buttonStyle(.plain)
            } else {
                Label("Copied", systemImage: "checkmark.circle.fill")
                    .font(.custom(FlynnFontName.interMedium, size: 13))
                    .foregroundColor(OB.teal)
            }

            if !composed.isEmpty {
                HStack {
                    Spacer(minLength: 40)
                    Text(composed)
                        .font(.custom(FlynnFontName.interRegular, size: 15))
                        .foregroundColor(OB.card)
                        .padding(12)
                        .background(RoundedRectangle(cornerRadius: 18, style: .continuous).fill(OB.orange))
                        .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).stroke(OB.ink, lineWidth: OB.outline))
                        .transition(.move(edge: .trailing).combined(with: .opacity))
                }
            }
            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .padding(.horizontal, 24)
    }

    // MARK: Mock keyboard area

    @ViewBuilder
    private var keyboardArea: some View {
        VStack(spacing: 10) {
            HStack(spacing: 10) {
                Text(composed.isEmpty ? "Message" : composed)
                    .font(.custom(FlynnFontName.interRegular, size: 15))
                    .foregroundColor(composed.isEmpty ? OB.inkFaint : OB.ink)
                    .lineLimit(1)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 14)
                    .frame(height: 42)
                    .background(Capsule().fill(OB.cream))
                    .overlay(Capsule().stroke(OB.ink, lineWidth: 2))

                Button(action: send) {
                    Image(systemName: "arrow.up.circle.fill")
                        .font(.system(size: 32))
                        .foregroundColor(stage == .send ? OB.orange : OB.inkFaint.opacity(0.4))
                }
                .disabled(stage != .send)
            }
            .padding(.horizontal, 16)
            .padding(.top, 12)

            mockKeyboard
        }
        .background(
            OB.card
                .overlay(Rectangle().frame(height: OB.outline).foregroundColor(OB.ink), alignment: .top)
                .ignoresSafeArea(edges: .bottom)
        )
    }

    @ViewBuilder
    private var mockKeyboard: some View {
        switch stage {
        case .copy:
            keyboardPlaceholder(text: "Copy the message above to begin")
        case .switchKeyboard:
            VStack(spacing: 10) {
                keyboardPlaceholder(text: "Your normal keyboard")
                Button { withAnimation { stage = .tapReply } } label: {
                    Label("Switch to Flynn", systemImage: "globe")
                        .font(.custom(FlynnFontName.spaceGroteskBold, size: 16))
                        .foregroundColor(OB.card)
                        .frame(maxWidth: .infinity).frame(height: 48)
                        .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(OB.orange))
                        .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(OB.ink, lineWidth: OB.outline))
                }
                .buttonStyle(.plain)
                .padding(.horizontal, 16)
            }
            .padding(.bottom, 16)
        case .tapReply, .send, .done:
            flynnKeyboard
        }
    }

    private var flynnKeyboard: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                Mascot(.point, size: 26)
                Text("Flynn")
                    .font(.custom(FlynnFontName.spaceGroteskSemiBold, size: 13))
                    .foregroundColor(OB.inkSoft)
            }
            .padding(.horizontal, 16)
            ForEach(Array(drafts.enumerated()), id: \.offset) { _, draft in
                Button {
                    withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) {
                        composed = draft
                        stage = .send
                    }
                } label: {
                    Text(draft)
                        .font(.custom(FlynnFontName.interRegular, size: 15))
                        .foregroundColor(OB.ink)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(12)
                        .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(OB.cream))
                        .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(OB.ink, lineWidth: OB.outline))
                }
                .buttonStyle(.plain)
                .padding(.horizontal, 16)
            }
        }
        .padding(.vertical, 12)
    }

    private func keyboardPlaceholder(text: String) -> some View {
        Text(text)
            .font(.custom(FlynnFontName.interMedium, size: 13))
            .foregroundColor(OB.inkFaint)
            .frame(maxWidth: .infinity)
            .frame(height: 120)
            .background(OB.cream)
    }

    private func send() {
        guard stage == .send else { return }
        withAnimation { stage = .done }
        Task {
            try? await Task.sleep(for: .milliseconds(700))
            onContinue()
        }
    }
}
