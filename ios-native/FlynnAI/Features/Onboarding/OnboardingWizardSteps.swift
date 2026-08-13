import SwiftUI

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
        }
        .padding(.horizontal, FlynnSpacing.lg)
        .padding(.bottom, FlynnSpacing.md)
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
        .sheet(item: $voicePayload) { payload in
            BrainVoiceSheet(transcript: payload.transcript, proposals: payload.proposals, onApply: applyVoiceProposals)
        }
    }

    /// Hold to say your trade, prices, area and what you do in one go, instead
    /// of typing four fields. Reuses the Brain's own voice-fill pipeline —
    /// same "confirm before writing" sheet, since a misheard price here is
    /// just as costly as one misheard in the Brain proper.
    private var voiceRow: some View {
        HStack(spacing: FlynnSpacing.sm) {
            VStack(alignment: .leading, spacing: 1) {
                Text("Or just say it")
                    .flynnType(FlynnTypography.label)
                    .foregroundColor(FlynnColor.textPrimary)
                Text("Hold and talk instead of typing")
                    .flynnType(FlynnTypography.caption)
                    .foregroundColor(FlynnColor.textTertiary)
            }
            Spacer(minLength: 0)
            VoiceHoldButton(
                voice: voice,
                onSubmit: { transcript in Task { await parseVoice(transcript) } },
                onNothingHeard: { flash.show("Didn't catch that.", kind: .error) }
            )
            .disabled(parsingVoice)
        }
        .padding(FlynnSpacing.md)
        .frame(maxWidth: .infinity)
        .flynnCardSurface(.quiet)
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

    private func field(_ label: String, text: Binding<String>, placeholder: String, focused: Field) -> some View {
        VStack(alignment: .leading, spacing: FlynnSpacing.xxs) {
            Text(label).flynnType(FlynnTypography.label).foregroundColor(FlynnColor.textSecondary)
            TextField(placeholder, text: text)
                .flynnType(FlynnTypography.bodyLarge)
                .focused($focus, equals: focused)
                .padding(FlynnSpacing.md)
                .background(RoundedRectangle(cornerRadius: FlynnRadii.md, style: .continuous).fill(FlynnColor.backgroundSecondary))
                .overlay(RoundedRectangle(cornerRadius: FlynnRadii.md, style: .continuous)
                    .strokeBorder(focus == focused ? FlynnColor.primary : FlynnColor.borderSubtle, lineWidth: focus == focused ? 1.5 : 1))
        }
    }

    private func multiField(_ label: String, text: Binding<String>, placeholder: String, focused: Field) -> some View {
        VStack(alignment: .leading, spacing: FlynnSpacing.xxs) {
            Text(label).flynnType(FlynnTypography.label).foregroundColor(FlynnColor.textSecondary)
            TextField(placeholder, text: text, axis: .vertical)
                .lineLimit(2...5)
                .flynnType(FlynnTypography.bodyLarge)
                .focused($focus, equals: focused)
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
    @State private var connecting: String?
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

    private func connectGoogle() async {
        connecting = "google"
        errorMessage = nil
        do {
            try await GoogleCalendarConnect.connect()
            Analytics.capture(.onboardCalendarConnected, ["provider": "google"])
            connecting = nil
            model.next()
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
            model.next()
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
        Button(action: action) {
            HStack(spacing: FlynnSpacing.md) {
                Image(systemName: icon).font(.system(size: 20, weight: .semibold)).foregroundColor(tint).frame(width: 28)
                Text(title).flynnType(FlynnTypography.h4).foregroundColor(FlynnColor.textPrimary)
                Spacer()
                if connecting {
                    ProgressView()
                } else {
                    Image(systemName: "chevron.right").font(.system(size: 14, weight: .semibold)).foregroundColor(FlynnColor.textTertiary)
                }
            }
            .padding(FlynnSpacing.md)
            .frame(maxWidth: .infinity)
            .flynnCardSurface(.quiet)
        }
        .buttonStyle(FlynnPressable())
        .disabled(self.connecting != nil)
    }
}

// MARK: - Demo call (the value moment)

struct DemoCallStep: View {
    @Bindable var model: OnboardingModel

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
        case .failed:    return "Didn't quite connect"
        default:         return "Flynn's going to ring you"
        }
    }

    private var subtitle: String {
        switch status {
        case .completed:
            return "Every call you miss gets answered like that — and the job lands on your Home screen, ready to send."
        case .failed:
            return "We couldn't reach your phone just now. Give it another go, or skip and set Flynn live — you can always test it later."
        default:
            return "Pick up and talk like a customer — ask about a job, a price, when you could come out. Flynn uses what you just told it."
        }
    }

    private var ringingArt: some View {
        ZStack {
            ForEach(0..<3) { i in
                Circle().stroke(FlynnColor.primary.opacity(0.4), lineWidth: 2)
                    .frame(width: 120 + CGFloat(i) * 44, height: 120 + CGFloat(i) * 44)
                    .scaleEffect(status == .ringing ? 1.05 : 1)
                    .opacity(status == .ringing ? 0.2 : 0.6)
                    .animation(.easeOut(duration: 1.4).repeatForever(autoreverses: true).delay(Double(i) * 0.2), value: status)
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
            Label("Job captured", systemImage: "checkmark.seal.fill")
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
                Text("Flynn took the details, texted the caller back, and left it on your Home screen ready to quote or invoice.")
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
    let onStart: () -> Void

    var body: some View {
        WizardScaffold(
            eyebrow: "Go live",
            title: "Start your 7-day free trial",
            subtitle: "Cancel anytime before it ends and you won't be charged."
        ) {
            VStack(spacing: FlynnSpacing.sm) {
                tier("Flynn Receptionist", price: "$69", blurb: "Flynn answers your calls, books the job, invoices and chases payment.", featured: true)
                tier("Flynn Link", price: "$29", blurb: "Missed-call booking link, invoices, quotes and the in-app voice agent.", featured: false)
            }
            .padding(.top, FlynnSpacing.sm)
        } footer: {
            VStack(spacing: FlynnSpacing.xs) {
                FlynnGlassButton(title: "Start free trial", action: onStart, isLoading: model.working)
                Text("7 days free, then your plan. Card required.")
                    .flynnType(FlynnTypography.caption)
                    .foregroundColor(FlynnColor.textTertiary)
            }
        }
        .onAppear { Analytics.capture(.paywallViewed, ["source": "onboarding"]) }
    }

    private func tier(_ name: String, price: String, blurb: String, featured: Bool) -> some View {
        VStack(alignment: .leading, spacing: FlynnSpacing.xs) {
            HStack(alignment: .firstTextBaseline) {
                Text(name).flynnType(FlynnTypography.h3).foregroundColor(FlynnColor.textPrimary)
                Spacer()
                HStack(alignment: .firstTextBaseline, spacing: 2) {
                    Text(price).flynnType(FlynnTypography.h2).foregroundColor(featured ? FlynnColor.primary : FlynnColor.textPrimary)
                    Text("/mo").flynnType(FlynnTypography.caption).foregroundColor(FlynnColor.textTertiary)
                }
            }
            Text(blurb).flynnType(FlynnTypography.bodyMedium).foregroundColor(FlynnColor.textSecondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(FlynnSpacing.lg)
        .frame(maxWidth: .infinity, alignment: .leading)
        .flynnCardSurface(featured ? .raised : .quiet,
                          borderColor: featured ? FlynnColor.primary : FlynnColor.border)
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
                } else if model.poolEmpty {
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
            model.advance(to: .done); return
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
                Text(model.forwardingDialled
                     ? "Flynn's answering your missed calls now. Snap a photo when a job's done and it'll invoice and chase it for you."
                     : "Flynn's ready. Divert your calls any time from Settings, and it starts answering.")
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
}
