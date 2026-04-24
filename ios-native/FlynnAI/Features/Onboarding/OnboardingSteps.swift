import SwiftUI
import Supabase

// MARK: - Step 1: Website scrape + results + completion form

struct WebsiteScrapeStepView: View {
    @Environment(FlashStore.self) private var flash
    @State private var url: String = ""
    @State private var isSubmitting = false
    @State private var scrapeResult: ScrapeResult?
    @FocusState private var urlFocused: Bool
    let onContinue: () -> Void

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

                if scrapeResult == nil {
                    FlynnTextField(
                        label: "Website",
                        text: $url,
                        placeholder: "https://yourtradiebusiness.com.au",
                        textContentType: .URL,
                        autocapitalization: .never
                    )
                    .focused($urlFocused)
                    .disabled(isSubmitting)

                    FlynnButton(
                        title: isSubmitting ? "Scanning…" : "Continue",
                        action: submit,
                        fullWidth: true,
                        isLoading: isSubmitting
                    )
                    .disabled(isSubmitting)

                    Button("I don't have a website") { onContinue() }
                        .flynnType(FlynnTypography.caption)
                        .foregroundColor(FlynnColor.textSecondary)
                        .frame(maxWidth: .infinity, minHeight: 44)
                        .contentShape(Rectangle())
                } else {
                    scrapeResultsCard

                    FlynnButton(
                        title: "Looks right — continue",
                        action: onContinue,
                        fullWidth: true
                    )
                    Button("Edit details") {
                        withAnimation(.spring(response: 0.35, dampingFraction: 0.75)) {
                            scrapeResult = nil
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

    @ViewBuilder
    private var scrapeResultsCard: some View {
        if let result = scrapeResult {
            VStack(alignment: .leading, spacing: FlynnSpacing.sm) {
                HStack {
                    VStack(alignment: .leading, spacing: FlynnSpacing.xxs) {
                        Text(result.businessName ?? "Your Business")
                            .flynnType(FlynnTypography.h3)
                            .foregroundColor(FlynnColor.textPrimary)
                        if result.cached {
                            Text("From cache · instant")
                                .flynnType(FlynnTypography.caption)
                                .foregroundColor(FlynnColor.textTertiary)
                        } else {
                            Text("Detected from your website")
                                .flynnType(FlynnTypography.caption)
                                .foregroundColor(FlynnColor.textTertiary)
                        }
                    }
                    Spacer()
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundColor(FlynnColor.success)
                        .font(.title2)
                }

                // Narrated breakdown — rolls in check-off rows sequentially so the
                // user *feels* that Flynn has actually learned about their business.
                ScrapeBreakdownList(result: result)

                if !result.services.isEmpty {
                    FlowLayout(spacing: FlynnSpacing.xs) {
                        ForEach(Array(result.services.prefix(8).enumerated()), id: \.offset) { idx, service in
                            Text(service)
                                .flynnType(FlynnTypography.caption)
                                .foregroundColor(FlynnColor.primary)
                                .padding(.horizontal, FlynnSpacing.sm)
                                .padding(.vertical, FlynnSpacing.xxs)
                                .background(
                                    Capsule().fill(FlynnColor.primaryLight)
                                )
                                .transition(.scale(scale: 0.8).combined(with: .opacity))
                                .animation(
                                    .spring(response: 0.35, dampingFraction: 0.7)
                                    .delay(0.6 + Double(idx) * 0.05),
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
    }

    private func submit() {
        urlFocused = false
        guard !url.isEmpty else { onContinue(); return }
        isSubmitting = true
        Task {
            do {
                let session = try await FlynnSupabase.client.auth.session
                var request = URLRequest(url: URL(string: "\(FlynnEnv.flynnAPIBaseURL)/api/scrape-website")!)
                request.httpMethod = "POST"
                request.setValue("Bearer \(session.accessToken)", forHTTPHeaderField: "Authorization")
                request.setValue("application/json", forHTTPHeaderField: "Content-Type")
                let body: [String: Any] = ["url": url, "applyConfig": true]
                request.httpBody = try JSONSerialization.data(withJSONObject: body)

                let (data, _) = try await URLSession.shared.data(for: request)
                if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] {
                    let config = json["config"] as? [String: Any]
                    let bp = config?["businessProfile"] as? [String: Any]
                    let scraped = json["scrapedData"] as? [String: Any]
                    let rawServices = scraped?["services"] as? [String] ?? []
                    let name = bp?["public_name"] as? String
                        ?? (scraped?["metadata"] as? [String: Any])?["siteName"] as? String
                    let tone = (bp?["brand_voice"] as? [String: Any])?["tone"] as? String
                    let hoursSummary = (scraped?["hours"] as? String)
                        ?? (scraped?["metadata"] as? [String: Any])?["hours"] as? String
                    let serviceArea = scraped?["serviceArea"] as? String
                        ?? (bp?["service_area"] as? String)
                    withAnimation(.spring(response: 0.4, dampingFraction: 0.75)) {
                        scrapeResult = ScrapeResult(
                            businessName: name,
                            services: rawServices,
                            tone: tone,
                            hoursSummary: hoursSummary,
                            serviceArea: serviceArea,
                            cached: (json["cached"] as? Bool) ?? false
                        )
                    }
                    flash.success("Business info loaded")
                } else {
                    onContinue()
                }
            } catch {
                flash.error("Couldn't load website — continue manually")
                onContinue()
            }
            isSubmitting = false
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
                title: "Pick an IVR template",
                subtitle: "This is what callers hear when Flynn answers. You can tweak it later."
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
