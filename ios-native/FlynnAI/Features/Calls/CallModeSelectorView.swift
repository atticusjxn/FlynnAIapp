import SwiftUI
import Supabase

/// The three call-handling modes a user can choose. Stored in
/// `users.call_handling_mode`.
enum CallHandlingMode: String, CaseIterable, Identifiable, Sendable {
    case smsLinks = "sms_links"
    case aiReceptionist = "ai_receptionist"
    case voicemailOnly = "voicemail_only"

    var id: String { rawValue }

    var title: String {
        switch self {
        case .smsLinks: return "SMS Link Follow-Up"
        case .aiReceptionist: return "AI Receptionist"
        case .voicemailOnly: return "Voicemail Only"
        }
    }

    var subtitle: String {
        switch self {
        case .smsLinks: return "Default"
        case .aiReceptionist: return "Premium"
        case .voicemailOnly: return "Minimal"
        }
    }

    var description: String {
        switch self {
        case .smsLinks:
            return "Caller hears a menu — Press 1 to book, Press 2 for a quote, Press 3 for voicemail. Flynn SMSes the link instantly. No AI setup needed."
        case .aiReceptionist:
            return "Flynn answers in an Australian voice, asks follow-up questions, and drafts a response you approve. Costs more per call."
        case .voicemailOnly:
            return "Straight to voicemail with transcription. No IVR menu, no AI. Simplest fallback."
        }
    }

    var iconName: String {
        switch self {
        case .smsLinks: return "message.circle.fill"
        case .aiReceptionist: return "waveform.circle.fill"
        case .voicemailOnly: return "mic.circle.fill"
        }
    }
}

@MainActor
@Observable
final class CallModeSelectorStore {
    enum LoadState: Equatable { case idle, loading, loaded, error(String) }

    private(set) var loadState: LoadState = .idle
    var selectedMode: CallHandlingMode = .smsLinks
    private(set) var isSaving = false

    private let client: SupabaseClient

    init(client: SupabaseClient = FlynnSupabase.client) {
        self.client = client
    }

    func load() async {
        loadState = .loading
        do {
            struct Row: Decodable { let call_handling_mode: String? }
            let session = try await client.auth.session
            let row: Row = try await client
                .from("users")
                .select("call_handling_mode")
                .eq("id", value: session.user.id.uuidString)
                .single()
                .execute()
                .value
            selectedMode = CallHandlingMode(rawValue: row.call_handling_mode ?? "") ?? .smsLinks
            loadState = .loaded
        } catch {
            loadState = .error(error.localizedDescription)
        }
    }

    func save(_ mode: CallHandlingMode) async throws {
        isSaving = true
        defer { isSaving = false }
        struct Patch: Encodable { let call_handling_mode: String }
        let session = try await client.auth.session
        try await client
            .from("users")
            .update(Patch(call_handling_mode: mode.rawValue))
            .eq("id", value: session.user.id.uuidString)
            .execute()
        selectedMode = mode
    }
}

struct CallModeSelectorView: View {
    @Environment(FlashStore.self) private var flash
    @State private var store = CallModeSelectorStore()

    var body: some View {
        ScrollView {
            VStack(spacing: FlynnSpacing.md) {
                header

                ForEach(CallHandlingMode.allCases) { mode in
                    ModeCard(
                        mode: mode,
                        isSelected: store.selectedMode == mode,
                        isSaving: store.isSaving,
                        onSelect: { Task { await select(mode) } }
                    )
                }
            }
            .padding(FlynnSpacing.lg)
        }
        .background(FlynnColor.background)
        .navigationTitle("Call handling")
        .navigationBarTitleDisplayMode(.large)
        .task { await store.load() }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: FlynnSpacing.xs) {
            Text("How should Flynn handle missed calls?")
                .flynnType(FlynnTypography.h3)
                .foregroundColor(FlynnColor.textPrimary)
            Text("You can change this any time. Each mode has different pricing and setup.")
                .flynnType(FlynnTypography.bodyMedium)
                .foregroundColor(FlynnColor.textSecondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func select(_ mode: CallHandlingMode) async {
        do {
            try await store.save(mode)
            flash.success("\(mode.title) enabled")
        } catch {
            flash.error("Couldn't switch mode")
            FlynnLog.network.error("CallMode save failed: \(error.localizedDescription, privacy: .public)")
        }
    }
}

private struct ModeCard: View {
    let mode: CallHandlingMode
    let isSelected: Bool
    let isSaving: Bool
    let onSelect: () -> Void

    var body: some View {
        Button(action: onSelect) {
            VStack(alignment: .leading, spacing: FlynnSpacing.sm) {
                HStack(alignment: .top, spacing: FlynnSpacing.sm) {
                    Image(systemName: mode.iconName)
                        .font(.system(size: 28))
                        .foregroundColor(isSelected ? FlynnColor.primary : FlynnColor.textSecondary)

                    VStack(alignment: .leading, spacing: 2) {
                        Text(mode.title)
                            .flynnType(FlynnTypography.h4)
                            .foregroundColor(FlynnColor.textPrimary)
                        Text(mode.subtitle)
                            .flynnType(FlynnTypography.caption)
                            .foregroundColor(FlynnColor.textTertiary)
                    }

                    Spacer()

                    if isSelected {
                        ZStack {
                            Circle()
                                .fill(FlynnColor.primary)
                                .frame(width: 22, height: 22)
                            Image(systemName: "checkmark")
                                .font(.system(size: 12, weight: .bold))
                                .foregroundColor(.white)
                        }
                    } else {
                        Circle()
                            .stroke(FlynnColor.border, lineWidth: 1.5)
                            .frame(width: 22, height: 22)
                    }
                }

                Text(mode.description)
                    .flynnType(FlynnTypography.bodyMedium)
                    .foregroundColor(FlynnColor.textSecondary)
                    .multilineTextAlignment(.leading)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(FlynnSpacing.md)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: FlynnRadii.md, style: .continuous)
                    .fill(isSelected ? FlynnColor.primaryLight : FlynnColor.backgroundSecondary)
            )
            .brutalistBorder(cornerRadius: FlynnRadii.md, color: isSelected ? FlynnColor.primary : FlynnColor.border, lineWidth: isSelected ? 3 : 2)
        }
        .buttonStyle(.plain)
        .disabled(isSaving)
        .opacity(isSaving && !isSelected ? 0.5 : 1.0)
    }
}
