import SwiftUI

/// First-run claim flow for the voice front door.
///
/// Shown when a signed-in user has a staged receptionist config waiting (they
/// called the ad number before installing). One screen shows what Flynn
/// learned on the call; one tap claims it and allocates their number. The
/// claim-code field is the recovery path for a mismatched signup number.
struct ReceptionistClaimFlow: View {
    let staged: VoiceOnboardingClient.StagedSession?
    let onFinished: () -> Void

    private enum Step {
        case claim
        case live(number: String)
    }

    @State private var step: Step = .claim
    @State private var working = false
    @State private var errorMessage: String?
    @State private var showCodeField = false
    @State private var code = ""
    @State private var claimedConfig: VoiceOnboardingClient.BusinessConfig?

    var body: some View {
        ZStack {
            FlynnColor.background.ignoresSafeArea()
            switch step {
            case .claim:
                claimStep
            case .live(let number):
                liveStep(number: number)
            }
        }
    }

    // MARK: - Claim

    private var claimStep: some View {
        VStack(spacing: 24) {
            Spacer()
            Mascot(.wave, size: 120, backdrop: .cream)

            Text("Your receptionist's ready")
                .font(.title.bold())
                .foregroundStyle(FlynnColor.textPrimary)
                .multilineTextAlignment(.center)

            Text("She learned your business from that call. Here's what she knows:")
                .font(.subheadline)
                .foregroundStyle(FlynnColor.textSecondary)
                .multilineTextAlignment(.center)

            configSummary

            if showCodeField {
                codeEntry
            }

            if let errorMessage {
                Text(errorMessage)
                    .font(.footnote)
                    .foregroundStyle(FlynnColor.error)
                    .multilineTextAlignment(.center)
            }

            Spacer()

            FlynnGlassButton(
                title: "Bring her to life",
                action: { Task { await claim() } },
                isLoading: working,
                isDisabled: showCodeField && code.count < 6
            )

            Button("Not now") { onFinished() }
                .font(.subheadline)
                .foregroundStyle(FlynnColor.textTertiary)
                .padding(.bottom, 8)
        }
        .padding(.horizontal, 24)
    }

    private var configSummary: some View {
        let config = staged?.businessConfig ?? claimedConfig
        let rows: [(String, String)] = [
            ("Trade", config?.trade),
            ("Business", config?.businessName),
            ("Areas", config?.serviceAreas?.joined(separator: ", ")),
            ("Hours", config?.hours),
            ("Callout fee", config?.calloutFee),
        ].compactMap { label, value in
            guard let value, !value.isEmpty else { return nil }
            return (label, value)
        }

        return VStack(spacing: 0) {
            if rows.isEmpty {
                Text("Tap below and she'll pick up your details as you go.")
                    .font(.subheadline)
                    .foregroundStyle(FlynnColor.textSecondary)
                    .padding(16)
            } else {
                ForEach(Array(rows.enumerated()), id: \.offset) { index, row in
                    HStack(alignment: .top) {
                        Text(row.0)
                            .font(.subheadline.weight(.medium))
                            .foregroundStyle(FlynnColor.textTertiary)
                            .frame(width: 96, alignment: .leading)
                        Text(row.1)
                            .font(.subheadline)
                            .foregroundStyle(FlynnColor.textPrimary)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 10)
                    if index < rows.count - 1 {
                        Divider().padding(.leading, 16)
                    }
                }
            }
        }
        .background(FlynnColor.backgroundSecondary, in: RoundedRectangle(cornerRadius: 14))
    }

    private var codeEntry: some View {
        VStack(spacing: 8) {
            Text("Signed up with a different number? Enter the code from your text.")
                .font(.footnote)
                .foregroundStyle(FlynnColor.textSecondary)
                .multilineTextAlignment(.center)
            TextField("Setup code", text: $code)
                .textInputAutocapitalization(.characters)
                .autocorrectionDisabled()
                .font(.title3.monospaced())
                .multilineTextAlignment(.center)
                .padding(.vertical, 12)
                .background(FlynnColor.backgroundSecondary, in: RoundedRectangle(cornerRadius: 12))
                .onChange(of: code) { _, newValue in
                    code = String(newValue.uppercased().prefix(6))
                }
        }
    }

    private func claim() async {
        working = true
        errorMessage = nil
        defer { working = false }
        do {
            let result = try await VoiceOnboardingClient.claim(code: showCodeField ? code : nil)
            claimedConfig = result.businessConfig
            let assigned = try await VoiceOnboardingClient.assignNumber()
            step = .live(number: assigned.phoneNumber)
        } catch VoiceOnboardingClient.VoiceOnboardingError.notFound {
            showCodeField = true
            errorMessage = code.isEmpty
                ? nil
                : "That code didn't match. Check the text Flynn sent you."
        } catch VoiceOnboardingClient.VoiceOnboardingError.poolEmpty {
            // Claim succeeded; the number lags. Don't strand them on this screen.
            errorMessage = nil
            step = .live(number: "")
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    // MARK: - Live

    private func liveStep(number: String) -> some View {
        VStack(spacing: 24) {
            Spacer()
            Mascot(.thumbsup, size: 120, backdrop: .cream)

            Text(number.isEmpty ? "She's almost ready" : "She's live!")
                .font(.title.bold())
                .foregroundStyle(FlynnColor.textPrimary)

            if number.isEmpty {
                Text("Your receptionist's set up. We're grabbing your number now — you'll get a text the moment she's answering.")
                    .font(.subheadline)
                    .foregroundStyle(FlynnColor.textSecondary)
                    .multilineTextAlignment(.center)
            } else {
                VStack(spacing: 12) {
                    Text("Your receptionist answers on")
                        .font(.subheadline)
                        .foregroundStyle(FlynnColor.textSecondary)
                    Text(formatAUNumber(number))
                        .font(.title2.bold().monospaced())
                        .foregroundStyle(FlynnColor.primary)
                    Text("Give this number out, or divert your missed calls to it so she picks up whenever you can't. You can set that up any time in Settings.")
                        .font(.footnote)
                        .foregroundStyle(FlynnColor.textSecondary)
                        .multilineTextAlignment(.center)
                }
                .padding(20)
                .frame(maxWidth: .infinity)
                .background(FlynnColor.backgroundSecondary, in: RoundedRectangle(cornerRadius: 14))

                FlynnGlassButton(
                    title: "Give her a test call",
                    action: { callNumber(number) },
                    icon: Image(systemName: "phone.fill")
                )
            }

            Spacer()

            FlynnGlassButton(title: "Done", action: onFinished, variant: .neutral)
                .padding(.bottom, 8)
        }
        .padding(.horizontal, 24)
    }

    private func callNumber(_ number: String) {
        let digits = number.replacingOccurrences(of: " ", with: "")
        if let url = URL(string: "tel://\(digits)") {
            UIApplication.shared.open(url)
        }
    }

    /// +61480123456 → 0480 123 456 for display.
    private func formatAUNumber(_ e164: String) -> String {
        guard e164.hasPrefix("+61"), e164.count == 12 else { return e164 }
        let local = "0" + e164.dropFirst(3)
        let a = local.prefix(4)
        let b = local.dropFirst(4).prefix(3)
        let c = local.dropFirst(7)
        return "\(a) \(b) \(c)"
    }
}
