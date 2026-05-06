import SwiftUI
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
