import SwiftUI
import UIKit

/// Home for the text co-pilot: leads with setup status (keyboard + calendar),
/// quick access to the Business Brain & voice, and recent bookings + replies.
/// Keeps the novel copy → Flynn keyboard → tap gesture sticky with a practice
/// reminder.
struct DashboardView: View {
    @State private var store = DashboardStore()
    @State private var showingPractice = false
    @State private var showingAddReply = false
    @Environment(DeepLinkRouter.self) private var deepLink

    private var setupStepsRemaining: Int {
        (store.keyboardAdded ? 0 : 1) + (store.calendarConnected ? 0 : 1)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: FlynnSpacing.lg) {
                greeting

                if store.state == .loaded && setupStepsRemaining > 0 {
                    setupCard
                }

                howFlynnWorksCard

                businessBrainCard

                switch store.state {
                case .idle, .loading:
                    loadingCard
                case .error(let message):
                    errorCard(message: message)
                case .loaded:
                    if !store.recentReplies.isEmpty {
                        recentRepliesSection
                    }
                    if !store.events.isEmpty {
                        upcomingSection
                    }
                }
            }
            .padding(.horizontal, FlynnSpacing.lg)
            .padding(.top, FlynnSpacing.md)
            .padding(.bottom, FlynnSpacing.xxl)
        }
        .background(FlynnColor.background)
        .navigationTitle("Home")
        .navigationBarTitleDisplayMode(.large)
        .sheet(isPresented: $showingPractice) {
            NavigationStack {
                PracticeStepView(onContinue: { showingPractice = false })
                    .toolbar { ToolbarItem(placement: .topBarTrailing) { Button("Done") { showingPractice = false } } }
            }
        }
        .sheet(isPresented: $showingAddReply) {
            AddReplySheet { Task { await store.load() } }
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
            Text(setupStepsRemaining > 0
                 ? "Finish setup to start replying with Flynn."
                 : "You're set — copy a customer's text and tap the Flynn keyboard.")
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

    // MARK: – Setup checklist

    private var setupCard: some View {
        VStack(alignment: .leading, spacing: FlynnSpacing.sm) {
            HStack {
                Image(systemName: "bolt.fill").foregroundColor(FlynnColor.primary)
                Text("Finish setting up Flynn")
                    .flynnType(FlynnTypography.h4)
                    .foregroundColor(FlynnColor.textPrimary)
                Spacer()
                Text("\(2 - setupStepsRemaining) / 2")
                    .flynnType(FlynnTypography.caption)
                    .foregroundColor(FlynnColor.textTertiary)
            }

            Divider()

            setupStep(
                icon: "keyboard",
                title: "Add the Flynn keyboard",
                subtitle: "Enable Flynn + turn on Full Access, then open it once",
                done: store.keyboardAdded
            ) {
                // Open Flynn's Settings page — tap Keyboards there to enable the
                // keyboard + Full Access. (iOS has no deeper link to the add-keyboard
                // pane.) Practice still lives in the "How Flynn works" card below.
                if let url = URL(string: UIApplication.openSettingsURLString) {
                    UIApplication.shared.open(url)
                }
            }

            setupStep(
                icon: "calendar.badge.plus",
                title: "Connect your calendar",
                subtitle: "Offer real free times and book jobs",
                done: store.calendarConnected
            ) {
                deepLink.pending = .init(tab: .dashboard, route: .settingsSection(.integrations))
            }
        }
        .padding(FlynnSpacing.md)
        .background(
            RoundedRectangle(cornerRadius: FlynnRadii.md, style: .continuous)
                .fill(FlynnColor.backgroundSecondary)
        )
        .brutalistBorder(cornerRadius: FlynnRadii.md, color: FlynnColor.primary, lineWidth: 2)
    }

    private func setupStep(icon: String, title: String, subtitle: String, done: Bool, action: @escaping () -> Void) -> some View {
        Button(action: done ? {} : action) {
            HStack(spacing: FlynnSpacing.sm) {
                ZStack {
                    Circle()
                        .fill(done ? FlynnColor.successLight : FlynnColor.background)
                        .frame(width: 36, height: 36)
                    Image(systemName: done ? "checkmark" : icon)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundColor(done ? FlynnColor.success : FlynnColor.textSecondary)
                }
                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .flynnType(FlynnTypography.label)
                        .foregroundColor(done ? FlynnColor.textTertiary : FlynnColor.textPrimary)
                        .strikethrough(done)
                    Text(subtitle)
                        .flynnType(FlynnTypography.caption)
                        .foregroundColor(FlynnColor.textTertiary)
                }
                Spacer()
                if !done {
                    Image(systemName: "chevron.right")
                        .font(.caption)
                        .foregroundColor(FlynnColor.textTertiary)
                }
            }
        }
        .buttonStyle(.plain)
        .disabled(done)
    }

    // MARK: – How Flynn works (sticky reminder + practice)

    private var howFlynnWorksCard: some View {
        VStack(alignment: .leading, spacing: FlynnSpacing.sm) {
            HStack(spacing: FlynnSpacing.sm) {
                Mascot(.point, size: 44)
                Text("How Flynn works")
                    .flynnType(FlynnTypography.h4)
                    .foregroundColor(FlynnColor.textPrimary)
            }
            HStack(spacing: FlynnSpacing.sm) {
                miniStep(number: "1", text: "Copy the customer's text")
                miniStep(number: "2", text: "Switch to the Flynn keyboard")
                miniStep(number: "3", text: "Tap a reply & send")
            }
            FlynnButton(title: "Practice again", action: { showingPractice = true }, variant: .secondary, size: .small)
        }
        .padding(FlynnSpacing.md)
        .background(
            RoundedRectangle(cornerRadius: FlynnRadii.md, style: .continuous)
                .fill(FlynnColor.backgroundSecondary)
        )
        .brutalistBorder(cornerRadius: FlynnRadii.md)
    }

    private func miniStep(number: String, text: String) -> some View {
        VStack(alignment: .leading, spacing: FlynnSpacing.xxs) {
            Text(number)
                .flynnType(FlynnTypography.caption)
                .foregroundColor(.white)
                .frame(width: 22, height: 22)
                .background(Circle().fill(FlynnColor.primary))
            Text(text)
                .flynnType(FlynnTypography.caption)
                .foregroundColor(FlynnColor.textSecondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: – Business Brain & voice

    private var businessBrainCard: some View {
        VStack(alignment: .leading, spacing: FlynnSpacing.sm) {
            Text("Your Business Brain & voice")
                .flynnType(FlynnTypography.h4)
                .foregroundColor(FlynnColor.textPrimary)
            Text("The better Flynn knows your business and your style, the better your replies.")
                .flynnType(FlynnTypography.caption)
                .foregroundColor(FlynnColor.textSecondary)
                .fixedSize(horizontal: false, vertical: true)
            HStack(spacing: FlynnSpacing.sm) {
                Button { deepLink.pending = .init(tab: .dashboard, route: .settingsSection(.businessProfile)) } label: {
                    Label("Edit business", systemImage: "building.2")
                        .flynnType(FlynnTypography.caption)
                        .foregroundColor(FlynnColor.primary)
                        .frame(maxWidth: .infinity, minHeight: 40)
                        .background(RoundedRectangle(cornerRadius: FlynnRadii.md, style: .continuous).fill(FlynnColor.background))
                        .brutalistBorder(cornerRadius: FlynnRadii.md)
                }
                Button { showingAddReply = true } label: {
                    Label("Add a reply", systemImage: "text.bubble")
                        .flynnType(FlynnTypography.caption)
                        .foregroundColor(FlynnColor.primary)
                        .frame(maxWidth: .infinity, minHeight: 40)
                        .background(RoundedRectangle(cornerRadius: FlynnRadii.md, style: .continuous).fill(FlynnColor.background))
                        .brutalistBorder(cornerRadius: FlynnRadii.md)
                }
            }
            .buttonStyle(.plain)
        }
        .padding(FlynnSpacing.md)
        .background(
            RoundedRectangle(cornerRadius: FlynnRadii.md, style: .continuous)
                .fill(FlynnColor.backgroundSecondary)
        )
        .brutalistBorder(cornerRadius: FlynnRadii.md)
    }

    // MARK: – Recent replies

    private var recentRepliesSection: some View {
        VStack(alignment: .leading, spacing: FlynnSpacing.sm) {
            Text("Recent replies you sent")
                .flynnType(FlynnTypography.h4)
                .foregroundColor(FlynnColor.textPrimary)
            ForEach(Array(store.recentReplies.enumerated()), id: \.offset) { _, reply in
                HStack(alignment: .top, spacing: FlynnSpacing.sm) {
                    Image(systemName: "checkmark.message.fill")
                        .foregroundColor(FlynnColor.success)
                    Text(reply)
                        .flynnType(FlynnTypography.bodySmall)
                        .foregroundColor(FlynnColor.textPrimary)
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

