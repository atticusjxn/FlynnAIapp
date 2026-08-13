import SwiftUI
import UIKit

/// Home: a calm, glanceable view of what Flynn is doing for you.
///
/// Composition rule after the design pass: **one hero, everything else quiet.**
/// The money you're owed is the single emphasised surface; calls, bookings and
/// activity sit on quiet hairline cards so the eye lands on money first and the
/// page reads as considered rather than as a stack of equally-loud boxes.
struct DashboardView: View {
    @State private var store = DashboardStore()
    @State private var conversation = AgentConversationStore()
    @State private var showingAddReply = false
    @State private var activityDetail: DashboardStore.ActivityReply?
    @Environment(DeepLinkRouter.self) private var deepLink

    private var hasActivity: Bool {
        !store.awaitingConfirmation.isEmpty || !store.events.isEmpty
            || !store.recentActivity.isEmpty || !store.recentCalls.isEmpty
    }

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                VStack(alignment: .leading, spacing: FlynnSpacing.xl) {
                    greeting

                    switch store.state {
                    case .idle, .loading:
                        loadingCard
                    case .error(let message):
                        errorCard(message: message)
                    case .loaded:
                        // Money first — the thing that costs real money to miss.
                        // Then decisions Flynn is blocked on, the day's work, the
                        // feed, and admin shortcuts last. Forwarding sits above all
                        // of it: a receptionist nobody's calls reach makes the rest
                        // of Home meaningless, so it's the one banner that appears
                        // even on a quiet day.
                        if store.receptionistStatus != .ok { forwardingBanner }
                        if store.money.hasAnything { moneySection }
                        if !store.awaitingConfirmation.isEmpty { awaitingSection }
                        if !store.recentCalls.isEmpty { callsSection }
                        if !store.events.isEmpty { upcomingSection }
                        if !store.recentActivity.isEmpty { activitySection }
                        if !hasActivity && conversation.turns.isEmpty { emptyStateCard }
                    }

                    if !conversation.turns.isEmpty { agentTurnsSection }

                    if case .loaded = store.state {
                        quickActionsCard
                    }
                    Color.clear.frame(height: 1).id("bottom")
                }
                .padding(.horizontal, FlynnSpacing.lg)
                .padding(.top, FlynnSpacing.xs)
                .padding(.bottom, FlynnSpacing.md)
            }
            .scrollDismissesKeyboard(.interactively)
            .onChange(of: conversation.turns.count) { _, _ in
                withAnimation(.spring(response: 0.4, dampingFraction: 0.8)) {
                    proxy.scrollTo("bottom", anchor: .bottom)
                }
            }
        }
        .background(FlynnColor.background)
        .navigationTitle("Home")
        .navigationBarTitleDisplayMode(.inline)
        .safeAreaInset(edge: .bottom) {
            AgentInputBar(conversation: conversation)
        }
        .sheet(isPresented: $showingAddReply) {
            AddReplySheet { Task { await store.load() } }.flynnFlashOverlay()
        }
        .sheet(item: $activityDetail) { reply in ActivityDetailSheet(reply: reply) }
        .task { await store.load() }
        .refreshable { await store.load() }
    }

    // MARK: – Greeting

    private var greeting: some View {
        VStack(alignment: .leading, spacing: FlynnSpacing.xxs) {
            Text(greetingEyebrow)
                .flynnType(FlynnTypography.overline)
                .foregroundColor(FlynnColor.textTertiary)
            Text(store.firstName.map { "Hey, \($0)." } ?? "Flynn")
                .flynnType(FlynnTypography.displayMedium)
                .foregroundColor(FlynnColor.textPrimary)
            if !hasActivity && !store.money.hasAnything {
                Text("Talk or type to Flynn below. Here's what it's been handling for you.")
                    .flynnType(FlynnTypography.bodyMedium)
                    .foregroundColor(FlynnColor.textSecondary)
                    .padding(.top, FlynnSpacing.xxs)
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

    // MARK: – Section header

    private func sectionHeader(
        _ icon: String, _ title: String,
        tint: Color = FlynnColor.textTertiary,
        action: (() -> Void)? = nil
    ) -> some View {
        HStack(spacing: FlynnSpacing.xs) {
            Image(systemName: icon)
                .font(.system(size: 13, weight: .semibold))
                .foregroundColor(tint)
            Text(title)
                .flynnType(FlynnTypography.overline)
                .foregroundColor(tint)
            Spacer(minLength: 0)
            if let action {
                Button(action: action) {
                    HStack(spacing: 2) {
                        Text("See all").flynnType(FlynnTypography.caption)
                        Image(systemName: "chevron.right").font(.system(size: 10, weight: .bold))
                    }
                    .foregroundColor(FlynnColor.primary)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.bottom, FlynnSpacing.xs)
    }

    // MARK: – Forwarding nudge (only shown when it needs attention)

    private var forwardingBanner: some View {
        Button {
            deepLink.pending = .init(tab: .dashboard, route: .settingsSection(.callForwarding))
        } label: {
            HStack(alignment: .top, spacing: FlynnSpacing.sm) {
                Image(systemName: "phone.badge.waveform")
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundColor(FlynnColor.primary)
                    .padding(.top, 2)
                VStack(alignment: .leading, spacing: 2) {
                    Text(forwardingBannerTitle)
                        .flynnType(FlynnTypography.h4)
                        .foregroundColor(FlynnColor.textPrimary)
                    Text(forwardingBannerSubtitle)
                        .flynnType(FlynnTypography.bodyMedium)
                        .foregroundColor(FlynnColor.textSecondary)
                }
                Spacer(minLength: 0)
                Image(systemName: "chevron.right")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(FlynnColor.textTertiary)
                    .padding(.top, 4)
            }
            .padding(FlynnSpacing.md)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: FlynnRadii.lg, style: .continuous)
                    .fill(FlynnColor.primaryLight.opacity(0.5))
            )
        }
        .buttonStyle(FlynnPressable())
        .accessibilityElement(children: .combine)
    }

    private var forwardingBannerTitle: String {
        store.receptionistStatus == .noNumber ? "Your receptionist doesn't have a number yet" : "Calls aren't confirmed forwarding yet"
    }

    private var forwardingBannerSubtitle: String {
        store.receptionistStatus == .noNumber
            ? "Numbers were briefly out when you signed up — grab yours to go live."
            : "Set up call diversion so missed calls actually reach your receptionist."
    }

    // MARK: – Money hero (the one emphasised surface)

    private var moneySection: some View {
        let m = store.money
        return Button {
            deepLink.pending = .init(tab: .money, route: nil)
        } label: {
            VStack(alignment: .leading, spacing: FlynnSpacing.md) {
                if m.owedCount > 0 {
                    VStack(alignment: .leading, spacing: FlynnSpacing.xxs) {
                        Text("You're owed")
                            .flynnType(FlynnTypography.overline)
                            .foregroundColor(FlynnColor.textTertiary)
                        Text(FlynnFormatter.currency(m.owedTotal))
                            .flynnType(FlynnTypography.displayLarge)
                            .foregroundColor(FlynnColor.textPrimary)
                            .minimumScaleFactor(0.6)
                            .lineLimit(1)
                        Text(m.owedCount == 1 ? "across 1 invoice" : "across \(m.owedCount) invoices")
                            .flynnType(FlynnTypography.bodyMedium)
                            .foregroundColor(FlynnColor.textSecondary)
                    }
                }

                if m.overdueCount > 0 || m.paidRecentCount > 0 {
                    VStack(spacing: FlynnSpacing.xs) {
                        if m.overdueCount > 0 {
                            moneyChip("exclamationmark.circle.fill",
                                      "\(FlynnFormatter.currency(m.overdueTotal)) overdue",
                                      tint: FlynnColor.error, fill: FlynnColor.errorLight)
                        }
                        if m.paidRecentCount > 0 {
                            moneyChip("checkmark.circle.fill",
                                      "\(FlynnFormatter.currency(m.paidRecentTotal)) came in this week",
                                      tint: FlynnColor.success, fill: FlynnColor.successLight)
                        }
                    }
                }
            }
            .padding(FlynnSpacing.lg)
            .frame(maxWidth: .infinity, alignment: .leading)
            .flynnCardSurface(.raised)
        }
        .buttonStyle(FlynnPressable())
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(moneyAccessibilityLabel)
        .accessibilityHint("Opens Money")
        .accessibilityAddTraits(.isButton)
    }

    private func moneyChip(_ icon: String, _ text: String, tint: Color, fill: Color) -> some View {
        HStack(spacing: FlynnSpacing.xs) {
            Image(systemName: icon).foregroundColor(tint)
            Text(text)
                .flynnType(FlynnTypography.label)
                .foregroundColor(tint)
            Spacer(minLength: 0)
        }
        .padding(.horizontal, FlynnSpacing.sm)
        .padding(.vertical, FlynnSpacing.xs)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: FlynnRadii.md, style: .continuous).fill(fill))
    }

    private var moneyAccessibilityLabel: String {
        let m = store.money
        var parts: [String] = []
        if m.owedCount > 0 { parts.append("\(FlynnFormatter.currency(m.owedTotal)) owed across \(m.owedCount) invoice\(m.owedCount == 1 ? "" : "s")") }
        if m.overdueCount > 0 { parts.append("\(FlynnFormatter.currency(m.overdueTotal)) overdue") }
        if m.paidRecentCount > 0 { parts.append("\(FlynnFormatter.currency(m.paidRecentTotal)) came in this week") }
        return parts.joined(separator: ". ")
    }

    // MARK: – Calls the receptionist took

    private var callsSection: some View {
        VStack(alignment: .leading, spacing: FlynnSpacing.sm) {
            sectionHeader("phone.badge.waveform.fill", "Flynn answered", tint: FlynnColor.primary) {
                deepLink.pending = .init(tab: .calls, route: nil)
            }
            ForEach(store.recentCalls.prefix(3)) { call in
                callCard(call)
            }
        }
    }

    private func callCard(_ call: CallDTO) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            NavigationLink(value: Route.callDetail(id: call.id)) {
                VStack(alignment: .leading, spacing: FlynnSpacing.xxs) {
                    HStack {
                        Text(FlynnFormatter.phone(call.fromNumber).isEmpty ? "Unknown caller" : FlynnFormatter.phone(call.fromNumber))
                            .flynnType(FlynnTypography.h4)
                            .foregroundColor(FlynnColor.textPrimary)
                        Spacer()
                        Text(FlynnFormatter.relativeDate(call.createdAt))
                            .flynnType(FlynnTypography.caption)
                            .foregroundColor(FlynnColor.textTertiary)
                    }
                    Text(call.hasTranscript ? (call.transcriptionText ?? "") : "No transcript — tap to hear the recording")
                        .flynnType(FlynnTypography.bodySmall)
                        .foregroundColor(call.hasTranscript ? FlynnColor.textSecondary : FlynnColor.textTertiary)
                        .lineLimit(3)
                        .fixedSize(horizontal: false, vertical: true)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                .accessibilityElement(children: .combine)
            }
            .buttonStyle(FlynnPressable())

            Divider().overlay(FlynnColor.borderSubtle).padding(.vertical, FlynnSpacing.sm)

            // Lighter than three bordered pills — borderless actions with an
            // orange glyph, separated by the divider above.
            HStack(spacing: 0) {
                callAction("Text back", icon: "arrowshape.turn.up.left.fill") {
                    askFlynn("Draft a follow-up text to \(call.fromNumber ?? "the caller") about their call. Keep it short.")
                }
                Divider().frame(height: 20).overlay(FlynnColor.borderSubtle)
                callAction("Quote", icon: "doc.text.fill") {
                    askFlynn("Draft a quote for \(call.fromNumber ?? "the caller") based on what they asked for on the call.")
                }
                Divider().frame(height: 20).overlay(FlynnColor.borderSubtle)
                callAction("Invoice", icon: "dollarsign.circle.fill") {
                    askFlynn("Draft an invoice for \(call.fromNumber ?? "the caller") for the job from their call.")
                }
            }
        }
        .padding(FlynnSpacing.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .flynnCardSurface(.quiet)
    }

    private func callAction(_ title: String, icon: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(spacing: 3) {
                Image(systemName: icon).font(.system(size: 15, weight: .semibold))
                Text(title).flynnType(FlynnTypography.caption).lineLimit(1).minimumScaleFactor(0.8)
            }
            .foregroundColor(FlynnColor.primary)
            .frame(maxWidth: .infinity, minHeight: 40)
        }
        .buttonStyle(FlynnPressable())
        .accessibilityLabel(title)
    }

    private func askFlynn(_ prompt: String) { Task { await conversation.send(prompt) } }

    // MARK: – Waiting on your OK

    private var awaitingSection: some View {
        VStack(alignment: .leading, spacing: FlynnSpacing.sm) {
            sectionHeader("clock.badge.checkmark", "Waiting on your OK", tint: FlynnColor.warning)
            ForEach(store.awaitingConfirmation) { item in
                awaitingCard(item)
            }
        }
    }

    private func awaitingCard(_ item: DashboardStore.PendingActionItem) -> some View {
        VStack(alignment: .leading, spacing: FlynnSpacing.sm) {
            HStack(alignment: .top, spacing: FlynnSpacing.sm) {
                Image(systemName: iconForAction(item.actionType))
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundColor(FlynnColor.warning)
                    .frame(width: 22)
                Text(item.message ?? prettyAction(item.actionType))
                    .flynnType(FlynnTypography.bodyMedium)
                    .foregroundColor(FlynnColor.textPrimary)
                    .fixedSize(horizontal: false, vertical: true)
                Spacer(minLength: 0)
            }
            // Real Confirm / Cancel instead of "reply to Flynn" — these send the
            // decision straight to the agent, which is exactly the confirmation
            // path, just in-app instead of over SMS.
            HStack(spacing: FlynnSpacing.sm) {
                Button {
                    askFlynn("Yes, go ahead with: \(item.message ?? prettyAction(item.actionType)).")
                } label: {
                    Label("Confirm", systemImage: "checkmark")
                        .flynnType(FlynnTypography.label)
                        .foregroundColor(FlynnColor.textInverse)
                        .frame(maxWidth: .infinity, minHeight: 42)
                        .background(Capsule(style: .continuous).fill(FlynnColor.success))
                }
                .buttonStyle(FlynnPressable())

                Button {
                    askFlynn("No, cancel that: \(item.message ?? prettyAction(item.actionType)).")
                } label: {
                    Text("Cancel")
                        .flynnType(FlynnTypography.label)
                        .foregroundColor(FlynnColor.textSecondary)
                        .frame(maxWidth: .infinity, minHeight: 42)
                        .background(Capsule(style: .continuous).strokeBorder(FlynnColor.borderSubtle, lineWidth: 1))
                }
                .buttonStyle(FlynnPressable())
            }
        }
        .padding(FlynnSpacing.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .flynnCardSurface(.quiet, borderColor: FlynnColor.warning.opacity(0.5))
        .accessibilityElement(children: .combine)
    }

    // MARK: – Upcoming bookings

    private var upcomingSection: some View {
        VStack(alignment: .leading, spacing: FlynnSpacing.sm) {
            sectionHeader("calendar", "Upcoming bookings") {
                deepLink.pending = .init(tab: .events, route: nil)
            }
            VStack(spacing: FlynnSpacing.sm) {
                ForEach(store.events.prefix(5)) { event in
                    NavigationLink(value: Route.eventDetail(id: event.id)) { EventRow(event: event) }
                        .buttonStyle(FlynnPressable())
                }
            }
        }
    }

    // MARK: – Recent activity (now tappable)

    private var activitySection: some View {
        VStack(alignment: .leading, spacing: FlynnSpacing.sm) {
            sectionHeader("sparkles", "Recent activity")
            ForEach(store.recentActivity.prefix(6)) { reply in
                Button { activityDetail = reply } label: {
                    HStack(alignment: .top, spacing: FlynnSpacing.sm) {
                        Image(systemName: "bubble.left.and.text.bubble.right.fill")
                            .font(.system(size: 14))
                            .foregroundColor(FlynnColor.success)
                            .frame(width: 22)
                        Text(reply.body)
                            .flynnType(FlynnTypography.bodySmall)
                            .foregroundColor(FlynnColor.textPrimary)
                            .lineLimit(2)
                            .fixedSize(horizontal: false, vertical: true)
                            .frame(maxWidth: .infinity, alignment: .leading)
                        Image(systemName: "chevron.right")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundColor(FlynnColor.textTertiary)
                    }
                    .padding(FlynnSpacing.md)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .flynnCardSurface(.quiet)
                }
                .buttonStyle(FlynnPressable())
                .accessibilityHint("Opens the full message")
            }
        }
    }

    // MARK: – Agent turns (live, from the input bar)

    private var agentTurnsSection: some View {
        VStack(alignment: .leading, spacing: FlynnSpacing.md) {
            ForEach(conversation.turns) { turn in
                VStack(alignment: .trailing, spacing: FlynnSpacing.xs) {
                    Text(turn.message)
                        .flynnType(FlynnTypography.bodyMedium)
                        .foregroundColor(FlynnColor.textInverse)
                        .padding(.horizontal, FlynnSpacing.md)
                        .padding(.vertical, FlynnSpacing.sm)
                        .background(Capsule(style: .continuous).fill(FlynnColor.primary))
                        .frame(maxWidth: .infinity, alignment: .trailing)

                    turnResult(turn)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
        }
    }

    @ViewBuilder
    private func turnResult(_ turn: AgentConversationStore.Turn) -> some View {
        if turn.isPending {
            HStack(spacing: FlynnSpacing.xs) {
                ProgressView().controlSize(.small)
                Text("Flynn's on it…").flynnType(FlynnTypography.caption).foregroundColor(FlynnColor.textTertiary)
            }
        } else if let error = turn.errorMessage {
            Text(error)
                .flynnType(FlynnTypography.bodySmall)
                .foregroundColor(FlynnColor.error)
                .padding(FlynnSpacing.sm)
                .background(RoundedRectangle(cornerRadius: FlynnRadii.md, style: .continuous).fill(FlynnColor.errorLight))
        } else {
            VStack(alignment: .leading, spacing: FlynnSpacing.sm) {
                ForEach(turn.cards) { card in
                    AgentCardView(card: card) { reply in Task { await conversation.send(reply) } }
                }
                ForEach(Array(turn.bubbles.enumerated()), id: \.offset) { _, bubble in
                    Text(bubble)
                        .flynnType(FlynnTypography.bodyMedium)
                        .foregroundColor(FlynnColor.textPrimary)
                        .fixedSize(horizontal: false, vertical: true)
                        .padding(FlynnSpacing.md)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .flynnCardSurface(.quiet)
                }
            }
        }
    }

    // MARK: – Empty state

    private var emptyStateCard: some View {
        VStack(alignment: .leading, spacing: FlynnSpacing.md) {
            HStack(spacing: FlynnSpacing.sm) {
                Mascot(.wave, size: 44)
                Text("Nothing here yet")
                    .flynnType(FlynnTypography.h3)
                    .foregroundColor(FlynnColor.textPrimary)
            }
            Text("Talk or type to Flynn below — replying to customers, invoices, ordering parts, booking jobs. Connect your apps and it does more.")
                .flynnType(FlynnTypography.bodyMedium)
                .foregroundColor(FlynnColor.textSecondary)
                .fixedSize(horizontal: false, vertical: true)
            FlynnButton(title: "Connect your apps", action: {
                deepLink.pending = .init(tab: .connected, route: .settingsSection(.integrations))
            }, variant: .secondary, size: .small)
        }
        .padding(FlynnSpacing.lg)
        .flynnCardSurface(.flat)
    }

    // MARK: – Manage Flynn

    private var quickActionsCard: some View {
        VStack(alignment: .leading, spacing: FlynnSpacing.sm) {
            sectionHeader("slider.horizontal.3", "Manage Flynn")
            LazyVGrid(columns: [GridItem(.flexible(), spacing: FlynnSpacing.sm), GridItem(.flexible(), spacing: FlynnSpacing.sm)], spacing: FlynnSpacing.sm) {
                quickAction("What Flynn knows", icon: "sparkles") { deepLink.pending = .init(tab: .brain, route: nil) }
                quickAction("Connected apps", icon: "square.stack.3d.up.fill") { deepLink.pending = .init(tab: .connected, route: .settingsSection(.integrations)) }
                quickAction("Add a reply", icon: "text.bubble.fill") { showingAddReply = true }
            }
        }
    }

    private func quickAction(_ title: String, icon: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: FlynnSpacing.sm) {
                Image(systemName: icon)
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundColor(FlynnColor.primary)
                    .frame(width: 22)
                Text(title)
                    .flynnType(FlynnTypography.bodySmall)
                    .foregroundColor(FlynnColor.textPrimary)
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)
                Spacer(minLength: 0)
            }
            .padding(FlynnSpacing.md)
            .frame(maxWidth: .infinity, minHeight: 60, alignment: .leading)
            .flynnCardSurface(.quiet)
        }
        .buttonStyle(FlynnPressable())
    }


    // MARK: – Helpers

    private func iconForAction(_ type: String?) -> String {
        switch (type ?? "").uppercased() {
        case "INVOICE": return "doc.text.fill"
        case "ORDER_PARTS": return "shippingbox.fill"
        case "BOOK_JOB": return "calendar.badge.plus"
        case "DRAFT_REPLY": return "text.bubble.fill"
        default: return "checkmark.circle.fill"
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

    private var loadingCard: some View {
        HStack(spacing: FlynnSpacing.sm) {
            ProgressView()
            Text("Loading…").flynnType(FlynnTypography.bodyMedium).foregroundColor(FlynnColor.textSecondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(FlynnSpacing.lg)
        .flynnCardSurface(.quiet)
    }

    private func errorCard(message: String) -> some View {
        VStack(alignment: .leading, spacing: FlynnSpacing.xs) {
            Text("Couldn't load home").flynnType(FlynnTypography.h4).foregroundColor(FlynnColor.error)
            Text(message).flynnType(FlynnTypography.bodySmall).foregroundColor(FlynnColor.textSecondary)
            FlynnButton(title: "Retry", action: { Task { await store.load() } }, variant: .secondary, size: .small)
                .padding(.top, FlynnSpacing.xs)
        }
        .padding(FlynnSpacing.lg)
        .frame(maxWidth: .infinity, alignment: .leading)
        .flynnCardSurface(.flat)
    }
}

/// A full read of a single activity item — the interaction that was missing;
/// the rows on Home used to be dead text.
private struct ActivityDetailSheet: View {
    let reply: DashboardStore.ActivityReply
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: FlynnSpacing.md) {
                    if let channel = reply.channel {
                        Text(channel.uppercased())
                            .flynnType(FlynnTypography.overline)
                            .foregroundColor(FlynnColor.textTertiary)
                    }
                    Text(reply.body)
                        .flynnType(FlynnTypography.bodyLarge)
                        .foregroundColor(FlynnColor.textPrimary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(FlynnSpacing.lg)
            }
            .background(FlynnColor.background)
            .navigationTitle("Activity")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .topBarTrailing) { Button("Done") { dismiss() } } }
        }
        .presentationDetents([.medium])
    }
}
