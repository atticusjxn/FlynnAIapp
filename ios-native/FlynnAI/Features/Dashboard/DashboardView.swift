import SwiftUI
import UIKit

/// Home: a visual view of what Flynn is doing for you, built from your actual
/// activity over text. Vertical-agnostic — whatever you use Flynn for (replies,
/// invoices, parts orders, bookings, anything new it learns) shows up here. Cards
/// appear only when there's something to show; an empty home steers you to text
/// Flynn and connect the apps it works with.
struct DashboardView: View {
    @State private var store = DashboardStore()
    @State private var showingAddReply = false
    @State private var showingKeyboardSetup = false
    @State private var showingPractice = false
    @Environment(DeepLinkRouter.self) private var deepLink

    private var hasActivity: Bool {
        !store.awaitingConfirmation.isEmpty || !store.events.isEmpty || !store.recentActivity.isEmpty
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: FlynnSpacing.lg) {
                greeting

                switch store.state {
                case .idle, .loading:
                    loadingCard
                case .error(let message):
                    errorCard(message: message)
                case .loaded:
                    if !store.awaitingConfirmation.isEmpty { awaitingSection }
                    if !store.events.isEmpty { upcomingSection }
                    if !store.recentActivity.isEmpty { activitySection }
                    if !hasActivity { emptyStateCard }
                    quickActionsCard
                    if !store.keyboardAdded { keyboardCard }
                }
            }
            .padding(.horizontal, FlynnSpacing.lg)
            .padding(.top, FlynnSpacing.md)
            .padding(.bottom, FlynnSpacing.xxl)
        }
        .background(FlynnColor.background)
        .navigationTitle("Home")
        .navigationBarTitleDisplayMode(.large)
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

    // MARK: – Greeting

    private var greeting: some View {
        VStack(alignment: .leading, spacing: FlynnSpacing.xxs) {
            Text(greetingEyebrow)
                .flynnType(FlynnTypography.overline)
                .foregroundColor(FlynnColor.textTertiary)
            Text(store.firstName.map { "Hey, \($0)." } ?? "Flynn")
                .flynnType(FlynnTypography.h1)
                .foregroundColor(FlynnColor.textPrimary)
            Text("Text Flynn whatever you need handled. Here's what it's been up to.")
                .flynnType(FlynnTypography.bodyMedium)
                .foregroundColor(FlynnColor.textSecondary)
        }
    }

    private var greetingEyebrow: String {
        let h = Calendar.current.component(.hour, from: Date())
        switch h {
        case 5..<12: return "Good morning"
        case 12..<17: return "Good afternoon"
        default: return "Good evening"
        }
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
                .background(RoundedRectangle(cornerRadius: FlynnRadii.md, style: .continuous).fill(FlynnColor.backgroundSecondary))
                .brutalistBorder(cornerRadius: FlynnRadii.md, color: FlynnColor.warning, lineWidth: 2)
            }
        }
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
                .background(RoundedRectangle(cornerRadius: FlynnRadii.md, style: .continuous).fill(FlynnColor.backgroundSecondary))
                .brutalistBorder(cornerRadius: FlynnRadii.md)
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
        .background(RoundedRectangle(cornerRadius: FlynnRadii.md, style: .continuous).fill(FlynnColor.backgroundSecondary))
        .brutalistBorder(cornerRadius: FlynnRadii.md)
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
        .background(RoundedRectangle(cornerRadius: FlynnRadii.md, style: .continuous).fill(FlynnColor.backgroundSecondary))
        .brutalistBorder(cornerRadius: FlynnRadii.md)
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
        .background(RoundedRectangle(cornerRadius: FlynnRadii.md, style: .continuous).fill(FlynnColor.backgroundSecondary))
        .brutalistBorder(cornerRadius: FlynnRadii.md)
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
