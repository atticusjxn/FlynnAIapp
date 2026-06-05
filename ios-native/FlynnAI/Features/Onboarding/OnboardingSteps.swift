import SwiftUI
import UIKit
import Supabase

// All onboarding steps render on the shared cream "mid-century" surface defined in
// OnboardingDesign.swift. Copy is deliberately universal — Flynn is for anyone who
// texts to set things up (clients, side gigs, friends), not just tradies.

// MARK: - Welcome

struct WelcomeStepView: View {
    let onContinue: () -> Void

    var body: some View {
        ZStack {
            MidCenturyBackdrop(variant: 0)
            VStack(spacing: 28) {
                Spacer()
                MascotHero(pose: .wave, size: 216)
                OnboardingHeadline(
                    title: "Reply like you.",
                    accentTitle: "Lock in the time.",
                    subtitle: "Flynn drafts your texts in your own voice and books the moment everyone agrees — for clients, side gigs, or just your group chat.",
                    alignment: .center
                )
                Spacer()
                RetroButton(title: "Get started", action: onContinue)
            }
            .padding(.horizontal, 24)
            .padding(.vertical, 24)
        }
        .environment(\.colorScheme, .light)
    }
}

// MARK: - What you do

struct WhatYouDoStepView: View {
    @Bindable var store: OnboardingStore
    let onContinue: () -> Void
    @FocusState private var focused: Bool

    private var descriptionEmpty: Bool {
        store.businessDescription.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    var body: some View {
        OnboardingScaffold(variant: 1) {
            HStack(alignment: .top) {
                OnboardingHeadline(
                    eyebrow: "Step 1",
                    title: "What's Flynn",
                    accentTitle: "helping with?",
                    subtitle: "A line is plenty — Flynn tailors your replies. Works for any job, hustle, or just you and your mates."
                )
                Mascot(.thinking, size: 84)
                    .padding(.top, 18)
            }

            RetroField(
                label: "What you do (or what you need)",
                text: $store.businessDescription,
                placeholder: "plumber · real estate agent · hairdresser · just me…",
                autocapitalization: .sentences
            )
            .focused($focused)

            RetroField(
                label: "Website (optional)",
                text: $store.websiteURL,
                placeholder: "https://…",
                textContentType: .URL,
                autocapitalization: .never
            )

            if case .error(let msg) = store.understandingState {
                Text(msg)
                    .font(.custom(FlynnFontName.interMedium, size: 13))
                    .foregroundColor(OB.terra)
            }
        } footer: {
            RetroButton(
                title: "Continue",
                isLoading: store.understandingState == .loading,
                action: submit
            )
            .opacity(descriptionEmpty ? 0.55 : 1)
            .disabled(descriptionEmpty || store.understandingState == .loading)
        }
    }

    private func submit() {
        focused = false
        Task {
            await store.understandBusiness()
            if case .loaded = store.understandingState { onContinue() }
        }
    }
}

// MARK: - Confirm Brain

struct ConfirmBrainStepView: View {
    @Bindable var store: OnboardingStore
    let onContinue: () -> Void
    @State private var saving = false

    var body: some View {
        OnboardingScaffold(variant: 2) {
            OnboardingHeadline(
                eyebrow: "Step 2",
                title: "Does this",
                accentTitle: "look right?",
                subtitle: "Flynn leans on these when it drafts. Fix anything that's off — you can always edit later."
            )

            RetroField(label: "What you do", text: $store.detectedBusinessType, placeholder: "e.g. plumber")

            if !store.detectedServices.isEmpty {
                Text("Services & rough pricing")
                    .font(.custom(FlynnFontName.interMedium, size: 13))
                    .foregroundColor(OB.inkSoft)

                ForEach($store.detectedServices) { $svc in
                    HStack(spacing: 10) {
                        TextField("Service", text: $svc.name)
                            .font(.custom(FlynnFontName.interRegular, size: 16))
                            .foregroundColor(OB.ink)
                        TextField("Price", text: $svc.priceRange)
                            .font(.custom(FlynnFontName.interRegular, size: 16))
                            .foregroundColor(OB.ink)
                            .keyboardType(.numbersAndPunctuation)
                            .multilineTextAlignment(.trailing)
                            .frame(width: 120)
                    }
                    .tint(OB.orange)
                    .padding(.horizontal, 16).padding(.vertical, 13)
                    .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(OB.card))
                    .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(OB.ink, lineWidth: OB.outline))
                }
            }

            RetroField(
                label: "Pricing notes (optional)",
                text: $store.detectedPricingNote,
                placeholder: "e.g. $90 callout, quotes are free"
            )
        } footer: {
            RetroButton(title: "Looks right", isLoading: saving, action: save)
        }
    }

    private func save() {
        saving = true
        Task {
            await store.saveBusinessBrain()
            saving = false
            onContinue()
        }
    }
}

// MARK: - Capture voice

struct CaptureVoiceStepView: View {
    @Bindable var store: OnboardingStore
    let onContinue: () -> Void
    @State private var replies: [String] = []
    @State private var saving = false

    private struct ToneSampleInsert: Encodable { let sample_text: String; let source: String }

    private var prompts: [String] {
        store.samplePrompts.isEmpty
            ? ["Hey, are you free this week and how much would it be?",
               "Can you do sometime next week? Let me know what works.",
               "Quick one — do you cover my area?"]
            : store.samplePrompts
    }

    var body: some View {
        OnboardingScaffold(variant: 3) {
            HStack(alignment: .top) {
                OnboardingHeadline(
                    eyebrow: "Step 3",
                    title: "Reply like you",
                    accentTitle: "really would",
                    subtitle: "These are messages someone might send you. Reply exactly how you'd actually text back — short, slang, emojis, the lot. That's how Flynn learns your voice."
                )
                Mascot(.write, size: 84).padding(.top, 18)
            }

            ForEach(Array(prompts.enumerated()), id: \.offset) { idx, prompt in
                VStack(alignment: .leading, spacing: 8) {
                    CustomerBubble(text: prompt)
                    RetroField(
                        label: nil,
                        text: replyBinding(idx),
                        placeholder: "type how you'd really reply…",
                        axis: .vertical,
                        autocapitalization: .sentences
                    )
                }
            }
        } footer: {
            RetroButton(title: "Continue", isLoading: saving, action: save)
        }
        .onAppear {
            if replies.count != prompts.count { replies = Array(repeating: "", count: prompts.count) }
        }
    }

    private func replyBinding(_ idx: Int) -> Binding<String> {
        Binding(
            get: { idx < replies.count ? replies[idx] : "" },
            set: { if idx < replies.count { replies[idx] = $0 } }
        )
    }

    private func save() {
        let rows = replies
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
            .map { ToneSampleInsert(sample_text: $0, source: "onboarding") }
        guard !rows.isEmpty else { onContinue(); return }

        saving = true
        Task {
            try? await FlynnSupabase.client.from("tone_samples").insert(rows).execute()
            saving = false
            onContinue()
        }
    }
}

// MARK: - Sounds like you (the aha loop)

struct SoundsLikeYouStepView: View {
    @Bindable var store: OnboardingStore
    let onContinue: () -> Void

    @State private var phase: Phase = .loading
    @State private var editing = false
    @State private var editText = ""

    enum Phase { case loading; case draft(String); case failed }

    private struct DraftReq: Encodable { let messages: [String] }
    private struct DraftResp: Decodable { let drafts: [String] }
    private struct AcceptReq: Encodable { let text: String }

    private var customerMessage: String {
        store.samplePrompts.first ?? "Hey, are you free this week and how much would it be?"
    }

    var body: some View {
        OnboardingScaffold(variant: 0) {
            OnboardingHeadline(
                eyebrow: "Step 4",
                title: "Sound",
                accentTitle: "like you?",
                subtitle: "Here's Flynn replying in your voice — exactly what you'll get inside Messages."
            )

            CustomerBubble(text: customerMessage)

            switch phase {
            case .loading:
                HStack(spacing: 12) {
                    ProgressView().tint(OB.orange)
                    Text("Drafting in your voice…")
                        .font(.custom(FlynnFontName.interRegular, size: 15))
                        .foregroundColor(OB.inkSoft)
                }
                .padding(.vertical, 12)

            case .draft(let d):
                if editing {
                    RetroField(label: "Make it sound like you", text: $editText, axis: .vertical)
                    RetroButton(title: "Save & redraft", action: saveEdit)
                } else {
                    HStack {
                        Spacer()
                        Mascot(.thumbsup, size: 96)
                        Spacer()
                    }
                    DraftBubble(text: d)
                }

            case .failed:
                Text("Couldn't draft right now — you'll see this in action once the keyboard's added.")
                    .font(.custom(FlynnFontName.interRegular, size: 15))
                    .foregroundColor(OB.inkSoft)
                    .fixedSize(horizontal: false, vertical: true)
            }
        } footer: {
            switch phase {
            case .draft where !editing:
                RetroButton(title: "👍  That's me", action: onContinue)
                RetroButton(title: "Tweak it", variant: .secondary, action: {
                    if case .draft(let d) = phase { editText = d }
                    editing = true
                })
            case .failed:
                RetroButton(title: "Continue", action: onContinue)
            default:
                EmptyView()
            }
        }
        .task { await loadDraft() }
    }

    private func saveEdit() {
        let text = editText.trimmingCharacters(in: .whitespacesAndNewlines)
        editing = false
        guard !text.isEmpty else { return }
        phase = .loading
        Task { await postAccept(text); await loadDraft() }
    }

    private func postAccept(_ text: String) async {
        do {
            let session = try await FlynnSupabase.client.auth.session
            var req = URLRequest(url: FlynnEnv.flynnAPIBaseURL.appendingPathComponent("api/keyboard/accept-draft"))
            req.httpMethod = "POST"
            req.setValue("Bearer \(session.accessToken)", forHTTPHeaderField: "Authorization")
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.httpBody = try JSONEncoder().encode(AcceptReq(text: text))
            _ = try await URLSession.shared.data(for: req)
        } catch { /* best-effort */ }
    }

    private func loadDraft() async {
        phase = .loading
        do {
            let session = try await FlynnSupabase.client.auth.session
            var req = URLRequest(
                url: FlynnEnv.flynnAPIBaseURL.appendingPathComponent("api/keyboard/draft-replies"),
                timeoutInterval: 20
            )
            req.httpMethod = "POST"
            req.setValue("Bearer \(session.accessToken)", forHTTPHeaderField: "Authorization")
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.httpBody = try JSONEncoder().encode(DraftReq(messages: [customerMessage]))

            let (data, response) = try await URLSession.shared.data(for: req)
            guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode),
                  let decoded = try? JSONDecoder().decode(DraftResp.self, from: data),
                  let first = decoded.drafts.first else {
                phase = .failed
                return
            }
            withAnimation(.spring(response: 0.4, dampingFraction: 0.8)) { phase = .draft(first) }
        } catch {
            phase = .failed
        }
    }
}

// MARK: - Connect calendar

struct ConnectCalendarStepView: View {
    @Environment(FlashStore.self) private var flash
    @State private var appleConnected = false
    @State private var connecting = false
    let onContinue: () -> Void

    private struct AppleFlagPatch: Encodable { let apple_calendar_connected: Bool }

    var body: some View {
        OnboardingScaffold(variant: 1) {
            OnboardingHeadline(
                eyebrow: "Step 5",
                title: "Connect your",
                accentTitle: "calendar",
                subtitle: "So Flynn can offer times you're actually free, and drop agreed plans straight into your calendar."
            )

            connectRow(
                icon: "calendar",
                title: "Apple Calendar",
                subtitle: appleConnected ? "Connected" : "On your device — one tap",
                connected: appleConnected
            ) { connectApple() }

            connectRow(
                icon: "globe",
                title: "Google Calendar",
                subtitle: "Connect later in Settings",
                connected: false,
                disabled: true
            ) {}
        } footer: {
            RetroButton(title: "Continue", action: onContinue)
        }
    }

    private func connectRow(
        icon: String, title: String, subtitle: String,
        connected: Bool, disabled: Bool = false, action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            HStack(alignment: .center, spacing: 14) {
                Image(systemName: icon)
                    .font(.system(size: 22))
                    .foregroundColor(disabled ? OB.inkFaint : OB.orange)
                    .frame(width: 32)
                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(.custom(FlynnFontName.spaceGroteskSemiBold, size: 17))
                        .foregroundColor(OB.ink)
                    Text(subtitle)
                        .font(.custom(FlynnFontName.interRegular, size: 13))
                        .foregroundColor(OB.inkFaint)
                }
                Spacer()
                Image(systemName: connected ? "checkmark.circle.fill" : "chevron.right")
                    .foregroundColor(connected ? OB.teal : OB.inkFaint)
            }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(RoundedRectangle(cornerRadius: 18, style: .continuous).fill(OB.card))
            .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).stroke(OB.ink, lineWidth: OB.outline))
        }
        .buttonStyle(.plain)
        .disabled(disabled || connecting)
    }

    private func connectApple() {
        connecting = true
        Task {
            do {
                let granted = try await AppleCalendarService().requestAccess()
                if granted {
                    let session = try await FlynnSupabase.client.auth.session
                    try? await FlynnSupabase.client
                        .from("users")
                        .update(AppleFlagPatch(apple_calendar_connected: true))
                        .eq("id", value: session.user.id.uuidString)
                        .execute()
                }
                await MainActor.run {
                    connecting = false
                    appleConnected = granted
                    if granted { flash.success("Apple Calendar connected") }
                    else { flash.error("Calendar access denied — enable it in Settings") }
                }
            } catch {
                await MainActor.run { connecting = false; flash.error("Couldn't connect calendar") }
            }
        }
    }
}

// MARK: - Install keyboard (the one-off ask, value already shown)

struct InstallKeyboardStepView: View {
    let onContinue: () -> Void

    var body: some View {
        OnboardingScaffold(variant: 2) {
            HStack(alignment: .top) {
                OnboardingHeadline(
                    eyebrow: "Almost there",
                    title: "Add the",
                    accentTitle: "Flynn keyboard",
                    subtitle: "This is how Flynn drafts replies right inside Messages. One-time setup — copy a message, switch to the Flynn keyboard, tap a reply."
                )
                Mascot(.phone, size: 88).padding(.top, 18)
            }

            instructionRow("1", "Open Settings → General → Keyboard → Keyboards.")
            instructionRow("2", "Tap “Add New Keyboard…” and choose Flynn.")
            instructionRow("3", "Tap Flynn and turn on “Allow Full Access” so it can draft from your copied message.")
        } footer: {
            RetroButton(title: "Open Settings", action: openSettings)
            RetroButton(title: "I've added it — next", variant: .secondary, action: onContinue)
        }
    }

    private func instructionRow(_ number: String, _ text: String) -> some View {
        HStack(alignment: .top, spacing: 14) {
            Text(number)
                .font(.custom(FlynnFontName.spaceGroteskBold, size: 16))
                .foregroundColor(OB.card)
                .frame(width: 30, height: 30)
                .background(Circle().fill(OB.orange))
                .overlay(Circle().stroke(OB.ink, lineWidth: OB.outline))
            Text(text)
                .font(.custom(FlynnFontName.interRegular, size: 15))
                .foregroundColor(OB.ink)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func openSettings() {
        if let url = URL(string: UIApplication.openSettingsURLString) { UIApplication.shared.open(url) }
    }
}

// MARK: - Shared message bubbles (cream-world styling)

struct CustomerBubble: View {
    let text: String
    var body: some View {
        Text(text)
            .font(.custom(FlynnFontName.interRegular, size: 15))
            .foregroundColor(OB.ink)
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(RoundedRectangle(cornerRadius: 18, style: .continuous).fill(OB.card))
            .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).stroke(OB.ink, lineWidth: OB.outline))
    }
}

struct DraftBubble: View {
    let text: String
    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: "sparkles").foregroundColor(OB.orange)
            Text(text)
                .font(.custom(FlynnFontName.interRegular, size: 15))
                .foregroundColor(OB.ink)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 0)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 18, style: .continuous).fill(OB.mustard.opacity(0.28)))
        .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).stroke(OB.ink, lineWidth: OB.outline))
    }
}
