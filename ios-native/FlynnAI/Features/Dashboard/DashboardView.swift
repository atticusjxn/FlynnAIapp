import SwiftUI
import UIKit

/// Home: a visual view of what Flynn is doing for you, built from your actual
/// activity over text. Vertical-agnostic — whatever you use Flynn for (replies,
/// invoices, parts orders, bookings, anything new it learns) shows up here. Cards
/// appear only when there's something to show; an empty home steers you to text
/// Flynn and connect the apps it works with.
struct DashboardView: View {
    @State private var store = DashboardStore()
    @State private var conversation = AgentConversationStore()
    @State private var showingAddReply = false
    @State private var showingKeyboardSetup = false
    @State private var showingPractice = false
    @Environment(DeepLinkRouter.self) private var deepLink

    private var hasActivity: Bool {
        !store.awaitingConfirmation.isEmpty || !store.events.isEmpty
            || !store.recentActivity.isEmpty || !store.recentCalls.isEmpty
    }

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                VStack(alignment: .leading, spacing: FlynnSpacing.lg) {
                    greeting

                    switch store.state {
                    case .idle, .loading:
                        loadingCard
                    case .error(let message):
                        errorCard(message: message)
                    case .loaded:
                        // Ordered by what costs the user money if they miss it.
                        // Money first, then decisions Flynn is blocked on, then
                        // the day's work, then the feed. Admin shortcuts sit at
                        // the bottom — they used to sit above all of this.
                        if store.money.hasAnything { moneySection }
                        if !store.awaitingConfirmation.isEmpty { awaitingSection }
                        if !store.recentCalls.isEmpty { callsSection }
                        if !store.events.isEmpty { upcomingSection }
                        if !store.recentActivity.isEmpty { activitySection }
                        if !hasActivity && conversation.turns.isEmpty { emptyStateCard }
                    }

                    // Live turns from the agent bar below — what you just said/typed
                    // and what Flynn did about it, newest at the bottom.
                    if !conversation.turns.isEmpty {
                        agentTurnsSection
                    }

                    if case .loaded = store.state {
                        quickActionsCard
                        if !store.keyboardAdded { keyboardCard }
                    }
                    Color.clear.frame(height: 1).id("bottom")
                }
                .padding(.horizontal, FlynnSpacing.lg)
                .padding(.top, FlynnSpacing.md)
                .padding(.bottom, FlynnSpacing.md)
            }
            // Swiping the feed puts the keyboard away, the gesture people
            // already expect from Messages.
            .scrollDismissesKeyboard(.interactively)
            .onChange(of: conversation.turns.count) { _, _ in
                withAnimation { proxy.scrollTo("bottom", anchor: .bottom) }
            }
        }
        .background(FlynnColor.background)
        // Inline, not large: the greeting below is already the page header, and
        // a large "Home" title on top of "Hey, Atticus." cost most of the first
        // screen before the user saw a single number.
        .navigationTitle("Home")
        .navigationBarTitleDisplayMode(.inline)
        .safeAreaInset(edge: .bottom) {
            AgentInputBar(conversation: conversation)
        }
        .sheet(isPresented: $showingAddReply) {
            AddReplySheet { Task { await store.load() } }
        }
        .sheet(isPresented: $showingKeyboardSetup) {
            KeyboardSetupFlow()
        }
        .sheet(isPresented: $showingPractice) {
            NavigationStack {
                PracticeStepView(onContinue: { showingPractice = false })
                    .toolbar { ToolbarItem(placement: .topBarTrailing) { Button("Done") { showingPractice = false } } }
            }
        }
        .task { await store.load() }
        .refreshable { await store.load() }
    }

    // MARK: – Agent turns (live, from the bottom input bar)

    private var agentTurnsSection: some View {
        VStack(alignment: .leading, spacing: FlynnSpacing.sm) {
            ForEach(conversation.turns) { turn in
                VStack(alignment: .trailing, spacing: FlynnSpacing.xxs) {
                    Text(turn.message)
                        .flynnType(FlynnTypography.bodySmall)
                        .foregroundColor(FlynnColor.white)
                        .padding(.horizontal, FlynnSpacing.sm)
                        .padding(.vertical, FlynnSpacing.xs)
                        .background(RoundedRectangle(cornerRadius: FlynnRadii.md, style: .continuous).fill(FlynnColor.primary))
                        .frame(maxWidth: .infinity, alignment: .trailing)
                }

                if turn.isPending {
                    HStack(spacing: FlynnSpacing.xs) {
                        ProgressView().controlSize(.small)
                        Text("Flynn's on it…")
                            .flynnType(FlynnTypography.caption)
                            .foregroundColor(FlynnColor.textTertiary)
                    }
                } else if let error = turn.errorMessage {
                    Text(error)
                        .flynnType(FlynnTypography.bodySmall)
                        .foregroundColor(FlynnColor.error)
                        .padding(FlynnSpacing.sm)
                        .background(RoundedRectangle(cornerRadius: FlynnRadii.md, style: .continuous).fill(FlynnColor.errorLight))
                } else {
                    // Structured results first — a price comparison reads as a
                    // table, not a paragraph. The prose reply below it stays
                    // short because the tool tells the model it's on screen.
                    ForEach(turn.cards) { card in
                        AgentCardView(card: card) { reply in
                            Task { await conversation.send(reply) }
                        }
                    }
                    ForEach(Array(turn.bubbles.enumerated()), id: \.offset) { _, bubble in
                        Text(bubble)
                            .flynnType(FlynnTypography.bodySmall)
                            .foregroundColor(FlynnColor.textPrimary)
                            .fixedSize(horizontal: false, vertical: true)
                            .padding(FlynnSpacing.sm)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .flynnCardSurface(.flat)
                    }
                }
            }
        }
    }

    // MARK: – Greeting

    private var greeting: some View {
        VStack(alignment: .leading, spacing: FlynnSpacing.xxs) {
            Text(greetingEyebrow)
                .flynnType(FlynnTypography.overline)
                .foregroundColor(FlynnColor.textTertiary)
            Text(store.firstName.map { "Hey, \($0)." } ?? "Flynn")
                .flynnType(FlynnTypography.h1)
                .foregroundColor(FlynnColor.textPrimary)
            // The explainer only earns its space before there's anything to
            // show. Once Home has real content, the content is the explanation.
            if !hasActivity && !store.money.hasAnything {
                Text("Text Flynn whatever you need handled. Here's what it's been up to.")
                    .flynnType(FlynnTypography.bodyMedium)
                    .foregroundColor(FlynnColor.textSecondary)
            }
        }
        .accessibilityElement(children: .combine)
    }

    private var greetingEyebrow: String {
        let h = Calendar.current.component(.hour, from: Date())
        switch h {
        case 5..<12: return "Good morning"
        case 12..<17: return "Good afternoon"
        default: return "Good evening"
        }
    }

    // MARK: – Money (owed, overdue, just landed)

    /// The first thing on Home, because it's the thing that costs the operator
    /// real money to not notice. Reads as one sentence, not a dashboard of KPIs:
    /// what you're owed, how much of it is late, what just came in.
    private var moneySection: some View {
        let m = store.money
        return Button {
            deepLink.pending = .init(tab: .money, route: nil)
        } label: {
            VStack(alignment: .leading, spacing: FlynnSpacing.sm) {
                if m.owedCount > 0 {
                    VStack(alignment: .leading, spacing: FlynnSpacing.xxs) {
                        Text(FlynnFormatter.currency(m.owedTotal))
                            .flynnType(FlynnTypography.h1)
                            .foregroundColor(FlynnColor.textPrimary)
                        Text(m.owedCount == 1 ? "owed on 1 invoice" : "owed across \(m.owedCount) invoices")
                            .flynnType(FlynnTypography.bodyMedium)
                            .foregroundColor(FlynnColor.textSecondary)
                    }

                    if m.overdueCount > 0 {
                        HStack(spacing: FlynnSpacing.xs) {
                            Image(systemName: "exclamationmark.circle.fill")
                                .foregroundColor(FlynnColor.error)
                            Text("\(FlynnFormatter.currency(m.overdueTotal)) is overdue")
                                .flynnType(FlynnTypography.label)
                                .foregroundColor(FlynnColor.error)
                        }
                        .padding(.horizontal, FlynnSpacing.sm)
                        .padding(.vertical, FlynnSpacing.xs)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(
                            RoundedRectangle(cornerRadius: FlynnRadii.sm, style: .continuous)
                                .fill(FlynnColor.errorLight)
                        )
                    }
                }

                if m.paidRecentCount > 0 {
                    HStack(spacing: FlynnSpacing.xs) {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundColor(FlynnColor.success)
                        Text("\(FlynnFormatter.currency(m.paidRecentTotal)) came in this week")
                            .flynnType(FlynnTypography.label)
                            .foregroundColor(FlynnColor.textSecondary)
                        Spacer(minLength: 0)
                    }
                }
            }
            .padding(FlynnSpacing.md)
            .frame(maxWidth: .infinity, alignment: .leading)
            .flynnCardSurface()
        }
        .buttonStyle(.plain)
        // VoiceOver reads this as one sentence and one action, rather than
        // five disconnected fragments.
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(moneyAccessibilityLabel)
        .accessibilityHint("Opens Money")
        .accessibilityAddTraits(.isButton)
    }

    private var moneyAccessibilityLabel: String {
        let m = store.money
        var parts: [String] = []
        if m.owedCount > 0 {
            parts.append("\(FlynnFormatter.currency(m.owedTotal)) owed across \(m.owedCount) invoice\(m.owedCount == 1 ? "" : "s")")
        }
        if m.overdueCount > 0 {
            parts.append("\(FlynnFormatter.currency(m.overdueTotal)) overdue")
        }
        if m.paidRecentCount > 0 {
            parts.append("\(FlynnFormatter.currency(m.paidRecentTotal)) came in this week")
        }
        return parts.joined(separator: ". ")
    }

    // MARK: – Calls the receptionist took

    /// The AI receptionist is the wedge — it answers the calls the operator
    /// can't take. The calls table was fully populated and surfaced nowhere, so
    /// the one thing the product visibly does was invisible inside it.
    ///
    /// Each call carries its own next step. The actions route through the agent
    /// rather than opening a form, because the agent already has the invoice,
    /// quote and message tools — one tap gets a draft back to confirm.
    private var callsSection: some View {
        VStack(alignment: .leading, spacing: FlynnSpacing.sm) {
            HStack {
                Image(systemName: "phone.badge.waveform.fill")
                    .foregroundColor(FlynnColor.primary)
                Text("Flynn answered")
                    .flynnType(FlynnTypography.h4)
                    .foregroundColor(FlynnColor.textPrimary)
                Spacer()
                Button("See all") { deepLink.pending = .init(tab: .calls, route: nil) }
                    .flynnType(FlynnTypography.caption)
                    .foregroundColor(FlynnColor.primary)
            }

            ForEach(store.recentCalls.prefix(3)) { call in
                VStack(alignment: .leading, spacing: FlynnSpacing.xs) {
                    NavigationLink(value: Route.callDetail(id: call.id)) {
                        VStack(alignment: .leading, spacing: FlynnSpacing.xxs) {
                            HStack {
                                Text(FlynnFormatter.phone(call.fromNumber).isEmpty
                                     ? "Unknown caller"
                                     : FlynnFormatter.phone(call.fromNumber))
                                    .flynnType(FlynnTypography.h4)
                                    .foregroundColor(FlynnColor.textPrimary)
                                Spacer()
                                Text(FlynnFormatter.relativeDate(call.createdAt))
                                    .flynnType(FlynnTypography.caption)
                                    .foregroundColor(FlynnColor.textTertiary)
                            }

                            // The gist, not the transcript. If Flynn didn't get
                            // words, say that rather than showing an empty row.
                            Text(call.hasTranscript
                                 ? (call.transcriptionText ?? "")
                                 : "No transcript — tap to hear the recording")
                                .flynnType(FlynnTypography.bodySmall)
                                .foregroundColor(call.hasTranscript ? FlynnColor.textSecondary : FlynnColor.textTertiary)
                                .lineLimit(3)
                                .fixedSize(horizontal: false, vertical: true)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }
                        .accessibilityElement(children: .combine)
                    }
                    .buttonStyle(.plain)

                    // One tap per next step. Flynn drafts, the user confirms.
                    HStack(spacing: FlynnSpacing.xs) {
                        callAction("Text back", icon: "arrowshape.turn.up.left.fill") {
                            askFlynn("Draft a follow-up text to \(call.fromNumber ?? "the caller") about their call. Keep it short.")
                        }
                        callAction("Quote", icon: "doc.text") {
                            askFlynn("Draft a quote for \(call.fromNumber ?? "the caller") based on what they asked for on the call.")
                        }
                        callAction("Invoice", icon: "dollarsign.circle") {
                            askFlynn("Draft an invoice for \(call.fromNumber ?? "the caller") for the job from their call.")
                        }
                    }
                }
                .padding(FlynnSpacing.sm)
                .frame(maxWidth: .infinity, alignment: .leading)
                .flynnCardSurface()
            }
        }
    }

    private func callAction(_ title: String, icon: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Label(title, systemImage: icon)
                .flynnType(FlynnTypography.caption)
                .foregroundColor(FlynnColor.primary)
                .lineLimit(1)
                .frame(maxWidth: .infinity, minHeight: 40)
                .background(
                    RoundedRectangle(cornerRadius: FlynnRadii.sm, style: .continuous)
                        .fill(FlynnColor.background)
                )
                .brutalistBorder(cornerRadius: FlynnRadii.sm, lineWidth: FlynnStroke.hairline)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(title)
    }

    /// Hands the request to the agent bar's conversation so the reply lands in
    /// the same feed as everything else the user asks for.
    private func askFlynn(_ prompt: String) {
        Task { await conversation.send(prompt) }
    }

    // MARK: – Waiting on your OK (staged pending actions, any type)

    private var awaitingSection: some View {
        VStack(alignment: .leading, spacing: FlynnSpacing.sm) {
            HStack(spacing: FlynnSpacing.xs) {
                Image(systemName: "clock.badge.checkmark").foregroundColor(FlynnColor.warning)
                Text("Waiting on your OK")
                    .flynnType(FlynnTypography.h4)
                    .foregroundColor(FlynnColor.textPrimary)
            }
            ForEach(store.awaitingConfirmation) { item in
                HStack(alignment: .top, spacing: FlynnSpacing.sm) {
                    Image(systemName: iconForAction(item.actionType))
                        .foregroundColor(FlynnColor.primary)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(item.message ?? prettyAction(item.actionType))
                            .flynnType(FlynnTypography.bodySmall)
                            .foregroundColor(FlynnColor.textPrimary)
                            .fixedSize(horizontal: false, vertical: true)
                        Text("Reply to Flynn to confirm or cancel")
                            .flynnType(FlynnTypography.caption)
                            .foregroundColor(FlynnColor.textTertiary)
                    }
                    Spacer(minLength: 0)
                }
                .padding(FlynnSpacing.sm)
                .frame(maxWidth: .infinity, alignment: .leading)
                .flynnCardSurface(.flat, borderColor: FlynnColor.warning)
                .accessibilityElement(children: .combine)
            }
        }
        .accessibilityLabel("Waiting on your OK, \(store.awaitingConfirmation.count) item\(store.awaitingConfirmation.count == 1 ? "" : "s")")
    }

    // MARK: – Upcoming bookings

    private var upcomingSection: some View {
        VStack(alignment: .leading, spacing: FlynnSpacing.sm) {
            HStack {
                Text("Upcoming bookings")
                    .flynnType(FlynnTypography.h4)
                    .foregroundColor(FlynnColor.textPrimary)
                Spacer()
                Button("See all") { deepLink.pending = .init(tab: .events, route: nil) }
                    .flynnType(FlynnTypography.caption)
                    .foregroundColor(FlynnColor.primary)
            }
            VStack(spacing: FlynnSpacing.sm) {
                ForEach(store.events.prefix(5)) { event in
                    NavigationLink(value: Route.eventDetail(id: event.id)) {
                        EventRow(event: event)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    // MARK: – Recent activity from Flynn

    private var activitySection: some View {
        VStack(alignment: .leading, spacing: FlynnSpacing.sm) {
            Text("Recent activity")
                .flynnType(FlynnTypography.h4)
                .foregroundColor(FlynnColor.textPrimary)
            ForEach(store.recentActivity.prefix(6)) { reply in
                HStack(alignment: .top, spacing: FlynnSpacing.sm) {
                    Image(systemName: "bubble.left.and.text.bubble.right")
                        .foregroundColor(FlynnColor.success)
                    Text(reply.body)
                        .flynnType(FlynnTypography.bodySmall)
                        .foregroundColor(FlynnColor.textPrimary)
                        .lineLimit(3)
                        .fixedSize(horizontal: false, vertical: true)
                    Spacer(minLength: 0)
                }
                .padding(FlynnSpacing.sm)
                .frame(maxWidth: .infinity, alignment: .leading)
                .flynnCardSurface()
                .accessibilityElement(children: .combine)
            }
        }
    }

    // MARK: – Empty state (new user — steer to text + connect)

    private var emptyStateCard: some View {
        VStack(alignment: .leading, spacing: FlynnSpacing.sm) {
            HStack(spacing: FlynnSpacing.sm) {
                Mascot(.wave, size: 44)
                Text("Nothing here yet")
                    .flynnType(FlynnTypography.h4)
                    .foregroundColor(FlynnColor.textPrimary)
            }
            Text("Text Flynn what you need — replying to customers, invoices, ordering parts, booking jobs. Connect your apps and it does more.")
                .flynnType(FlynnTypography.bodySmall)
                .foregroundColor(FlynnColor.textSecondary)
                .fixedSize(horizontal: false, vertical: true)
            FlynnButton(title: "Connect your apps", action: {
                deepLink.pending = .init(tab: .connected, route: nil)
            }, variant: .secondary, size: .small)
        }
        .padding(FlynnSpacing.md)
        .flynnCardSurface()
    }

    // MARK: – Quick actions (the editable backup of what Flynn knows)

    private var quickActionsCard: some View {
        VStack(alignment: .leading, spacing: FlynnSpacing.sm) {
            Text("Manage Flynn")
                .flynnType(FlynnTypography.h4)
                .foregroundColor(FlynnColor.textPrimary)
            HStack(spacing: FlynnSpacing.sm) {
                quickAction(title: "What Flynn knows", icon: "brain.head.profile") {
                    deepLink.pending = .init(tab: .brain, route: nil)
                }
                quickAction(title: "Connected apps", icon: "square.stack.3d.up") {
                    deepLink.pending = .init(tab: .connected, route: nil)
                }
            }
            HStack(spacing: FlynnSpacing.sm) {
                quickAction(title: "Add a reply in your voice", icon: "text.bubble") {
                    showingAddReply = true
                }
                quickAction(title: "Flynn keyboard", icon: "keyboard") {
                    showingKeyboardSetup = true
                }
            }
        }
        .padding(FlynnSpacing.md)
        .flynnCardSurface()
    }

    private func quickAction(title: String, icon: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Label(title, systemImage: icon)
                .flynnType(FlynnTypography.caption)
                .foregroundColor(FlynnColor.primary)
                .frame(maxWidth: .infinity, minHeight: 44)
                .multilineTextAlignment(.leading)
                .background(RoundedRectangle(cornerRadius: FlynnRadii.md, style: .continuous).fill(FlynnColor.background))
                .brutalistBorder(cornerRadius: FlynnRadii.md)
        }
        .buttonStyle(.plain)
    }

    // MARK: – Keyboard add-on (only while not set up)

    private var keyboardCard: some View {
        VStack(alignment: .leading, spacing: FlynnSpacing.sm) {
            HStack(spacing: FlynnSpacing.sm) {
                Image(systemName: "keyboard").foregroundColor(FlynnColor.primary)
                Text("Add the Flynn keyboard")
                    .flynnType(FlynnTypography.h4)
                    .foregroundColor(FlynnColor.textPrimary)
            }
            Text("Optional: draft replies in your voice right inside Messages, without leaving the app you're in.")
                .flynnType(FlynnTypography.caption)
                .foregroundColor(FlynnColor.textSecondary)
                .fixedSize(horizontal: false, vertical: true)
            HStack(spacing: FlynnSpacing.sm) {
                FlynnButton(title: "Set up keyboard", action: { showingKeyboardSetup = true }, variant: .secondary, size: .small)
                FlynnButton(title: "Practice", action: { showingPractice = true }, variant: .secondary, size: .small)
            }
        }
        .padding(FlynnSpacing.md)
        .flynnCardSurface()
    }

    // MARK: – Helpers

    private func iconForAction(_ type: String?) -> String {
        switch (type ?? "").uppercased() {
        case "INVOICE": return "doc.text"
        case "ORDER_PARTS": return "shippingbox"
        case "BOOK_JOB": return "calendar.badge.plus"
        case "DRAFT_REPLY": return "text.bubble"
        default: return "checkmark.circle"
        }
    }

    private func prettyAction(_ type: String?) -> String {
        switch (type ?? "").uppercased() {
        case "INVOICE": return "Send an invoice"
        case "ORDER_PARTS": return "Order parts"
        case "BOOK_JOB": return "Book a job"
        case "DRAFT_REPLY": return "Send a reply"
        default: return "Confirm an action"
        }
    }

    // MARK: – Loading / error

    private var loadingCard: some View {
        FlynnCard {
            HStack(spacing: FlynnSpacing.sm) {
                ProgressView()
                Text("Loading…")
                    .flynnType(FlynnTypography.bodyMedium)
                    .foregroundColor(FlynnColor.textSecondary)
            }
        }
    }

    private func errorCard(message: String) -> some View {
        FlynnCard {
            VStack(alignment: .leading, spacing: FlynnSpacing.xs) {
                Text("Couldn't load home")
                    .flynnType(FlynnTypography.h4)
                    .foregroundColor(FlynnColor.error)
                Text(message)
                    .flynnType(FlynnTypography.bodySmall)
                    .foregroundColor(FlynnColor.textSecondary)
                FlynnButton(title: "Retry", action: { Task { await store.load() } }, variant: .secondary, size: .small)
                    .padding(.top, FlynnSpacing.xs)
            }
        }
    }
}
