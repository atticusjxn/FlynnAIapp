import SwiftUI
import UIKit

// The individual screens of the onboarding wizard. Each uses WizardScaffold
// so they share one layout: an optional eyebrow, a big title, a subtitle, the
// step's content, and a pinned bottom CTA — the calm, one-thing-per-screen
// rhythm the rest of the app now uses.

// MARK: - Scaffold

struct WizardScaffold<Content: View, Footer: View>: View {
    var eyebrow: String? = nil
    let title: String
    var subtitle: String? = nil
    @ViewBuilder var content: Content
    @ViewBuilder var footer: Footer

    var body: some View {
        VStack(spacing: 0) {
            ScrollView {
                VStack(alignment: .leading, spacing: FlynnSpacing.md) {
                    VStack(alignment: .leading, spacing: FlynnSpacing.xs) {
                        if let eyebrow {
                            Text(eyebrow)
                                .flynnType(FlynnTypography.overline)
                                .foregroundColor(FlynnColor.primary)
                        }
                        Text(title)
                            .flynnType(FlynnTypography.displayMedium)
                            .foregroundColor(FlynnColor.textPrimary)
                            .fixedSize(horizontal: false, vertical: true)
                        if let subtitle {
                            Text(subtitle)
                                .flynnType(FlynnTypography.bodyLarge)
                                .foregroundColor(FlynnColor.textSecondary)
                                .fixedSize(horizontal: false, vertical: true)
                                .padding(.top, FlynnSpacing.xxs)
                        }
                    }
                    content
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, FlynnSpacing.lg)
                .padding(.top, FlynnSpacing.sm)
                .padding(.bottom, FlynnSpacing.xl)
            }
            .scrollDismissesKeyboard(.interactively)
            .dismissKeyboardOnTap()

            footer
                .padding(.horizontal, FlynnSpacing.lg)
                .padding(.top, FlynnSpacing.sm)
                .padding(.bottom, FlynnSpacing.md)
                .background(FlynnColor.background.ignoresSafeArea(edges: .bottom))
        }
    }
}

// MARK: - Welcome

struct WelcomeStep: View {
    @Bindable var model: OnboardingModel
    @Environment(AuthStore.self) private var auth
    @State private var confirmingSwitch = false

    var body: some View {
        VStack(spacing: FlynnSpacing.lg) {
            Spacer()
            Mascot(.wave, size: 132, backdrop: .cream)
            VStack(spacing: FlynnSpacing.sm) {
                Text("Let's get Flynn set up")
                    .flynnType(FlynnTypography.displayMedium)
                    .foregroundColor(FlynnColor.textPrimary)
                    .multilineTextAlignment(.center)
                Text("Two minutes. By the end, Flynn answers the calls you can't, books the job, and texts the client back — while you're still on the tools.")
                    .flynnType(FlynnTypography.bodyLarge)
                    .foregroundColor(FlynnColor.textSecondary)
                    .multilineTextAlignment(.center)
            }
            Spacer()
            FlynnGlassButton(title: "Let's go", action: { model.next() })
            // Signing in is a one-way door otherwise: the wizard's back button
            // only walks back through its own steps, so someone who signed up
            // with the wrong method — or the wrong account — had no route back
            // to the "email or mobile" choice short of deleting the app.
            Button("Signed up with the wrong account?") { confirmingSwitch = true }
                .flynnType(FlynnTypography.caption)
                .foregroundColor(FlynnColor.textTertiary)
                .frame(minHeight: 44)
        }
        .padding(.horizontal, FlynnSpacing.lg)
        .padding(.bottom, FlynnSpacing.md)
        .alert("Start again?", isPresented: $confirmingSwitch) {
            Button("Cancel", role: .cancel) { }
            Button("Sign out", role: .destructive) { Task { await auth.signOut() } }
        } message: {
            Text("You'll go back to the sign-in screen and can start with your mobile or a different email. Nothing you've entered so far is kept.")
        }
    }
}

// MARK: - Trade

struct TradeStep: View {
    @Bindable var model: OnboardingModel

    private let trades: [(String, String)] = [
        ("Plumber", "wrench.and.screwdriver.fill"),
        ("Electrician", "bolt.fill"),
        ("Builder", "hammer.fill"),
        ("Carpenter", "ruler.fill"),
        ("Landscaper", "leaf.fill"),
        ("Painter", "paintbrush.fill"),
        ("Cleaner", "sparkles"),
        ("HVAC", "wind"),
        ("Handyman", "screwdriver.fill"),
        ("Other", "ellipsis.circle.fill"),
    ]
    private let columns = [GridItem(.flexible(), spacing: FlynnSpacing.sm), GridItem(.flexible(), spacing: FlynnSpacing.sm)]

    var body: some View {
        WizardScaffold(
            eyebrow: "About you",
            title: "What's your trade?",
            subtitle: "So Flynn talks like someone who knows the job."
        ) {
            LazyVGrid(columns: columns, spacing: FlynnSpacing.sm) {
                ForEach(trades, id: \.0) { name, icon in
                    tradeChip(name, icon)
                }
            }
            .padding(.top, FlynnSpacing.sm)
        } footer: {
            FlynnGlassButton(title: "Continue", action: {
                if let trade = model.trade {
                    Analytics.capture(.onboardTradeSelected, ["trade": trade])
                    // On the person, not just the event — "how do plumbers
                    // convert vs cleaners" is a breakdown, and breakdowns need
                    // the attribute to be durable.
                    Analytics.setPersonProperties(["trade": trade])
                }
                model.next()
            }, isDisabled: model.trade == nil)
        }
    }

    private func tradeChip(_ name: String, _ icon: String) -> some View {
        let selected = model.trade == name
        return Button {
            model.trade = name
        } label: {
            VStack(spacing: FlynnSpacing.xs) {
                Image(systemName: icon)
                    .font(.system(size: 24, weight: .semibold))
                    .foregroundColor(selected ? FlynnColor.textInverse : FlynnColor.primary)
                Text(name)
                    .flynnType(FlynnTypography.h4)
                    .foregroundColor(selected ? FlynnColor.textInverse : FlynnColor.textPrimary)
            }
            .frame(maxWidth: .infinity)
            .frame(height: 96)
            .background(
                RoundedRectangle(cornerRadius: FlynnRadii.lg, style: .continuous)
                    .fill(selected ? FlynnColor.primary : FlynnColor.backgroundSecondary)
            )
            .overlay(
                RoundedRectangle(cornerRadius: FlynnRadii.lg, style: .continuous)
                    .strokeBorder(selected ? FlynnColor.primary : FlynnColor.borderSubtle,
                                  lineWidth: selected ? 0 : 1)
            )
        }
        .buttonStyle(FlynnPressable())
    }
}

// MARK: - Business details

struct BusinessStep: View {
    @Bindable var model: OnboardingModel
    @FocusState private var focus: Field?
    private enum Field { case name, services, pricing, area }

    @Environment(FlashStore.self) private var flash
    @State private var voice = VoiceCaptureManager()
    @State private var parsingVoice = false
    @State private var voicePayload: BrainVoiceFill.Payload?

    var body: some View {
        WizardScaffold(
            eyebrow: "About you",
            title: "Tell Flynn about the work",
            subtitle: "The more it knows, the less it sounds like a robot. You can change any of this later."
        ) {
            VStack(spacing: FlynnSpacing.md) {
                voiceRow
                field("Business name", text: $model.businessName, placeholder: "e.g. Reilly Plumbing", focused: .name)
                multiField("What you do", text: $model.services,
                           placeholder: "Blocked drains, hot water, leak repairs, bathroom renos…", focused: .services)
                multiField("Rough pricing", text: $model.pricing,
                           placeholder: "Call-out $90, hourly $120, most jobs $200–600…", focused: .pricing)
                field("Areas you serve", text: $model.serviceArea, placeholder: "Northern Beaches, North Shore", focused: .area)
            }
            .padding(.top, FlynnSpacing.sm)
        } footer: {
            FlynnGlassButton(title: "Continue", action: { model.saveThenNext() },
                             isLoading: model.working)
        }
        // The two multi-line fields take Return as a newline, so without this
        // there is no way off the keyboard except guessing where a safe tap is.
        // Prev/Next also mean the four fields can be filled without ever
        // reaching around the keyboard to aim at the next one.
        .toolbar {
            ToolbarItemGroup(placement: .keyboard) {
                Button { focus = previousField(from: focus) } label: {
                    Image(systemName: "chevron.up")
                }
                .disabled(previousField(from: focus) == nil)
                .accessibilityLabel("Previous field")

                Button { focus = nextField(from: focus) } label: {
                    Image(systemName: "chevron.down")
                }
                .disabled(nextField(from: focus) == nil)
                .accessibilityLabel("Next field")

                Spacer()
                Button("Done") { focus = nil }
                    .fontWeight(.semibold)
            }
        }
        .sheet(item: $voicePayload) { payload in
            BrainVoiceSheet(transcript: payload.transcript, proposals: payload.proposals, onApply: applyVoiceProposals)
        }
    }

    /// Hold to say your trade, prices, area and what you do in one go, instead
    /// of typing four fields. Reuses the Brain's own voice-fill pipeline —
    /// same "confirm before writing" sheet, since a misheard price here is
    /// just as costly as one misheard in the Brain proper.
    private var voiceRow: some View {
        HStack(alignment: .top, spacing: FlynnSpacing.sm) {
            VStack(alignment: .leading, spacing: 2) {
                Text(voiceTitle)
                    .flynnType(FlynnTypography.label)
                    .foregroundColor(voiceIsBroken ? FlynnColor.error : FlynnColor.textPrimary)
                // Holding the mic used to show nothing at all until the sheet
                // appeared, so there was no way to tell a working recogniser
                // from a dead one until it was over. Echoing the partials back
                // is the whole feedback loop: words appearing as you speak is
                // proof it heard you, and the meter alone never was.
                Text(voiceDetail)
                    .flynnType(FlynnTypography.caption)
                    .foregroundColor(voiceIsBroken ? FlynnColor.error : FlynnColor.textTertiary)
                    .lineLimit(3)
                    .animation(.easeOut(duration: 0.12), value: voiceDetail)
                if voice.state == .denied {
                    Button("Open Settings") {
                        if let url = URL(string: UIApplication.openSettingsURLString) {
                            UIApplication.shared.open(url)
                        }
                    }
                    .flynnType(FlynnTypography.caption)
                    .foregroundColor(FlynnColor.primary)
                    .padding(.top, 2)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .accessibilityElement(children: .combine)

            if parsingVoice {
                ProgressView().frame(width: 60, height: 60)
            } else {
                VoiceHoldButton(
                    voice: voice,
                    onSubmit: { transcript in Task { await parseVoice(transcript) } },
                    onNothingHeard: { flash.show("Didn't catch that. Hold the mic and speak, then let go.", kind: .error) },
                    onTapTooQuick: { }
                )
            }
        }
        .padding(FlynnSpacing.md)
        .frame(maxWidth: .infinity)
        .flynnCardSurface(.quiet)
    }

    private var voiceIsBroken: Bool {
        if case .error = voice.state { return true }
        return voice.state == .denied
    }

    private var voiceTitle: String {
        if parsingVoice { return "Working out what you said" }
        switch voice.state {
        case .listening: return "Listening"
        case .denied: return "Flynn can't hear you"
        case .error: return "The mic didn't work"
        case .idle: return "Or just say it"
        }
    }

    private var voiceDetail: String {
        if parsingVoice { return "One sec." }
        switch voice.state {
        case .listening:
            let heard = voice.transcript.trimmingCharacters(in: .whitespacesAndNewlines)
            return heard.isEmpty ? "Listening — say what you do and what you charge." : heard
        case .denied:
            return "Microphone and speech access are turned off for Flynn."
        case .error(let message):
            return message
        case .idle:
            return "Tap to start talking, or hold and let go."
        }
    }

    private func parseVoice(_ transcript: String) async {
        parsingVoice = true
        defer { parsingVoice = false }
        do {
            let parsed = try await BrainVoiceFill.parse(transcript: transcript)
            voicePayload = .init(transcript: transcript, proposals: parsed)
        } catch {
            flash.error(error.localizedDescription)
        }
    }

    /// Maps whatever Flynn heard onto the wizard's own fields. Fields the
    /// wizard doesn't collect (description, hours) are proposed and shown for
    /// confirmation like any other, but have nowhere to land here — dropped
    /// silently rather than invented a place for them.
    private func applyVoiceProposals(_ accepted: [BrainVoiceFill.Proposal]) {
        var services: [String] = []
        for p in accepted {
            switch p.field {
            case .businessType: model.trade = p.value
            case .pricingNotes: model.pricing = appendField(model.pricing, p.value)
            case .serviceArea: model.serviceArea = appendField(model.serviceArea, p.value)
            case .service:
                let detail = p.detail.map { " (\($0))" } ?? ""
                services.append("\(p.value)\(detail)")
            case .businessDescription, .hours:
                continue
            }
        }
        if !services.isEmpty {
            model.services = appendField(model.services, services.joined(separator: ", "))
        }
    }

    private func appendField(_ existing: String, _ addition: String) -> String {
        let trimmed = existing.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? addition : "\(trimmed), \(addition)"
    }

    // MARK: - Focus order

    private static let fieldOrder: [Field] = [.name, .services, .pricing, .area]

    private func nextField(from current: Field?) -> Field? {
        guard let current, let i = Self.fieldOrder.firstIndex(of: current),
              i + 1 < Self.fieldOrder.count else { return nil }
        return Self.fieldOrder[i + 1]
    }

    private func previousField(from current: Field?) -> Field? {
        guard let current, let i = Self.fieldOrder.firstIndex(of: current), i > 0 else { return nil }
        return Self.fieldOrder[i - 1]
    }

    /// Return on a single-line field moves on; from the last one it just closes
    /// the keyboard so the Continue button is reachable.
    private func advance(from current: Field) {
        focus = nextField(from: current)
    }

    private func field(_ label: String, text: Binding<String>, placeholder: String, focused: Field) -> some View {
        VStack(alignment: .leading, spacing: FlynnSpacing.xxs) {
            Text(label).flynnType(FlynnTypography.label).foregroundColor(FlynnColor.textSecondary)
            TextField(placeholder, text: text)
                .flynnType(FlynnTypography.bodyLarge)
                .focused($focus, equals: focused)
                .textInputAutocapitalization(.words)
                .autocorrectionDisabled(focused == .name)
                .textContentType(focused == .name ? .organizationName : nil)
                // Single-line fields advance; the last one closes the keyboard
                // rather than leaving the user hunting for somewhere to tap.
                .submitLabel(focused == .area ? .done : .next)
                .onSubmit { advance(from: focused) }
                .padding(FlynnSpacing.md)
                .background(RoundedRectangle(cornerRadius: FlynnRadii.md, style: .continuous).fill(FlynnColor.backgroundSecondary))
                .overlay(RoundedRectangle(cornerRadius: FlynnRadii.md, style: .continuous)
                    .strokeBorder(focus == focused ? FlynnColor.primary : FlynnColor.borderSubtle, lineWidth: focus == focused ? 1.5 : 1))
        }
    }

    private func multiField(_ label: String, text: Binding<String>, placeholder: String, focused: Field) -> some View {
        VStack(alignment: .leading, spacing: FlynnSpacing.xxs) {
            Text(label).flynnType(FlynnTypography.label).foregroundColor(FlynnColor.textSecondary)
            // Vertical-axis TextFields take Return as a newline, so they get no
            // submitLabel — the keyboard toolbar's Done is their way out.
            TextField(placeholder, text: text, axis: .vertical)
                .lineLimit(2...5)
                .flynnType(FlynnTypography.bodyLarge)
                .focused($focus, equals: focused)
                .textInputAutocapitalization(.sentences)
                .padding(FlynnSpacing.md)
                .background(RoundedRectangle(cornerRadius: FlynnRadii.md, style: .continuous).fill(FlynnColor.backgroundSecondary))
                .overlay(RoundedRectangle(cornerRadius: FlynnRadii.md, style: .continuous)
                    .strokeBorder(focus == focused ? FlynnColor.primary : FlynnColor.borderSubtle, lineWidth: focus == focused ? 1.5 : 1))
        }
    }
}

// MARK: - Calendar

struct CalendarStep: View {
    @Bindable var model: OnboardingModel
    @Environment(FlashStore.self) private var flash
    @State private var connecting: String?
    @State private var connected: String?
    @State private var errorMessage: String?

    var body: some View {
        WizardScaffold(
            eyebrow: "So it can book",
            title: "Connect your calendar",
            subtitle: "Flynn only offers times you're actually free, and drops booked jobs straight into your calendar."
        ) {
            VStack(spacing: FlynnSpacing.sm) {
                connectRow("Google Calendar", "calendar", tint: FlynnColor.primary, connecting: connecting == "google") {
                    Task { await connectGoogle() }
                }
                connectRow("Apple Calendar", "calendar.badge.plus", tint: FlynnColor.textPrimary, connecting: connecting == "apple") {
                    Task { await connectApple() }
                }
                if let errorMessage {
                    Text(errorMessage)
                        .flynnType(FlynnTypography.caption)
                        .foregroundColor(FlynnColor.error)
                }
            }
            .padding(.top, FlynnSpacing.sm)
        } footer: {
            Button("I'll connect it later") { model.next() }
                .flynnType(FlynnTypography.label)
                .foregroundColor(FlynnColor.textSecondary)
                .frame(maxWidth: .infinity, minHeight: 44)
                .disabled(connecting != nil)
        }
    }

    /// Say it connected before moving on.
    ///
    /// Both providers used to call `model.next()` the instant the handshake
    /// returned, so the screen just vanished — from the user's side, tapping
    /// Connect and tapping Skip looked identical, and there was nothing
    /// anywhere afterwards confirming the calendar was actually linked.
    private func confirmConnected(_ provider: String) async {
        connected = provider
        flash.success("\(provider) connected.")
        try? await Task.sleep(for: .milliseconds(900))
        model.next()
    }

    private func connectGoogle() async {
        connecting = "google"
        errorMessage = nil
        do {
            try await GoogleCalendarConnect.connect()
            Analytics.capture(.onboardCalendarConnected, ["provider": "google"])
            connecting = nil
            await confirmConnected("Google Calendar")
        } catch GoogleCalendarConnect.ConnectError.cancelled {
            connecting = nil
        } catch {
            connecting = nil
            errorMessage = error.localizedDescription
        }
    }

    private func connectApple() async {
        connecting = "apple"
        errorMessage = nil
        do {
            let granted = try await AppleCalendarService().requestAccess()
            guard granted else {
                connecting = nil
                errorMessage = "Calendar access is off — turn it on in Settings to connect Apple Calendar."
                return
            }
            try await setAppleCalendarConnected()
            Analytics.capture(.onboardCalendarConnected, ["provider": "apple"])
            connecting = nil
            await confirmConnected("Apple Calendar")
        } catch {
            connecting = nil
            errorMessage = error.localizedDescription
        }
    }

    private func setAppleCalendarConnected() async throws {
        struct Patch: Encodable { let apple_calendar_connected: Bool }
        let session = try await FlynnSupabase.client.auth.session
        try await FlynnSupabase.client
            .from("users")
            .update(Patch(apple_calendar_connected: true))
            .eq("id", value: session.user.id.uuidString)
            .execute()
    }

    private func connectRow(_ title: String, _ icon: String, tint: Color, connecting: Bool, action: @escaping () -> Void) -> some View {
        let isConnected = connected == title
        return Button(action: action) {
            HStack(spacing: FlynnSpacing.md) {
                Image(systemName: isConnected ? "checkmark.circle.fill" : icon)
                    .font(.system(size: 20, weight: .semibold))
                    .foregroundColor(isConnected ? FlynnColor.success : tint)
                    .frame(width: 28)
                Text(isConnected ? "\(title) connected" : title)
                    .flynnType(FlynnTypography.h4)
                    .foregroundColor(FlynnColor.textPrimary)
                Spacer()
                if connecting {
                    ProgressView()
                } else if !isConnected {
                    Image(systemName: "chevron.right").font(.system(size: 14, weight: .semibold)).foregroundColor(FlynnColor.textTertiary)
                }
            }
            .padding(FlynnSpacing.md)
            .frame(maxWidth: .infinity)
            .flynnCardSurface(.quiet)
        }
        .buttonStyle(FlynnPressable())
        .disabled(self.connecting != nil || connected != nil)
        .accessibilityLabel(isConnected ? "\(title), connected" : "Connect \(title)")
    }
}

// MARK: - Demo call (the value moment)

struct DemoCallStep: View {
    @Bindable var model: OnboardingModel
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(AuthStore.self) private var auth
    @Environment(FlashStore.self) private var flash

    @FocusState private var phoneFieldFocused: Bool
    @State private var phone = ""
    @State private var smsCode = ""
    @State private var codeSent = false

    private var status: OnboardingModel.DemoStatus { model.demoStatus }

    var body: some View {
        WizardScaffold(
            eyebrow: "Hear it for yourself",
            title: title,
            subtitle: subtitle
        ) {
            Group {
                switch status {
                case .idle:      Mascot(.phone, size: 132, backdrop: .cream)
                case .ringing:   ringingArt
                case .completed: payoffCard
                case .failed:    Mascot(.thinking, size: 120, backdrop: .cream)
                case .needsPhone: phoneEntry
                }
            }
            .padding(.top, FlynnSpacing.lg)
            .frame(maxWidth: .infinity)
        } footer: {
            switch status {
            case .idle:
                FlynnGlassButton(title: "Call me now",
                                 action: { Task { await model.startDemoCall() } },
                                 icon: Image(systemName: "phone.fill"))
            case .ringing:
                HStack(spacing: FlynnSpacing.xs) {
                    ProgressView().controlSize(.small)
                    Text("Calling you now…").flynnType(FlynnTypography.label).foregroundColor(FlynnColor.textSecondary)
                }
                .frame(maxWidth: .infinity, minHeight: 56)
            case .completed:
                FlynnGlassButton(title: "Set Flynn live", action: { model.next() })
            case .needsPhone:
                VStack(spacing: FlynnSpacing.xs) {
                    FlynnGlassButton(
                        title: codeSent ? "Verify and call me" : "Text me a code",
                        action: { Task { await submitPhoneStep() } },
                        isLoading: auth.isSubmitting,
                        isDisabled: codeSent ? smsCode.count < 6 : e164Phone.count < 9
                    )
                    Button("Skip for now") { model.next() }
                        .flynnType(FlynnTypography.caption)
                        .foregroundColor(FlynnColor.textTertiary)
                        .frame(minHeight: 44)
                }
            case .failed:
                VStack(spacing: FlynnSpacing.xs) {
                    FlynnGlassButton(title: "Try the call again",
                                     action: { Task { await model.startDemoCall() } },
                                     icon: Image(systemName: "arrow.clockwise"))
                    Button("Skip for now") { model.next() }
                        .flynnType(FlynnTypography.caption)
                        .foregroundColor(FlynnColor.textTertiary)
                        .frame(minHeight: 40)
                }
            }
        }
    }

    private var title: String {
        switch status {
        case .completed: return "That's Flynn."
        case .needsPhone: return codeSent ? "Check your texts" : "What's your mobile?"
        case .failed:    return "Didn't quite connect"
        default:         return "Flynn's going to ring you"
        }
    }

    private var subtitle: String {
        switch status {
        case .completed:
            // This was a demo against the user's own phone: no job row is
            // written and nobody gets texted, so the copy can only describe
            // what the call itself did.
            return "That was a test run, so nothing's been saved or sent. Once you're live, calls like that get booked in and the caller gets the link below."
        case .needsPhone:
            return codeSent
                ? "Pop in the code and Flynn will ring you straight away."
                : "You signed up with your email, so Flynn doesn't have a number to call yet. Add it here and you'll get the test call — it's the same number your missed calls will divert from."
        case .failed:
            return "We couldn't reach your phone just now. Give it another go, or skip and set Flynn live — you can always test it later."
        default:
            return "Pick up and talk like a customer — ask about a job, a price, when you could come out. Flynn uses what you just told it."
        }
    }

    /// Ask for the mobile right here rather than sending them to Settings.
    private var phoneEntry: some View {
        VStack(spacing: FlynnSpacing.md) {
            Mascot(.phone, size: 96, backdrop: .cream)
            FlynnTextField(
                label: "Your mobile",
                text: $phone,
                placeholder: "0412 345 678",
                keyboardType: .phonePad,
                textContentType: .telephoneNumber,
                submitLabel: .done
            )
            .focused($phoneFieldFocused)
            .disabled(codeSent)
            if codeSent {
                FlynnTextField(
                    label: "6-digit code",
                    text: $smsCode,
                    placeholder: "000000",
                    keyboardType: .numberPad,
                    textContentType: .oneTimeCode,
                    submitLabel: .done,
                    helperText: "Sent to \(e164Phone)."
                )
                Button("Use a different number") {
                    codeSent = false
                    smsCode = ""
                }
                .flynnType(FlynnTypography.caption)
                .foregroundColor(FlynnColor.primary)
                .frame(minHeight: 44)
            }
        }
        .onAppear { if phone.isEmpty { phoneFieldFocused = true } }
    }

    /// Same normalisation as the login screen: Supabase has to see one
    /// canonical E.164 string or the code never matches the number.
    private var e164Phone: String {
        let raw = phone.trimmingCharacters(in: .whitespacesAndNewlines)
        let digits = raw.filter(\.isNumber)
        guard !digits.isEmpty else { return "" }
        if raw.hasPrefix("+") { return "+" + digits }
        if digits.hasPrefix("61") && digits.count == 11 { return "+" + digits }
        if digits.hasPrefix("0") && digits.count == 10 { return "+61" + digits.dropFirst() }
        if digits.hasPrefix("64") { return "+" + digits }
        return "+" + digits
    }

    private func submitPhoneStep() async {
        if !codeSent {
            if await auth.addPhone(e164Phone) {
                codeSent = true
            } else {
                flash.error(auth.errorMessage ?? "Couldn't text that number. Check it and try again.")
            }
            return
        }
        guard await auth.verifyPhoneChange(phone: e164Phone, token: smsCode) else {
            flash.error(auth.errorMessage ?? "That code didn't work. Try again.")
            return
        }
        flash.success("Number confirmed.")
        codeSent = false
        smsCode = ""
        // The number is on the account now, so the call that was impossible a
        // moment ago will go through.
        await model.startDemoCall()
    }

    private var ringingArt: some View {
        ZStack {
            ForEach(0..<3) { i in
                Circle().stroke(FlynnColor.primary.opacity(0.4), lineWidth: 2)
                    .frame(width: 120 + CGFloat(i) * 44, height: 120 + CGFloat(i) * 44)
                    // Rings hold still under Reduce Motion — the ringing state
                    // is carried by the copy above them either way.
                    .scaleEffect(!reduceMotion && status == .ringing ? 1.05 : 1)
                    .opacity(status == .ringing ? (reduceMotion ? 0.5 : 0.2) : 0.6)
                    .animation(
                        reduceMotion ? .default
                            : .easeOut(duration: 1.4).repeatForever(autoreverses: true).delay(Double(i) * 0.2),
                        value: status
                    )
            }
            Image(systemName: "phone.fill")
                .font(.system(size: 44, weight: .semibold))
                .foregroundColor(FlynnColor.textInverse)
                .frame(width: 108, height: 108)
                .background(Circle().fill(FlynnColor.primary))
        }
        .frame(height: 220)
    }

    private var payoffCard: some View {
        VStack(alignment: .leading, spacing: FlynnSpacing.sm) {
            Label("What Flynn heard", systemImage: "checkmark.seal.fill")
                .flynnType(FlynnTypography.overline)
                .foregroundColor(FlynnColor.success)
            Text(jobTitle)
                .flynnType(FlynnTypography.h3)
                .foregroundColor(FlynnColor.textPrimary)
            if let transcript = model.demoTranscript, !transcript.isEmpty {
                Text(transcript)
                    .flynnType(FlynnTypography.bodyMedium)
                    .foregroundColor(FlynnColor.textSecondary)
                    .lineLimit(4)
                    .fixedSize(horizontal: false, vertical: true)
            } else {
                Text("Flynn worked out the job from the call. On a real one it books it into your calendar and texts the caller back.")
                    .flynnType(FlynnTypography.bodyMedium)
                    .foregroundColor(FlynnColor.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            if let url = model.demoBookingUrl {
                bookingLinkPreview(url)
            }
        }
        .padding(FlynnSpacing.lg)
        .frame(maxWidth: .infinity, alignment: .leading)
        .flynnCardSurface(.raised)
    }

    /// The actual link a real missed call would have texted the caller — not a
    /// mockup. It's provisioned the moment the demo call completes.
    private func bookingLinkPreview(_ url: String) -> some View {
        VStack(alignment: .leading, spacing: FlynnSpacing.xxs) {
            Text("This is the link a missed call would text back")
                .flynnType(FlynnTypography.caption)
                .foregroundColor(FlynnColor.textTertiary)
            HStack(spacing: FlynnSpacing.xs) {
                Image(systemName: "link")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(FlynnColor.primary)
                Text(url)
                    .flynnType(FlynnTypography.bodyMedium)
                    .foregroundColor(FlynnColor.primary)
                    .lineLimit(1)
                    .truncationMode(.middle)
            }
        }
        .padding(.top, FlynnSpacing.xs)
    }

    private var jobTitle: String {
        if let job = model.demoJobTitle, !job.isEmpty { return job.capitalized }
        if let trade = model.trade { return "\(trade) job" }
        return "New job"
    }
}

// MARK: - Paywall handoff

struct PaywallStep: View {
    @Bindable var model: OnboardingModel
    /// Carries the plan they tapped, so the StoreKit sheet opens with it
    /// already chosen.
    let onStart: (String?) -> Void

    @Environment(SubscriptionStore.self) private var store

    /// Featured tier first, so the card order matches the real paywall sheet.
    private var tiers: [SubscriptionProduct] {
        store.products.sorted { $0.isMostPopular && !$1.isMostPopular }
    }

    var body: some View {
        WizardScaffold(
            eyebrow: "Go live",
            title: "Start your 7-day free trial",
            subtitle: "Cancel anytime before it ends and you won't be charged."
        ) {
            VStack(spacing: FlynnSpacing.sm) {
                if tiers.isEmpty {
                    // Prices come from StoreKit and are storefront-specific, so
                    // there is no safe number to print before they resolve —
                    // hardcoding one shows a US reviewer AUD pricing that never
                    // matches the sheet they're about to see.
                    pendingTiers
                } else {
                    ForEach(tiers) { item in
                        Button { onStart(item.product.id) } label: { tier(item) }
                            .buttonStyle(FlynnPressable())
                            .accessibilityLabel("Choose \(item.plan.displayName), \(item.displayPrice) a month")
                    }
                }
            }
            .padding(.top, FlynnSpacing.sm)
        } footer: {
            VStack(spacing: FlynnSpacing.xs) {
                // Falls back to the featured plan when they use the footer CTA
                // rather than tapping a specific card.
                FlynnGlassButton(title: "Start free trial",
                                 action: { onStart(tiers.first(where: { $0.isMostPopular })?.product.id) },
                                 isLoading: model.working)
                Text("7 days free, then your plan. Card required.")
                    .flynnType(FlynnTypography.caption)
                    .foregroundColor(FlynnColor.textTertiary)
            }
        }
        .onAppear { Analytics.capture(.paywallViewed, ["source": "onboarding"]) }
        // The store is bootstrapped at launch, but a signup that started offline
        // would otherwise sit on the neutral card for the rest of the funnel.
        .task { if store.products.isEmpty { await store.load() } }
    }

    /// Tapping a card opens the StoreKit sheet with that plan already selected.
    /// These used to be inert, so choosing "Flynn Receptionist" here and then
    /// being shown the same two plans again with neither selected asked the
    /// same question twice and lost the answer in between.
    private func tier(_ item: SubscriptionProduct) -> some View {
        let featured = item.isMostPopular
        return VStack(alignment: .leading, spacing: FlynnSpacing.xs) {
            HStack(alignment: .firstTextBaseline) {
                Text(item.plan.displayName)
                    .flynnType(FlynnTypography.h3)
                    .foregroundColor(FlynnColor.textPrimary)
                Spacer()
                HStack(alignment: .firstTextBaseline, spacing: 2) {
                    Text(item.displayPrice)
                        .flynnType(FlynnTypography.h2)
                        .foregroundColor(featured ? FlynnColor.primary : FlynnColor.textPrimary)
                    Text("/mo").flynnType(FlynnTypography.caption).foregroundColor(FlynnColor.textTertiary)
                }
            }
            ForEach(item.plan.features, id: \.self) { line in
                Text(line)
                    .flynnType(FlynnTypography.bodyMedium)
                    .foregroundColor(FlynnColor.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            if let intro = item.introOfferDescription {
                Text(intro)
                    .flynnType(FlynnTypography.caption)
                    .foregroundColor(FlynnColor.primary)
            }
        }
        .padding(FlynnSpacing.lg)
        .frame(maxWidth: .infinity, alignment: .leading)
        .flynnCardSurface(featured ? .raised : .quiet,
                          borderColor: featured ? FlynnColor.primary : FlynnColor.border)
    }

    private var pendingTiers: some View {
        VStack(alignment: .leading, spacing: FlynnSpacing.xs) {
            Text("Two plans")
                .flynnType(FlynnTypography.h3)
                .foregroundColor(FlynnColor.textPrimary)
            Text("Flynn Link gets you the missed-call booking link, invoices and quotes. Flynn Receptionist adds the bit where Flynn answers the call and books the job. Both start with 7 days free, and you'll see the price for your region on the next screen.")
                .flynnType(FlynnTypography.bodyMedium)
                .foregroundColor(FlynnColor.textSecondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(FlynnSpacing.lg)
        .frame(maxWidth: .infinity, alignment: .leading)
        .flynnCardSurface(.quiet)
    }
}

// MARK: - Forwarding

struct ForwardingStep: View {
    @Bindable var model: OnboardingModel
    @Environment(\.openURL) private var openURL

    var body: some View {
        WizardScaffold(
            eyebrow: "Last step",
            title: "Send Flynn your missed calls",
            subtitle: "One tap sets your phone to divert calls you can't answer to Flynn. Your own number never changes."
        ) {
            VStack(spacing: FlynnSpacing.md) {
                if let number = model.assignedNumber, !number.isEmpty {
                    VStack(spacing: FlynnSpacing.xs) {
                        Text("Flynn answers on")
                            .flynnType(FlynnTypography.overline).foregroundColor(FlynnColor.textTertiary)
                        Text(formatAU(number))
                            .flynnType(FlynnTypography.h2).foregroundColor(FlynnColor.primary)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(FlynnSpacing.lg)
                    .flynnCardSurface(.quiet)
                } else if model.working {
                    ProgressView("Grabbing your number…").padding(FlynnSpacing.lg)
                } else if model.poolEmpty {
                    VStack(spacing: FlynnSpacing.xs) {
                        Image(systemName: "phone.badge.plus")
                            .font(.system(size: 24, weight: .semibold))
                            .foregroundColor(FlynnColor.textTertiary)
                        Text("We're out of numbers right this second")
                            .flynnType(FlynnTypography.h4).foregroundColor(FlynnColor.textPrimary)
                        Text("More come free constantly — try again in a moment.")
                            .flynnType(FlynnTypography.caption).foregroundColor(FlynnColor.textSecondary)
                            .multilineTextAlignment(.center)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(FlynnSpacing.lg)
                    .flynnCardSurface(.quiet)
                } else if let numberError = model.numberError {
                    // Any other assign-number failure (402, 409, 500, offline).
                    // `numberError` was written by assignNumber() but read by
                    // nothing, so this state used to render an empty step whose
                    // primary button silently jumped to "You're all set" —
                    // leaving a paying user with no number and no idea.
                    VStack(spacing: FlynnSpacing.xs) {
                        Image(systemName: "exclamationmark.triangle.fill")
                            .font(.system(size: 24, weight: .semibold))
                            .foregroundColor(FlynnColor.error)
                        Text("Couldn't set your number up")
                            .flynnType(FlynnTypography.h4).foregroundColor(FlynnColor.textPrimary)
                        Text(numberError)
                            .flynnType(FlynnTypography.caption).foregroundColor(FlynnColor.textSecondary)
                            .multilineTextAlignment(.center)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(FlynnSpacing.lg)
                    .flynnCardSurface(.quiet)
                }

                stepRow(1, "Tap ‘Divert my calls’ — it dials a short code")
                stepRow(2, "Press call, then come back here")
                stepRow(3, "Flynn checks it took, and you're live")
            }
            .padding(.top, FlynnSpacing.sm)
        } footer: {
            VStack(spacing: FlynnSpacing.xs) {
                if model.forwardingStatus == .verifying {
                    HStack(spacing: FlynnSpacing.xs) {
                        ProgressView().controlSize(.small)
                        Text("Checking your divert…").flynnType(FlynnTypography.label).foregroundColor(FlynnColor.textSecondary)
                    }
                    .frame(maxWidth: .infinity, minHeight: 56)
                } else if model.poolEmpty || model.numberError != nil {
                    FlynnGlassButton(title: "Try again",
                                     action: { Task { await model.assignNumber() } },
                                     icon: Image(systemName: "arrow.clockwise"))
                    Button("I'll finish this later") { model.advance(to: .done) }
                        .flynnType(FlynnTypography.caption)
                        .foregroundColor(FlynnColor.textTertiary)
                        .frame(minHeight: 40)
                } else if !model.forwardingDialled {
                    FlynnGlassButton(title: "Divert my calls",
                                     action: dialForwarding,
                                     icon: Image(systemName: "phone.arrow.right.fill"))
                    Button("Skip for now") { model.advance(to: .done) }
                        .flynnType(FlynnTypography.caption)
                        .foregroundColor(FlynnColor.textTertiary)
                        .frame(minHeight: 40)
                } else {
                    if model.forwardingStatus == .unconfirmed {
                        Text("Couldn't confirm it yet — make sure you pressed call after the code, then try again.")
                            .flynnType(FlynnTypography.caption)
                            .foregroundColor(FlynnColor.textSecondary)
                            .multilineTextAlignment(.center)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    FlynnGlassButton(title: "Check it's working",
                                     action: { Task { await model.verifyForwarding() } },
                                     icon: Image(systemName: "checkmark.shield.fill"))
                    Button("It's set — continue") { model.advance(to: .done) }
                        .flynnType(FlynnTypography.caption)
                        .foregroundColor(FlynnColor.textTertiary)
                        .frame(minHeight: 40)
                }
            }
        }
    }

    private func stepRow(_ n: Int, _ text: String) -> some View {
        HStack(alignment: .top, spacing: FlynnSpacing.sm) {
            Text("\(n)")
                .flynnType(FlynnTypography.label).foregroundColor(FlynnColor.textInverse)
                .frame(width: 26, height: 26)
                .background(Circle().fill(FlynnColor.primary))
            Text(text).flynnType(FlynnTypography.bodyMedium).foregroundColor(FlynnColor.textPrimary)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 0)
        }
    }

    private func dialForwarding() {
        guard let number = model.assignedNumber, !number.isEmpty else {
            // Never jump to "You're all set" with no number — that told a paying
            // user they were live when nothing had been provisioned. Surface it
            // and let the error branch offer a retry instead.
            model.numberError = "We haven't got your number yet. Tap Try again."
            return
        }
        // Conditional-forward on no-answer: **61*<number># . Reuses the same
        // MMI approach as CallForwardingView. `#` must be percent-escaped.
        let digits = number.replacingOccurrences(of: " ", with: "")
        let code = "**61*\(digits)#".replacingOccurrences(of: "#", with: "%23")
        if let url = URL(string: "tel://\(code)") {
            model.forwardingDialled = true
            model.forwardingStatus = .idle
            Analytics.capture(.forwardingCodeDialled)
            openURL(url)
            // The user leaves for the Phone app to press call, then comes back
            // and taps "Check it's working" (server test call, Gate 2.9) or
            // "It's set — continue".
        }
    }

    private func formatAU(_ e164: String) -> String {
        guard e164.hasPrefix("+61"), e164.count == 12 else { return e164 }
        let local = "0" + e164.dropFirst(3)
        return "\(local.prefix(4)) \(local.dropFirst(4).prefix(3)) \(local.dropFirst(7))"
    }
}

// MARK: - Done

struct DoneStep: View {
    @Bindable var model: OnboardingModel
    let onFinish: () -> Void

    var body: some View {
        VStack(spacing: FlynnSpacing.lg) {
            Spacer()
            Mascot(.thumbsup, size: 132, backdrop: .cream)
            VStack(spacing: FlynnSpacing.sm) {
                Text("You're all set")
                    .flynnType(FlynnTypography.displayMedium)
                    .foregroundColor(FlynnColor.textPrimary)
                Text(closingLine)
                    .flynnType(FlynnTypography.bodyLarge)
                    .foregroundColor(FlynnColor.textSecondary)
                    .multilineTextAlignment(.center)
            }
            Spacer()
            FlynnGlassButton(title: "Go to Flynn", action: { model.markComplete(); onFinish() })
        }
        .padding(.horizontal, FlynnSpacing.lg)
        .padding(.bottom, FlynnSpacing.md)
    }

    /// Only the server-verified path gets to say Flynn is answering. Most
    /// signups can't be checked automatically, and a carrier divert that quietly
    /// didn't take costs them every call they miss, so those get told how to
    /// check for themselves instead.
    private var closingLine: String {
        if model.forwardingVerified {
            return "Flynn's answering your missed calls now. Hold the mic on Home to raise an invoice, and Flynn chases it until it's paid."
        }
        if model.forwardingDialled {
            return "Your divert's dialled, but we couldn't confirm it from here. Ring your number from another phone and let it go unanswered, and Flynn should pick up."
        }
        return "Flynn's ready. Divert your calls any time from Settings, and it starts answering."
    }
}
