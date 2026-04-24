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
    /// Scraped business name — seeds the SMS preview copy so the bubble reads
    /// "Hi, this is Mate's Plumbing" instead of a placeholder.
    private(set) var businessName: String?

    private let client: SupabaseClient

    init(client: SupabaseClient = FlynnSupabase.client) {
        self.client = client
    }

    func load() async {
        loadState = .loading
        do {
            struct UserRow: Decodable { let call_handling_mode: String? }
            struct ProfileRow: Decodable { let business_name: String? }
            let session = try await client.auth.session
            let uid = session.user.id.uuidString

            async let userTask: UserRow = client
                .from("users")
                .select("call_handling_mode")
                .eq("id", value: uid)
                .single()
                .execute()
                .value

            async let profileTask: [ProfileRow] = client
                .from("business_profiles")
                .select("business_name")
                .eq("user_id", value: uid)
                .limit(1)
                .execute()
                .value

            let (userRow, profileRows) = try await (userTask, profileTask)
            selectedMode = CallHandlingMode(rawValue: userRow.call_handling_mode ?? "") ?? .smsLinks
            businessName = profileRows.first?.business_name
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
    /// When embedded in onboarding Step 2, the wrapping step view already renders
    /// the "How should Flynn handle missed calls?" heading. Pass `false` there to
    /// suppress the duplicate. Defaults to `true` for the settings entry point.
    let showInternalHeader: Bool

    @Environment(FlashStore.self) private var flash
    @State private var store = CallModeSelectorStore()

    init(showInternalHeader: Bool = true) {
        self.showInternalHeader = showInternalHeader
    }

    var body: some View {
        ScrollView {
            VStack(spacing: FlynnSpacing.md) {
                if showInternalHeader {
                    header
                }

                ForEach(CallHandlingMode.allCases) { mode in
                    ModeCard(
                        mode: mode,
                        isSelected: store.selectedMode == mode,
                        isSaving: store.isSaving,
                        businessName: store.businessName,
                        onSelect: { Task { await select(mode) } }
                    )
                }
            }
            .padding(FlynnSpacing.lg)
        }
        .background(FlynnColor.background)
        .navigationTitle(showInternalHeader ? "Call handling" : "")
        .navigationBarTitleDisplayMode(showInternalHeader ? .large : .inline)
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
    let businessName: String?
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

                if isSelected {
                    ModePreview(mode: mode, businessName: businessName)
                        .transition(.asymmetric(
                            insertion: .move(edge: .top).combined(with: .opacity),
                            removal: .opacity
                        ))
                }
            }
            .padding(FlynnSpacing.md)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: FlynnRadii.md, style: .continuous)
                    .fill(isSelected ? FlynnColor.primaryLight : FlynnColor.backgroundSecondary)
            )
            .brutalistBorder(cornerRadius: FlynnRadii.md, color: isSelected ? FlynnColor.primary : FlynnColor.border, lineWidth: isSelected ? 3 : 2)
            .animation(.spring(response: 0.4, dampingFraction: 0.85), value: isSelected)
        }
        .buttonStyle(.plain)
        .disabled(isSaving)
        .opacity(isSaving && !isSelected ? 0.5 : 1.0)
    }
}

// MARK: - Mode-specific previews

/// Lightweight preview shown when a mode is selected — removes ambiguity
/// about what callers will actually experience.
private struct ModePreview: View {
    let mode: CallHandlingMode
    let businessName: String?

    private var resolvedName: String { businessName ?? "your business" }

    var body: some View {
        Group {
            switch mode {
            case .smsLinks:     smsPreview
            case .aiReceptionist: aiPreview
            case .voicemailOnly: voicemailPreview
            }
        }
        .padding(.top, FlynnSpacing.xs)
    }

    /// iMessage-style bubble preview of the SMS a caller receives after pressing 1.
    private var smsPreview: some View {
        VStack(alignment: .leading, spacing: FlynnSpacing.xs) {
            Text("What callers receive")
                .flynnType(FlynnTypography.overline)
                .foregroundColor(FlynnColor.textTertiary)

            HStack {
                bubbleIncoming("Hey, you guys free Saturday?")
                Spacer(minLength: 40)
            }

            HStack {
                Spacer(minLength: 40)
                bubbleOutgoing("Hi, this is \(resolvedName). Book your next job here: flynn.co/book")
            }
        }
    }

    private func bubbleIncoming(_ text: String) -> some View {
        Text(text)
            .flynnType(FlynnTypography.bodyMedium)
            .foregroundColor(FlynnColor.textPrimary)
            .padding(.horizontal, FlynnSpacing.sm)
            .padding(.vertical, FlynnSpacing.xs)
            .background(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .fill(FlynnColor.gray200)
            )
    }

    private func bubbleOutgoing(_ text: String) -> some View {
        Text(text)
            .flynnType(FlynnTypography.bodyMedium)
            .foregroundColor(FlynnColor.textInverse)
            .padding(.horizontal, FlynnSpacing.sm)
            .padding(.vertical, FlynnSpacing.xs)
            .background(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .fill(Color(hex: "#34C759"))  // iOS green-bubble
            )
    }

    /// Mini waveform + transcript snippet suggesting a conversational exchange.
    private var aiPreview: some View {
        VStack(alignment: .leading, spacing: FlynnSpacing.xs) {
            Text("What callers hear")
                .flynnType(FlynnTypography.overline)
                .foregroundColor(FlynnColor.textTertiary)

            HStack(spacing: 3) {
                ForEach(0..<18, id: \.self) { i in
                    Capsule()
                        .fill(FlynnColor.primary)
                        .frame(width: 3, height: miniBarHeight(at: i))
                }
            }
            .frame(height: 28)

            Text("\"G'day, thanks for calling \(resolvedName). What can I help you with?\"")
                .flynnType(FlynnTypography.caption)
                .foregroundColor(FlynnColor.textSecondary)
                .italic()
        }
    }

    private func miniBarHeight(at index: Int) -> CGFloat {
        // Deterministic pseudo-random pattern so the preview feels alive
        // without introducing animation state.
        let seed = Double((index &* 2654435761) % 97) / 97.0
        return 6 + CGFloat(seed) * 22
    }

    /// Static voicemail card — minimal fallback mode.
    private var voicemailPreview: some View {
        HStack(spacing: FlynnSpacing.sm) {
            Image(systemName: "waveform.badge.mic")
                .font(.title2)
                .foregroundColor(FlynnColor.textSecondary)
            VStack(alignment: .leading, spacing: 2) {
                Text("Voicemail recorded")
                    .flynnType(FlynnTypography.caption)
                    .foregroundColor(FlynnColor.textPrimary)
                Text("0:12 · transcribed to a job card")
                    .flynnType(FlynnTypography.caption)
                    .foregroundColor(FlynnColor.textTertiary)
            }
            Spacer()
            Text("▶︎ play")
                .flynnType(FlynnTypography.caption)
                .foregroundColor(FlynnColor.primary)
        }
        .padding(FlynnSpacing.xs)
        .background(
            RoundedRectangle(cornerRadius: FlynnRadii.sm, style: .continuous)
                .fill(FlynnColor.backgroundTertiary)
        )
    }
}
