import SwiftUI
import UIKit
import Supabase

// MARK: - Step 1: Website scrape + results + completion form

struct WebsiteScrapeStepView: View {
    @Environment(FlashStore.self) private var flash
    @State private var url: String = ""
    @State private var phase: Phase = .idle
    @State private var showContinueBackground = false
    @FocusState private var urlFocused: Bool
    let onContinue: () -> Void

    enum Phase {
        case idle
        case scanning
        case done(ScrapeResult)
    }

    struct ScrapeResult {
        let businessName: String?
        let services: [String]
        let tone: String?
        let hoursSummary: String?
        let serviceArea: String?
        let cached: Bool
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: FlynnSpacing.md) {
                stepHeader(
                    eyebrow: "Step 1 of 6",
                    title: "Tell Flynn about your business",
                    subtitle: "We'll pull your services and tone from your website so your receptionist sounds like you."
                )

                switch phase {
                case .idle:
                    idleContent
                case .scanning:
                    scanningContent
                case .done(let result):
                    scrapeResultsCard(result)
                    FlynnButton(title: "Looks right — continue", action: onContinue, fullWidth: true)
                    Button("Edit details") {
                        withAnimation(.spring(response: 0.35, dampingFraction: 0.75)) {
                            phase = .idle
                            showContinueBackground = false
                        }
                    }
                    .flynnType(FlynnTypography.caption)
                    .foregroundColor(FlynnColor.textSecondary)
                    .frame(maxWidth: .infinity, minHeight: 44)
                    .contentShape(Rectangle())
                }
            }
            .padding(FlynnSpacing.lg)
        }
        .ignoresSafeArea(.keyboard, edges: .bottom)
    }

    // MARK: - Idle state

    @ViewBuilder
    private var idleContent: some View {
        FlynnTextField(
            label: "Website",
            text: $url,
            placeholder: "https://yourtradiebusiness.com.au",
            textContentType: .URL,
            autocapitalization: .never
        )
        .focused($urlFocused)

        FlynnButton(title: "Scan website", action: submit, fullWidth: true)

        Button("I don't have a website") { onContinue() }
            .flynnType(FlynnTypography.caption)
            .foregroundColor(FlynnColor.textSecondary)
            .frame(maxWidth: .infinity, minHeight: 44)
            .contentShape(Rectangle())
    }

    // MARK: - Scanning state

    @ViewBuilder
    private var scanningContent: some View {
        VStack(alignment: .leading, spacing: FlynnSpacing.sm) {
            HStack(spacing: FlynnSpacing.sm) {
                ProgressView()
                    .tint(FlynnColor.primary)
                Text("Scanning your website…")
                    .flynnType(FlynnTypography.h4)
                    .foregroundColor(FlynnColor.textPrimary)
            }

            ScanningProgressRows()
                .padding(.top, FlynnSpacing.xxs)
        }
        .padding(FlynnSpacing.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: FlynnRadii.md, style: .continuous)
                .fill(FlynnColor.backgroundSecondary)
        )
        .brutalistBorder(cornerRadius: FlynnRadii.md)
        .task {
            // After 10 seconds reveal the "continue in background" escape hatch.
            try? await Task.sleep(for: .seconds(10))
            withAnimation(.easeInOut(duration: 0.3)) { showContinueBackground = true }
        }

        if showContinueBackground {
            VStack(spacing: FlynnSpacing.xs) {
                Text("This can take up to 90 seconds. Keep setting up — we'll apply it automatically when done.")
                    .flynnType(FlynnTypography.bodySmall)
                    .foregroundColor(FlynnColor.textSecondary)
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)

                FlynnButton(title: "Continue in background", action: onContinue, fullWidth: true)
            }
            .transition(.move(edge: .bottom).combined(with: .opacity))
        }
    }

    // MARK: - Results card

    @ViewBuilder
    private func scrapeResultsCard(_ result: ScrapeResult) -> some View {
        VStack(alignment: .leading, spacing: FlynnSpacing.sm) {
            HStack {
                VStack(alignment: .leading, spacing: FlynnSpacing.xxs) {
                    Text(result.businessName ?? "Your Business")
                        .flynnType(FlynnTypography.h3)
                        .foregroundColor(FlynnColor.textPrimary)
                    Text(result.cached ? "From cache · instant" : "Detected from your website")
                        .flynnType(FlynnTypography.caption)
                        .foregroundColor(FlynnColor.textTertiary)
                }
                Spacer()
                Image(systemName: "checkmark.circle.fill")
                    .foregroundColor(FlynnColor.success)
                    .font(.title2)
            }

            ScrapeBreakdownList(result: result)

            if !result.services.isEmpty {
                FlowLayout(spacing: FlynnSpacing.xs) {
                    ForEach(Array(result.services.prefix(8).enumerated()), id: \.offset) { idx, service in
                        Text(service)
                            .flynnType(FlynnTypography.caption)
                            .foregroundColor(FlynnColor.primary)
                            .padding(.horizontal, FlynnSpacing.sm)
                            .padding(.vertical, FlynnSpacing.xxs)
                            .background(Capsule().fill(FlynnColor.primaryLight))
                            .transition(.scale(scale: 0.8).combined(with: .opacity))
                            .animation(
                                .spring(response: 0.35, dampingFraction: 0.7).delay(0.6 + Double(idx) * 0.05),
                                value: result.services.count
                            )
                    }
                }
            }
        }
        .padding(FlynnSpacing.md)
        .background(
            RoundedRectangle(cornerRadius: FlynnRadii.md, style: .continuous)
                .fill(FlynnColor.backgroundSecondary)
        )
        .brutalistBorder(cornerRadius: FlynnRadii.md)
        .transition(.move(edge: .bottom).combined(with: .opacity))
    }

    // MARK: - Submit

    private func submit() {
        urlFocused = false
        guard !url.isEmpty else { onContinue(); return }
        withAnimation(.spring(response: 0.35, dampingFraction: 0.75)) { phase = .scanning }

        // Unstructured Task — survives view dismissal so background scraping
        // still saves to DB even if user taps "Continue in background".
        Task {
            do {
                let session = try await FlynnSupabase.client.auth.session
                var request = URLRequest(
                    url: URL(string: "\(FlynnEnv.flynnAPIBaseURL)/api/scrape-website")!,
                    timeoutInterval: 120
                )
                request.httpMethod = "POST"
                request.setValue("Bearer \(session.accessToken)", forHTTPHeaderField: "Authorization")
                request.setValue("application/json", forHTTPHeaderField: "Content-Type")
                request.httpBody = try JSONSerialization.data(withJSONObject: ["url": url, "applyConfig": true])

                let (data, _) = try await URLSession.shared.data(for: request)
                guard let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
                    await MainActor.run { onContinue() }
                    return
                }
                let config = json["config"] as? [String: Any]
                let bp = config?["businessProfile"] as? [String: Any]
                let scraped = json["scrapedData"] as? [String: Any]
                let result = ScrapeResult(
                    businessName: bp?["public_name"] as? String
                        ?? (scraped?["metadata"] as? [String: Any])?["siteName"] as? String,
                    services: scraped?["services"] as? [String] ?? [],
                    tone: (bp?["brand_voice"] as? [String: Any])?["tone"] as? String,
                    hoursSummary: scraped?["businessHours"] as? String
                        ?? (scraped?["metadata"] as? [String: Any])?["hours"] as? String,
                    serviceArea: scraped?["serviceArea"] as? String ?? bp?["service_area"] as? String,
                    cached: (json["cached"] as? Bool) ?? false
                )
                await MainActor.run {
                    // If the user already advanced (background mode), just flash silently.
                    switch phase {
                    case .scanning:
                        withAnimation(.spring(response: 0.4, dampingFraction: 0.75)) {
                            showContinueBackground = false
                            phase = .done(result)
                        }
                        flash.success("Business info loaded")
                    default:
                        flash.success("Website scanned — your receptionist is updated")
                    }
                }
            } catch {
                await MainActor.run {
                    switch phase {
                    case .scanning:
                        flash.error("Couldn't load website — continue manually")
                        onContinue()
                    default:
                        break  // already advanced; silent fail is fine
                    }
                }
            }
        }
    }
}

// MARK: - Animated scanning rows (shown while waiting)

private struct ScanningProgressRows: View {
    private let labels = [
        ("building.2", "Business name"),
        ("wrench.and.screwdriver", "Services & offerings"),
        ("clock", "Hours & availability"),
        ("quote.bubble", "Tone & style"),
        ("sparkles", "Tagline & slogan"),
    ]
    @State private var visibleCount = 0
    @State private var pulse = false

    var body: some View {
        VStack(alignment: .leading, spacing: FlynnSpacing.xs) {
            ForEach(Array(labels.enumerated()), id: \.offset) { idx, label in
                if idx < visibleCount {
                    HStack(spacing: FlynnSpacing.xs) {
                        Image(systemName: label.0)
                            .font(.system(size: 12))
                            .foregroundColor(FlynnColor.primary)
                            .frame(width: 16)
                        Text(label.1)
                            .flynnType(FlynnTypography.caption)
                            .foregroundColor(FlynnColor.textSecondary)
                        Spacer()
                        // Pulsing ellipsis to show active work
                        Text("scanning")
                            .flynnType(FlynnTypography.caption)
                            .foregroundColor(FlynnColor.textTertiary)
                            .opacity(pulse ? 0.3 : 1.0)
                    }
                    .transition(.move(edge: .trailing).combined(with: .opacity))
                }
            }
        }
        .task {
            for i in 0..<labels.count {
                try? await Task.sleep(for: .milliseconds(i == 0 ? 300 : 500))
                withAnimation(.spring(response: 0.4, dampingFraction: 0.8)) { visibleCount = i + 1 }
            }
            // Start pulsing once all rows visible
            withAnimation(.easeInOut(duration: 0.9).repeatForever(autoreverses: true)) {
                pulse = true
            }
        }
    }
}

// MARK: - Minimal flow layout for service chips

private struct FlowLayout: Layout {
    var spacing: CGFloat

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let rows = computeRows(proposal: proposal, subviews: subviews)
        let height = rows.map { row in row.map { subviews[$0].sizeThatFits(.unspecified).height }.max() ?? 0 }
            .reduce(0) { $0 + $1 + spacing } - spacing
        return CGSize(width: proposal.width ?? 0, height: max(0, height))
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let rows = computeRows(proposal: ProposedViewSize(width: bounds.width, height: nil), subviews: subviews)
        var y = bounds.minY
        for row in rows {
            let rowHeight = row.map { subviews[$0].sizeThatFits(.unspecified).height }.max() ?? 0
            var x = bounds.minX
            for idx in row {
                let size = subviews[idx].sizeThatFits(.unspecified)
                subviews[idx].place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(size))
                x += size.width + spacing
            }
            y += rowHeight + spacing
        }
    }

    private func computeRows(proposal: ProposedViewSize, subviews: Subviews) -> [[Int]] {
        let maxWidth = proposal.width ?? .infinity
        var rows: [[Int]] = [[]]
        var rowWidth: CGFloat = 0
        for (idx, subview) in subviews.enumerated() {
            let w = subview.sizeThatFits(.unspecified).width
            if rowWidth + w > maxWidth && !rows[rows.count - 1].isEmpty {
                rows.append([])
                rowWidth = 0
            }
            rows[rows.count - 1].append(idx)
            rowWidth += w + spacing
        }
        return rows
    }
}

// MARK: - Step 2: Mode selector

struct CallHandlingModeStepView: View {
    let onContinue: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            stepHeader(
                eyebrow: "Step 2 of 6",
                title: "How should Flynn handle missed calls?",
                subtitle: "Start with SMS Links — it's free. Switch to AI any time."
            )
            .padding(.horizontal, FlynnSpacing.lg)
            .padding(.top, FlynnSpacing.lg)

            CallModeSelectorView(showInternalHeader: false)

            FlynnButton(
                title: "Continue",
                action: onContinue,
                fullWidth: true
            )
            .padding(FlynnSpacing.lg)
        }
    }
}

// MARK: - Step 3: IVR script

struct IvrScriptStepView: View {
    let onContinue: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            stepHeader(
                eyebrow: "Step 3 of 6",
                title: "What do callers hear?",
                subtitle: "Pick a greeting template for when Flynn answers. You can customise it any time."
            )
            .padding(.horizontal, FlynnSpacing.lg)
            .padding(.top, FlynnSpacing.lg)

            IVRScriptEditorView()

            FlynnButton(
                title: "Continue",
                action: onContinue,
                fullWidth: true
            )
            .padding(FlynnSpacing.lg)
        }
    }
}

// MARK: - Scrape breakdown (staggered check-off rows)

/// Renders up to five rows (name → services count → tone → hours → service area)
/// that animate in sequentially so the user *sees* that Flynn learned about them.
private struct ScrapeBreakdownList: View {
    let result: WebsiteScrapeStepView.ScrapeResult
    @State private var visibleRows: Int = 0

    private struct BreakdownRow: Identifiable {
        let id = UUID()
        let title: String
        let value: String
    }

    private var rows: [BreakdownRow] {
        var out: [BreakdownRow] = []
        if let name = result.businessName {
            out.append(.init(title: "Business name", value: name))
        }
        if !result.services.isEmpty {
            let n = result.services.count
            out.append(.init(title: "Services detected", value: "\(n) service\(n == 1 ? "" : "s")"))
        }
        if let tone = result.tone, !tone.isEmpty {
            out.append(.init(title: "Tone", value: tone.capitalized))
        }
        if let hours = result.hoursSummary, !hours.isEmpty {
            out.append(.init(title: "Hours", value: hours))
        }
        if let area = result.serviceArea, !area.isEmpty {
            out.append(.init(title: "Service area", value: area))
        }
        return out
    }

    var body: some View {
        VStack(alignment: .leading, spacing: FlynnSpacing.xs) {
            ForEach(Array(rows.enumerated()), id: \.element.id) { idx, row in
                if idx < visibleRows {
                    breakdownRow(row)
                        .transition(.asymmetric(
                            insertion: .move(edge: .trailing).combined(with: .opacity),
                            removal: .opacity
                        ))
                }
            }
        }
        .task {
            // Stagger at 80ms intervals — quick enough to feel snappy, slow
            // enough to read each row as it arrives.
            for idx in 0..<rows.count {
                try? await Task.sleep(for: .milliseconds(idx == 0 ? 120 : 80))
                withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) {
                    visibleRows = idx + 1
                }
            }
        }
    }

    private func breakdownRow(_ row: BreakdownRow) -> some View {
        HStack(spacing: FlynnSpacing.xs) {
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 14))
                .foregroundColor(FlynnColor.success)
            Text(row.title)
                .flynnType(FlynnTypography.caption)
                .foregroundColor(FlynnColor.textSecondary)
            Text("·")
                .foregroundColor(FlynnColor.textTertiary)
            Text(row.value)
                .flynnType(FlynnTypography.caption)
                .foregroundColor(FlynnColor.textPrimary)
                .lineLimit(1)
                .truncationMode(.tail)
            Spacer()
        }
    }
}

// MARK: - Shared header

@MainActor
@ViewBuilder
private func stepHeader(eyebrow: String, title: String, subtitle: String) -> some View {
    VStack(alignment: .leading, spacing: FlynnSpacing.xs) {
        Text(eyebrow)
            .flynnType(FlynnTypography.overline)
            .foregroundColor(FlynnColor.primary)
        Text(title)
            .flynnType(FlynnTypography.h2)
            .foregroundColor(FlynnColor.textPrimary)
        Text(subtitle)
            .flynnType(FlynnTypography.bodyMedium)
            .foregroundColor(FlynnColor.textSecondary)
            .fixedSize(horizontal: false, vertical: true)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
}

// MARK: - Step 2: Tone samples (teach Flynn your voice)

struct ToneSamplesStepView: View {
    @Environment(FlashStore.self) private var flash
    @State private var samples: [String] = ["", "", ""]
    @State private var saving = false
    let onContinue: () -> Void

    private struct ToneSampleInsert: Encodable {
        let sample_text: String
        let source: String
    }

    private var filledCount: Int {
        samples.filter { !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }.count
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: FlynnSpacing.md) {
                stepHeader(
                    eyebrow: "Step 2 of 6",
                    title: "Teach Flynn your voice",
                    subtitle: "Paste or type a few replies you'd actually send a customer. Flynn copies your style — slang, casing, emojis and all — so its drafts sound like you, not a robot."
                )

                ForEach(samples.indices, id: \.self) { idx in
                    FlynnTextField(
                        label: "Example reply \(idx + 1)",
                        text: $samples[idx],
                        placeholder: idx == 0 ? "e.g. yeah no worries mate, can swing by tomoz arvo" : "Another reply in your words",
                        autocapitalization: .sentences
                    )
                }

                FlynnButton(
                    title: filledCount > 0 ? "Save & continue" : "Continue",
                    action: save,
                    fullWidth: true,
                    isLoading: saving
                )

                Text("The more examples you add, the better Flynn matches you. You can add more any time.")
                    .flynnType(FlynnTypography.caption)
                    .foregroundColor(FlynnColor.textTertiary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(FlynnSpacing.lg)
        }
        .ignoresSafeArea(.keyboard, edges: .bottom)
    }

    private func save() {
        let rows = samples
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
            .map { ToneSampleInsert(sample_text: $0, source: "onboarding") }

        guard !rows.isEmpty else { onContinue(); return }

        saving = true
        Task {
            do {
                try await FlynnSupabase.client
                    .from("tone_samples")
                    .insert(rows)
                    .execute()
                await MainActor.run {
                    saving = false
                    flash.success("Flynn learned your voice")
                    onContinue()
                }
            } catch {
                await MainActor.run {
                    saving = false
                    flash.error("Couldn't save — continuing anyway")
                    onContinue()
                }
            }
        }
    }
}

// MARK: - Step 3: Connect calendar

struct ConnectCalendarStepView: View {
    @Environment(FlashStore.self) private var flash
    @State private var appleConnected = false
    @State private var connecting = false
    let onContinue: () -> Void

    private struct AppleFlagPatch: Encodable { let apple_calendar_connected: Bool }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: FlynnSpacing.md) {
                stepHeader(
                    eyebrow: "Your calendar",
                    title: "Connect your calendar",
                    subtitle: "So Flynn can offer customers times you're actually free and drop confirmed jobs straight into your calendar."
                )

                connectRow(
                    icon: "calendar",
                    title: "Apple Calendar",
                    subtitle: appleConnected ? "Connected" : "On your device — one tap",
                    connected: appleConnected
                ) {
                    connectApple()
                }

                connectRow(
                    icon: "globe",
                    title: "Google Calendar",
                    subtitle: "Connect later in Settings → Connected apps",
                    connected: false,
                    disabled: true
                ) {}

                FlynnButton(title: "Continue", action: onContinue, fullWidth: true)

                Button("Skip for now") { onContinue() }
                    .flynnType(FlynnTypography.caption)
                    .foregroundColor(FlynnColor.textSecondary)
                    .frame(maxWidth: .infinity, minHeight: 44)
                    .contentShape(Rectangle())
            }
            .padding(FlynnSpacing.lg)
        }
    }

    private func connectRow(
        icon: String,
        title: String,
        subtitle: String,
        connected: Bool,
        disabled: Bool = false,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            HStack(alignment: .top, spacing: FlynnSpacing.sm) {
                Image(systemName: icon)
                    .font(.system(size: 22))
                    .foregroundColor(disabled ? FlynnColor.textTertiary : FlynnColor.primary)
                    .frame(width: 32)
                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .flynnType(FlynnTypography.h4)
                        .foregroundColor(FlynnColor.textPrimary)
                    Text(subtitle)
                        .flynnType(FlynnTypography.caption)
                        .foregroundColor(FlynnColor.textSecondary)
                }
                Spacer()
                Image(systemName: connected ? "checkmark.circle.fill" : "chevron.right")
                    .foregroundColor(connected ? FlynnColor.success : FlynnColor.textTertiary)
            }
            .padding(FlynnSpacing.md)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: FlynnRadii.md, style: .continuous)
                    .fill(FlynnColor.backgroundSecondary)
            )
            .brutalistBorder(cornerRadius: FlynnRadii.md)
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
                await MainActor.run {
                    connecting = false
                    flash.error("Couldn't connect calendar")
                }
            }
        }
    }
}

// MARK: - Step 4: Personalized draft demo (the aha moment)

struct DraftDemoStepView: View {
    @State private var phase: Phase = .loading
    let onContinue: () -> Void

    enum Phase {
        case loading
        case done([String])
        case failed
    }

    // A realistic inbound customer text the demo drafts a reply to.
    private let sampleCustomerMessage =
        "Hi, saw your details online — do you do quotes? Roughly how much and when could you come out to take a look?"

    private struct DemoRequest: Encodable { let messages: [String] }
    private struct DemoResponse: Decodable { let drafts: [String] }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: FlynnSpacing.md) {
                stepHeader(
                    eyebrow: "Step 4 of 6",
                    title: "See Flynn reply for you",
                    subtitle: "Here's a real customer text — and the replies Flynn drafted in your voice, using your business. In the keyboard, you'd just tap one to send."
                )

                customerBubble

                switch phase {
                case .loading:
                    HStack(spacing: FlynnSpacing.sm) {
                        ProgressView().tint(FlynnColor.primary)
                        Text("Drafting replies in your voice…")
                            .flynnType(FlynnTypography.bodyMedium)
                            .foregroundColor(FlynnColor.textSecondary)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.vertical, FlynnSpacing.md)
                case .done(let drafts):
                    ForEach(Array(drafts.enumerated()), id: \.offset) { _, draft in
                        draftCard(draft)
                    }
                case .failed:
                    Text("Couldn't reach Flynn just now — you'll see this in action once you add the keyboard.")
                        .flynnType(FlynnTypography.bodyMedium)
                        .foregroundColor(FlynnColor.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }

                FlynnButton(title: "Love it — continue", action: onContinue, fullWidth: true)
            }
            .padding(FlynnSpacing.lg)
        }
        .task { await loadDrafts() }
    }

    private var customerBubble: some View {
        Text(sampleCustomerMessage)
            .flynnType(FlynnTypography.bodyMedium)
            .foregroundColor(FlynnColor.textPrimary)
            .padding(FlynnSpacing.md)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: FlynnRadii.md, style: .continuous)
                    .fill(FlynnColor.backgroundSecondary)
            )
            .brutalistBorder(cornerRadius: FlynnRadii.md)
    }

    private func draftCard(_ draft: String) -> some View {
        HStack(alignment: .top, spacing: FlynnSpacing.sm) {
            Image(systemName: "sparkles")
                .foregroundColor(FlynnColor.primary)
            Text(draft)
                .flynnType(FlynnTypography.bodyMedium)
                .foregroundColor(FlynnColor.textPrimary)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 0)
        }
        .padding(FlynnSpacing.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: FlynnRadii.md, style: .continuous)
                .fill(FlynnColor.primaryLight)
        )
        .brutalistBorder(cornerRadius: FlynnRadii.md)
    }

    private func loadDrafts() async {
        do {
            let session = try await FlynnSupabase.client.auth.session
            var request = URLRequest(
                url: URL(string: "\(FlynnEnv.flynnAPIBaseURL)/api/keyboard/draft-replies")!,
                timeoutInterval: 20
            )
            request.httpMethod = "POST"
            request.setValue("Bearer \(session.accessToken)", forHTTPHeaderField: "Authorization")
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSONEncoder().encode(DemoRequest(messages: [sampleCustomerMessage]))

            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode),
                  let decoded = try? JSONDecoder().decode(DemoResponse.self, from: data),
                  !decoded.drafts.isEmpty else {
                await MainActor.run { phase = .failed }
                return
            }
            await MainActor.run {
                withAnimation(.spring(response: 0.4, dampingFraction: 0.8)) {
                    phase = .done(decoded.drafts)
                }
            }
        } catch {
            await MainActor.run { phase = .failed }
        }
    }
}

// MARK: - Step 6: Install the keyboard (the one-off "big ask", value already shown)

struct InstallKeyboardStepView: View {
    let onFinish: () -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: FlynnSpacing.md) {
                Mascot(.phone, size: 132, backdrop: .cream)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding(.bottom, FlynnSpacing.xs)

                stepHeader(
                    eyebrow: "Last step",
                    title: "Add the Flynn keyboard",
                    subtitle: "This is how Flynn drafts replies right inside Messages. One-time setup — copy a customer's text, switch to the Flynn keyboard, tap a reply."
                )

                instructionRow(number: "1", text: "Open Settings → General → Keyboard → Keyboards.")
                instructionRow(number: "2", text: "Tap “Add New Keyboard…” and choose Flynn.")
                instructionRow(number: "3", text: "Tap Flynn in the list and turn on “Allow Full Access” so it can draft from your copied message.")

                FlynnButton(title: "Open Settings", action: openSettings, fullWidth: true)

                FlynnButton(
                    title: "I've added it — finish",
                    action: onFinish,
                    variant: .secondary,
                    fullWidth: true
                )
            }
            .padding(FlynnSpacing.lg)
        }
    }

    private func instructionRow(number: String, text: String) -> some View {
        HStack(alignment: .top, spacing: FlynnSpacing.sm) {
            Text(number)
                .flynnType(FlynnTypography.h4)
                .foregroundColor(.white)
                .frame(width: 28, height: 28)
                .background(Circle().fill(FlynnColor.primary))
            Text(text)
                .flynnType(FlynnTypography.bodyMedium)
                .foregroundColor(FlynnColor.textPrimary)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func openSettings() {
        if let url = URL(string: UIApplication.openSettingsURLString) {
            UIApplication.shared.open(url)
        }
    }
}

// MARK: - Welcome

struct WelcomeStepView: View {
    let onContinue: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: FlynnSpacing.lg) {
            Spacer()
            Mascot(.wave, size: 160, backdrop: .cream)
                .frame(maxWidth: .infinity, alignment: .center)
            VStack(alignment: .leading, spacing: FlynnSpacing.sm) {
                Text("Flynn")
                    .flynnType(FlynnTypography.overline)
                    .foregroundColor(FlynnColor.primary)
                Text("Reply to your customers in your own voice — and book the job.")
                    .flynnType(FlynnTypography.displayMedium)
                    .foregroundColor(FlynnColor.textPrimary)
                    .fixedSize(horizontal: false, vertical: true)
                Text("Flynn drafts your texts so they sound like you, then drops the booking in your calendar. Let's set it up in about a minute.")
                    .flynnType(FlynnTypography.bodyLarge)
                    .foregroundColor(FlynnColor.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer()
            FlynnButton(title: "Get started", action: onContinue, fullWidth: true)
        }
        .padding(FlynnSpacing.lg)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    }
}

// MARK: - What do you do? (free-text seed → tailored prompts + brain)

struct WhatYouDoStepView: View {
    @Bindable var store: OnboardingStore
    let onContinue: () -> Void
    @FocusState private var focused: Bool

    private var descriptionEmpty: Bool {
        store.businessDescription.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: FlynnSpacing.md) {
                Mascot(.thinking, size: 116, backdrop: .cream)
                    .frame(maxWidth: .infinity, alignment: .center)

                stepHeader(
                    eyebrow: "Your business",
                    title: "What do you do?",
                    subtitle: "Tell Flynn in your own words — like \u{201C}mobile dog groomer in Geelong\u{201D}. Flynn uses this so its replies sound right for your trade."
                )

                FlynnTextField(
                    label: "What you do",
                    text: $store.businessDescription,
                    placeholder: "e.g. emergency plumber on the northern beaches",
                    autocapitalization: .sentences
                )
                .focused($focused)

                FlynnTextField(
                    label: "Website (optional)",
                    text: $store.websiteURL,
                    placeholder: "https://\u{2026}",
                    textContentType: .URL,
                    autocapitalization: .never
                )

                if case .error(let msg) = store.understandingState {
                    Text(msg)
                        .flynnType(FlynnTypography.caption)
                        .foregroundColor(FlynnColor.error)
                }

                FlynnButton(
                    title: "Continue",
                    action: submit,
                    fullWidth: true,
                    isLoading: store.understandingState == .loading,
                    isDisabled: descriptionEmpty
                )
            }
            .padding(FlynnSpacing.lg)
        }
        .ignoresSafeArea(.keyboard, edges: .bottom)
    }

    private func submit() {
        focused = false
        Task {
            await store.understandBusiness()
            if case .loaded = store.understandingState { onContinue() }
        }
    }
}

// MARK: - Confirm Business Brain

struct ConfirmBrainStepView: View {
    @Bindable var store: OnboardingStore
    let onContinue: () -> Void
    @State private var saving = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: FlynnSpacing.md) {
                stepHeader(
                    eyebrow: "Your business",
                    title: "Does this look right?",
                    subtitle: "Flynn cites these in your replies. Fix anything that's off — you can always edit later."
                )

                FlynnTextField(label: "What you do", text: $store.detectedBusinessType, placeholder: "e.g. plumber")

                if !store.detectedServices.isEmpty {
                    Text("Services & rough pricing")
                        .flynnType(FlynnTypography.label)
                        .foregroundColor(FlynnColor.textPrimary)

                    ForEach($store.detectedServices) { $svc in
                        HStack(spacing: FlynnSpacing.sm) {
                            TextField("Service", text: $svc.name)
                                .flynnType(FlynnTypography.bodyMedium)
                            TextField("Price", text: $svc.priceRange)
                                .flynnType(FlynnTypography.bodyMedium)
                                .multilineTextAlignment(.trailing)
                                .frame(width: 110)
                        }
                        .padding(FlynnSpacing.sm)
                        .background(
                            RoundedRectangle(cornerRadius: FlynnRadii.md, style: .continuous)
                                .fill(FlynnColor.backgroundSecondary)
                        )
                        .brutalistBorder(cornerRadius: FlynnRadii.md)
                    }
                }

                FlynnTextField(
                    label: "Pricing notes (optional)",
                    text: $store.detectedPricingNote,
                    placeholder: "e.g. $90 callout, quotes are free"
                )

                FlynnButton(title: "Looks right — continue", action: save, fullWidth: true, isLoading: saving)
            }
            .padding(FlynnSpacing.lg)
        }
        .ignoresSafeArea(.keyboard, edges: .bottom)
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

// MARK: - Capture voice (reply to tailored prompts)

struct CaptureVoiceStepView: View {
    @Bindable var store: OnboardingStore
    let onContinue: () -> Void
    @State private var replies: [String] = []
    @State private var saving = false

    private struct ToneSampleInsert: Encodable { let sample_text: String; let source: String }

    private var prompts: [String] {
        store.samplePrompts.isEmpty
            ? ["Hi, do you have any availability this week and how much do you charge?",
               "Hey, can you come out sometime next week? Let me know what works.",
               "Quick question — do you cover my area?"]
            : store.samplePrompts
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: FlynnSpacing.md) {
                Mascot(.write, size: 120, backdrop: .cream)
                    .frame(maxWidth: .infinity, alignment: .center)

                stepHeader(
                    eyebrow: "Your voice",
                    title: "Reply like you really would",
                    subtitle: "These are texts a customer might send you. Reply exactly how you'd actually text back — short, casual, slang and all. This is how Flynn learns your voice."
                )

                ForEach(Array(prompts.enumerated()), id: \.offset) { idx, prompt in
                    VStack(alignment: .leading, spacing: FlynnSpacing.xs) {
                        Text(prompt)
                            .flynnType(FlynnTypography.bodyMedium)
                            .foregroundColor(FlynnColor.textPrimary)
                            .padding(FlynnSpacing.sm)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(
                                RoundedRectangle(cornerRadius: FlynnRadii.md, style: .continuous)
                                    .fill(FlynnColor.backgroundSecondary)
                            )
                            .brutalistBorder(cornerRadius: FlynnRadii.md)
                        FlynnTextField(
                            label: "Your reply",
                            text: replyBinding(idx),
                            placeholder: "type how you'd really reply\u{2026}",
                            autocapitalization: .sentences
                        )
                    }
                }

                FlynnButton(title: "Continue", action: save, fullWidth: true, isLoading: saving)
            }
            .padding(FlynnSpacing.lg)
        }
        .ignoresSafeArea(.keyboard, edges: .bottom)
        .onAppear {
            if replies.count != prompts.count {
                replies = Array(repeating: "", count: prompts.count)
            }
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

// MARK: - Sounds like you? (the aha loop — draft + approve/edit + redraft)

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
        store.samplePrompts.first ?? "Hi, are you available this week and how much would it be?"
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: FlynnSpacing.md) {
                stepHeader(
                    eyebrow: "Your voice",
                    title: "Sound like you?",
                    subtitle: "Here's Flynn replying to a customer in your voice — exactly what you'll get inside Messages."
                )

                customerBubble(customerMessage)

                switch phase {
                case .loading:
                    HStack(spacing: FlynnSpacing.sm) {
                        ProgressView().tint(FlynnColor.primary)
                        Text("Drafting in your voice\u{2026}")
                            .flynnType(FlynnTypography.bodyMedium)
                            .foregroundColor(FlynnColor.textSecondary)
                    }
                    .padding(.vertical, FlynnSpacing.md)

                case .draft(let d):
                    if editing {
                        VStack(alignment: .leading, spacing: FlynnSpacing.sm) {
                            FlynnTextField(label: "Make it sound like you", text: $editText, autocapitalization: .sentences)
                            FlynnButton(title: "Save & redraft", action: saveEdit, fullWidth: true)
                        }
                    } else {
                        Mascot(.thumbsup, size: 104, backdrop: .cream)
                            .frame(maxWidth: .infinity, alignment: .center)
                        draftCard(d)
                        HStack(spacing: FlynnSpacing.sm) {
                            FlynnButton(title: "\u{1F44D} That's me", action: onContinue, fullWidth: true)
                            FlynnButton(title: "Tweak it", action: { editText = d; editing = true }, variant: .secondary, fullWidth: true)
                        }
                    }

                case .failed:
                    Text("Couldn't draft right now — you'll see this in action once the keyboard's added.")
                        .flynnType(FlynnTypography.bodyMedium)
                        .foregroundColor(FlynnColor.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                    FlynnButton(title: "Continue", action: onContinue, fullWidth: true)
                }
            }
            .padding(FlynnSpacing.lg)
        }
        .task { await loadDraft() }
    }

    private func customerBubble(_ text: String) -> some View {
        Text(text)
            .flynnType(FlynnTypography.bodyMedium)
            .foregroundColor(FlynnColor.textPrimary)
            .padding(FlynnSpacing.md)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: FlynnRadii.md, style: .continuous)
                    .fill(FlynnColor.backgroundSecondary)
            )
            .brutalistBorder(cornerRadius: FlynnRadii.md)
    }

    private func draftCard(_ text: String) -> some View {
        HStack(alignment: .top, spacing: FlynnSpacing.sm) {
            Image(systemName: "sparkles").foregroundColor(FlynnColor.primary)
            Text(text)
                .flynnType(FlynnTypography.bodyMedium)
                .foregroundColor(FlynnColor.textPrimary)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 0)
        }
        .padding(FlynnSpacing.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: FlynnRadii.md, style: .continuous)
                .fill(FlynnColor.primaryLight)
        )
        .brutalistBorder(cornerRadius: FlynnRadii.md)
    }

    private func saveEdit() {
        let text = editText.trimmingCharacters(in: .whitespacesAndNewlines)
        editing = false
        guard !text.isEmpty else { return }
        phase = .loading
        Task {
            await postAccept(text)
            await loadDraft()
        }
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
        } catch {
            // best-effort
        }
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
            withAnimation(.spring(response: 0.4, dampingFraction: 0.8)) {
                phase = .draft(first)
            }
        } catch {
            phase = .failed
        }
    }
}
