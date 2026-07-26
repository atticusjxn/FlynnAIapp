import SwiftUI
import Supabase
import UIKit

/// Diverting the operator's mobile to their Flynn number.
///
/// This is the step that makes the receptionist real: their advertised number
/// never changes, but the calls they can't take ring Flynn instead. Australian
/// carriers all take the same GSM conditional-forwarding codes, dialled from
/// the handset — there is no API for this, so the job of this screen is to make
/// dialling them a single tap and to be honest that iOS can't read the result
/// back.
///
/// Deliberately conditional-only: `**21*` (forward everything) would send calls
/// the operator is standing right next to straight past them.
@MainActor
@Observable
final class CallForwardingStore {
    enum LoadState: Equatable { case idle, loading, loaded, error(String) }

    private(set) var loadState: LoadState = .idle
    private(set) var flynnNumber: String?

    private let client: SupabaseClient

    init(client: SupabaseClient = FlynnSupabase.client) {
        self.client = client
    }

    func load() async {
        loadState = .loading
        struct Row: Decodable { let twilio_phone_number: String? }
        do {
            let session = try await client.auth.session
            let row: Row = try await client
                .from("users")
                .select("twilio_phone_number")
                .eq("id", value: session.user.id.uuidString)
                .single()
                .execute()
                .value
            flynnNumber = row.twilio_phone_number?.isEmpty == false ? row.twilio_phone_number : nil
            loadState = .loaded
        } catch {
            loadState = .error(error.localizedDescription)
        }
    }
}

/// One diversion rule: the GSM code, and what it means in plain English.
private struct ForwardingRule: Identifiable {
    let id: String
    let icon: String
    let title: String
    let subtitle: String
    let prefix: String

    /// `**61*<number>#` — dialled as-is by the phone app.
    func code(for number: String) -> String {
        "\(prefix)\(number.filter { $0.isNumber || $0 == "+" })#"
    }

    static let all: [ForwardingRule] = [
        ForwardingRule(
            id: "no-answer",
            icon: "phone.badge.waveform",
            title: "When you don't pick up",
            subtitle: "You're on the tools and it rings out. This is the one that matters.",
            prefix: "**61*"
        ),
        ForwardingRule(
            id: "busy",
            icon: "phone.arrow.up.right",
            title: "When you're already on a call",
            subtitle: "A second job rings while you're talking to the first.",
            prefix: "**67*"
        ),
        ForwardingRule(
            id: "unreachable",
            icon: "antenna.radiowaves.left.and.right.slash",
            title: "When you've got no signal",
            subtitle: "Underground, out of range, or your phone's flat.",
            prefix: "**62*"
        ),
    ]
}

struct CallForwardingView: View {
    @Environment(FlashStore.self) private var flash
    @State private var store = CallForwardingStore()

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: FlynnSpacing.lg) {
                header

                switch store.loadState {
                case .idle, .loading:
                    ProgressView()
                        .frame(maxWidth: .infinity, minHeight: 200)
                case .error(let message):
                    Text(message)
                        .flynnType(FlynnTypography.bodyMedium)
                        .foregroundColor(FlynnColor.error)
                case .loaded:
                    if let number = store.flynnNumber {
                        numberCard(number)
                        rulesSection(number)
                        testSection
                        turnOffSection
                    } else {
                        noNumberCard
                    }
                }
            }
            .padding(FlynnSpacing.lg)
        }
        .background(FlynnColor.background)
        .navigationTitle("Divert your calls")
        .navigationBarTitleDisplayMode(.large)
        .task { await store.load() }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: FlynnSpacing.xs) {
            Text("Call diversion")
                .flynnType(FlynnTypography.overline)
                .foregroundColor(FlynnColor.textTertiary)
            Text("Keep your number, never miss a call")
                .flynnType(FlynnTypography.h3)
                .foregroundColor(FlynnColor.textPrimary)
            Text("Your number stays exactly as it is. These tell your carrier that when you can't pick up, send the call to Flynn instead. Each one is a single tap, then hit call.")
                .flynnType(FlynnTypography.bodyMedium)
                .foregroundColor(FlynnColor.textSecondary)
        }
    }

    private func numberCard(_ number: String) -> some View {
        VStack(alignment: .leading, spacing: FlynnSpacing.xs) {
            Text("Your Flynn number")
                .flynnType(FlynnTypography.caption)
                .foregroundColor(FlynnColor.textTertiary)
            HStack {
                Text(formatAUNumber(number))
                    .flynnType(FlynnTypography.h3)
                    .foregroundColor(FlynnColor.primary)
                Spacer()
                Button {
                    UIPasteboard.general.string = number
                    flash.show("Number copied.", kind: .success)
                } label: {
                    Label("Copy", systemImage: "doc.on.doc")
                        .flynnType(FlynnTypography.label)
                        .foregroundColor(FlynnColor.textSecondary)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(FlynnSpacing.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: FlynnRadii.lg, style: .continuous)
                .fill(FlynnColor.backgroundSecondary)
        )
    }

    private func rulesSection(_ number: String) -> some View {
        VStack(alignment: .leading, spacing: FlynnSpacing.sm) {
            Text("Set these three")
                .flynnType(FlynnTypography.overline)
                .foregroundColor(FlynnColor.textTertiary)

            ForEach(ForwardingRule.all) { rule in
                ruleRow(rule, number: number)
            }
        }
    }

    private func ruleRow(_ rule: ForwardingRule, number: String) -> some View {
        let code = rule.code(for: number)
        return Button {
            dial(code)
        } label: {
            HStack(alignment: .top, spacing: FlynnSpacing.sm) {
                Image(systemName: rule.icon)
                    .font(.system(size: 20))
                    .foregroundColor(FlynnColor.primary)
                    .frame(width: 28)

                VStack(alignment: .leading, spacing: 3) {
                    Text(rule.title)
                        .flynnType(FlynnTypography.h4)
                        .foregroundColor(FlynnColor.textPrimary)
                        .multilineTextAlignment(.leading)
                    Text(rule.subtitle)
                        .flynnType(FlynnTypography.caption)
                        .foregroundColor(FlynnColor.textSecondary)
                        .multilineTextAlignment(.leading)
                    Text(code)
                        .flynnType(FlynnTypography.caption)
                        .monospaced()
                        .foregroundColor(FlynnColor.textTertiary)
                        .padding(.top, 2)
                }

                Spacer(minLength: 0)

                Image(systemName: "phone.fill")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundColor(FlynnColor.primary)
                    .padding(.top, 4)
            }
            .padding(FlynnSpacing.md)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: FlynnRadii.lg, style: .continuous)
                    .fill(FlynnColor.backgroundSecondary)
            )
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .contextMenu {
            Button {
                UIPasteboard.general.string = code
                flash.show("Code copied.", kind: .success)
            } label: {
                Label("Copy code", systemImage: "doc.on.doc")
            }
        }
    }

    private var testSection: some View {
        VStack(alignment: .leading, spacing: FlynnSpacing.xs) {
            Text("Check it worked")
                .flynnType(FlynnTypography.overline)
                .foregroundColor(FlynnColor.textTertiary)
            Text("Your phone can't tell us whether the carrier took it, so test it the real way: get someone to ring your normal number and just don't answer. Flynn should pick up after a few rings.")
                .flynnType(FlynnTypography.bodyMedium)
                .foregroundColor(FlynnColor.textSecondary)
        }
        .padding(FlynnSpacing.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: FlynnRadii.lg, style: .continuous)
                .fill(FlynnColor.primaryLight.opacity(0.5))
        )
    }

    private var turnOffSection: some View {
        VStack(alignment: .leading, spacing: FlynnSpacing.xs) {
            Button {
                dial("##002#")
            } label: {
                Label("Turn all diversion off", systemImage: "xmark.circle")
                    .flynnType(FlynnTypography.label)
                    .foregroundColor(FlynnColor.textSecondary)
            }
            .buttonStyle(.plain)
            Text("Cancels every diversion on your number, including any your carrier set up.")
                .flynnType(FlynnTypography.caption)
                .foregroundColor(FlynnColor.textTertiary)
        }
        .padding(.top, FlynnSpacing.xs)
    }

    private var noNumberCard: some View {
        VStack(alignment: .leading, spacing: FlynnSpacing.sm) {
            Text("You don't have a Flynn number yet")
                .flynnType(FlynnTypography.h4)
                .foregroundColor(FlynnColor.textPrimary)
            Text("Once your receptionist is set up you'll get your own number, and this is where you point your missed calls at it.")
                .flynnType(FlynnTypography.bodyMedium)
                .foregroundColor(FlynnColor.textSecondary)
        }
        .padding(FlynnSpacing.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: FlynnRadii.lg, style: .continuous)
                .fill(FlynnColor.backgroundSecondary)
        )
    }

    /// `#` has to be percent-escaped or the URL is truncated at the fragment.
    private func dial(_ code: String) {
        let escaped = code.replacingOccurrences(of: "#", with: "%23")
        guard let url = URL(string: "tel://\(escaped)"), UIApplication.shared.canOpenURL(url) else {
            UIPasteboard.general.string = code
            flash.show("Couldn't open the dialler — code copied instead.", kind: .info)
            return
        }
        UIApplication.shared.open(url)
    }

    /// +61480123456 → 0480 123 456 for display.
    private func formatAUNumber(_ e164: String) -> String {
        guard e164.hasPrefix("+61"), e164.count == 12 else { return e164 }
        let local = "0" + e164.dropFirst(3)
        return "\(local.prefix(4)) \(local.dropFirst(4).prefix(3)) \(local.dropFirst(7))"
    }
}
