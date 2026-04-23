import SwiftUI
import Supabase
import UIKit

/// AU carriers handled by the forwarding setup wizard. Codes are the standard GSM
/// conditional-forwarding prefixes; the carrier-specific variations below reflect
/// what each network's customer-care docs publish.
enum AUCarrier: String, CaseIterable, Identifiable, Sendable {
    case telstra, optus, vodafone, tpg

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .telstra: return "Telstra"
        case .optus: return "Optus"
        case .vodafone: return "Vodafone"
        case .tpg: return "TPG / Felix / Belong"
        }
    }

    /// `*004*` forwards all conditional cases (busy / no-answer / unreachable) to
    /// a single number — this is what we want for missed-call capture. The `#`
    /// suffix submits the MMI code.
    func forwardingCode(destination: String) -> String {
        "*004*\(destination)#"
    }

    var steps: [String] {
        switch self {
        case .telstra:
            return [
                "Tap Start Forwarding below — it'll open your dialer with the code pre-filled.",
                "Tap Call on your dialer.",
                "You'll hear a confirmation tone. That's it."
            ]
        case .optus:
            return [
                "Tap Start Forwarding to open your dialer.",
                "Tap Call. Optus will confirm via a brief voice message.",
                "If it fails, try dialling ##004# first to reset, then retry."
            ]
        case .vodafone:
            return [
                "Tap Start Forwarding to open your dialer.",
                "Tap Call. Wait for Vodafone's confirmation tone.",
                "Some Vodafone plans require enabling call-forwarding in My Vodafone first."
            ]
        case .tpg:
            return [
                "Tap Start Forwarding to open your dialer.",
                "Tap Call. You'll hear a confirmation beep.",
                "TPG/Felix/Belong all run on Vodafone's network, so the code is identical."
            ]
        }
    }
}

@MainActor
@Observable
final class ForwardingSetupStore {
    enum LoadState: Equatable { case idle, loading, loaded, error(String) }

    private(set) var loadState: LoadState = .idle
    private(set) var telnyxNumber: String?
    var selectedCarrier: AUCarrier = .telstra

    private let client: SupabaseClient

    init(client: SupabaseClient = FlynnSupabase.client) {
        self.client = client
    }

    func load() async {
        loadState = .loading
        do {
            struct Row: Decodable { let telnyx_phone_number: String? }
            let session = try await client.auth.session
            let row: Row = try await client
                .from("users")
                .select("telnyx_phone_number")
                .eq("id", value: session.user.id.uuidString)
                .single()
                .execute()
                .value
            telnyxNumber = row.telnyx_phone_number
            loadState = .loaded
        } catch {
            loadState = .error(error.localizedDescription)
        }
    }
}

struct ForwardingSetupView: View {
    @State private var store = ForwardingSetupStore()
    @Environment(FlashStore.self) private var flash

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: FlynnSpacing.lg) {
                header

                switch store.loadState {
                case .idle, .loading:
                    ProgressView()
                        .frame(maxWidth: .infinity, minHeight: 160)
                case .error(let msg):
                    errorState(msg)
                case .loaded:
                    if let number = store.telnyxNumber, !number.isEmpty {
                        carrierPicker
                        instructions
                        actionButton(destination: number)
                        fallbackNote(destination: number)
                    } else {
                        missingNumberState
                    }
                }
            }
            .padding(FlynnSpacing.lg)
        }
        .background(FlynnColor.background)
        .navigationTitle("Forward your calls")
        .navigationBarTitleDisplayMode(.large)
        .task { await store.load() }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: FlynnSpacing.xs) {
            Text("One-time setup")
                .flynnType(FlynnTypography.caption)
                .foregroundColor(FlynnColor.textTertiary)
            Text("Send missed calls to Flynn")
                .flynnType(FlynnTypography.h2)
                .foregroundColor(FlynnColor.textPrimary)
            Text("When you can't answer, your carrier will forward the call to Flynn's AU number. Your own mobile number doesn't change.")
                .flynnType(FlynnTypography.bodyMedium)
                .foregroundColor(FlynnColor.textSecondary)
        }
    }

    private var carrierPicker: some View {
        VStack(alignment: .leading, spacing: FlynnSpacing.sm) {
            Text("Your carrier")
                .flynnType(FlynnTypography.h4)
                .foregroundColor(FlynnColor.textPrimary)

            LazyVGrid(
                columns: [GridItem(.flexible()), GridItem(.flexible())],
                spacing: FlynnSpacing.sm
            ) {
                ForEach(AUCarrier.allCases) { carrier in
                    carrierTile(carrier)
                }
            }
        }
    }

    private func carrierTile(_ carrier: AUCarrier) -> some View {
        let isSelected = store.selectedCarrier == carrier
        return Button(action: { store.selectedCarrier = carrier }) {
            Text(carrier.displayName)
                .flynnType(FlynnTypography.label)
                .foregroundColor(isSelected ? FlynnColor.primary : FlynnColor.textPrimary)
                .frame(maxWidth: .infinity, minHeight: 44)
                .padding(.horizontal, FlynnSpacing.sm)
                .background(
                    RoundedRectangle(cornerRadius: FlynnRadii.md, style: .continuous)
                        .fill(isSelected ? FlynnColor.primaryLight : FlynnColor.backgroundSecondary)
                )
                .brutalistBorder(
                    cornerRadius: FlynnRadii.md,
                    color: isSelected ? FlynnColor.primary : FlynnColor.border,
                    lineWidth: isSelected ? 3 : 2
                )
        }
        .buttonStyle(.plain)
    }

    private var instructions: some View {
        VStack(alignment: .leading, spacing: FlynnSpacing.sm) {
            Text("How to turn it on")
                .flynnType(FlynnTypography.h4)
                .foregroundColor(FlynnColor.textPrimary)

            ForEach(Array(store.selectedCarrier.steps.enumerated()), id: \.offset) { index, step in
                HStack(alignment: .top, spacing: FlynnSpacing.sm) {
                    Text("\(index + 1)")
                        .flynnType(FlynnTypography.caption)
                        .foregroundColor(.white)
                        .frame(width: 22, height: 22)
                        .background(Circle().fill(FlynnColor.primary))
                    Text(step)
                        .flynnType(FlynnTypography.bodyMedium)
                        .foregroundColor(FlynnColor.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
        .padding(FlynnSpacing.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: FlynnRadii.md, style: .continuous)
                .fill(FlynnColor.backgroundSecondary)
        )
        .brutalistBorder(cornerRadius: FlynnRadii.md)
    }

    private func actionButton(destination: String) -> some View {
        let code = store.selectedCarrier.forwardingCode(destination: destination)
        return VStack(spacing: FlynnSpacing.sm) {
            FlynnButton(
                title: "Start Forwarding",
                action: { dial(code: code) },
                fullWidth: true
            )
            Text("Dialer will open with: \(code)")
                .flynnType(FlynnTypography.caption)
                .foregroundColor(FlynnColor.textTertiary)
        }
    }

    private func fallbackNote(destination: String) -> some View {
        VStack(alignment: .leading, spacing: FlynnSpacing.xs) {
            Text("To turn forwarding off later, dial")
                .flynnType(FlynnTypography.caption)
                .foregroundColor(FlynnColor.textTertiary)
            Text("##004#")
                .flynnType(FlynnTypography.bodyMedium)
                .foregroundColor(FlynnColor.textPrimary)
                .monospaced()
            Text("Flynn's number: \(destination)")
                .flynnType(FlynnTypography.caption)
                .foregroundColor(FlynnColor.textTertiary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var missingNumberState: some View {
        VStack(spacing: FlynnSpacing.sm) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: 32))
                .foregroundColor(FlynnColor.warning)
            Text("Flynn number not provisioned yet")
                .flynnType(FlynnTypography.h4)
                .foregroundColor(FlynnColor.textPrimary)
            Text("We'll set this up during onboarding. You can come back to this screen once provisioning finishes.")
                .flynnType(FlynnTypography.bodyMedium)
                .foregroundColor(FlynnColor.textSecondary)
                .multilineTextAlignment(.center)
        }
        .padding(FlynnSpacing.md)
    }

    private func errorState(_ message: String) -> some View {
        VStack(spacing: FlynnSpacing.sm) {
            Text("Couldn't load forwarding info")
                .flynnType(FlynnTypography.h4)
            Text(message)
                .flynnType(FlynnTypography.bodyMedium)
                .foregroundColor(FlynnColor.textSecondary)
            FlynnButton(title: "Retry", action: { Task { await store.load() } })
        }
    }

    private func dial(code: String) {
        // `*` and `#` must be percent-encoded for tel:// to parse on iOS.
        guard
            let encoded = code.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed),
            let url = URL(string: "tel:\(encoded)")
        else {
            flash.error("Couldn't open dialer")
            return
        }
        if UIApplication.shared.canOpenURL(url) {
            UIApplication.shared.open(url)
        } else {
            flash.error("Dialer unavailable (iPad or Simulator)")
        }
    }
}
