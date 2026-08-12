import SwiftUI

/// Real Support and Terms/Privacy screens.
///
/// These settings sections used to route to `PlaceholderDetailView`, which drew
/// only its own title — reachable in Release by deep link (flynnai://settings/
/// terms, /support), which is App Store review exposure. These are the real
/// screens.

struct SupportView: View {
    @Environment(\.openURL) private var openURL

    private var appVersion: String {
        let v = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "—"
        let b = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "—"
        return "\(v) (\(b))"
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: FlynnSpacing.lg) {
                VStack(alignment: .leading, spacing: FlynnSpacing.sm) {
                    Text("Get help")
                        .flynnType(FlynnTypography.overline)
                        .foregroundColor(FlynnColor.textTertiary)
                        .padding(.leading, FlynnSpacing.xs)
                    VStack(spacing: 0) {
                        supportRow("bubble.left.and.text.bubble.right.fill", "Email support",
                                   detail: "support@flynnai.app") {
                            if let url = URL(string: "mailto:support@flynnai.app") { openURL(url) }
                        }
                        Divider().overlay(FlynnColor.borderSubtle).padding(.leading, 52)
                        supportRow("questionmark.circle.fill", "Help centre",
                                   detail: "flynnai.app/help", external: true) {
                            if let url = URL(string: "https://flynnai.app/help") { openURL(url) }
                        }
                    }
                    .flynnCardSurface(.quiet)
                }

                Text("Flynn \(appVersion)")
                    .flynnType(FlynnTypography.caption)
                    .foregroundColor(FlynnColor.textTertiary)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding(.top, FlynnSpacing.md)
            }
            .padding(FlynnSpacing.lg)
        }
        .background(FlynnColor.background)
        .navigationTitle("Help & Support")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func supportRow(_ icon: String, _ title: String, detail: String, external: Bool = false, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: FlynnSpacing.md) {
                Image(systemName: icon)
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundColor(FlynnColor.primary)
                    .frame(width: 24)
                VStack(alignment: .leading, spacing: 2) {
                    Text(title).flynnType(FlynnTypography.bodyLarge).foregroundColor(FlynnColor.textPrimary)
                    Text(detail).flynnType(FlynnTypography.caption).foregroundColor(FlynnColor.textTertiary)
                }
                Spacer(minLength: 0)
                Image(systemName: external ? "arrow.up.right" : "chevron.right")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(FlynnColor.textTertiary)
            }
            .padding(.horizontal, FlynnSpacing.md)
            .frame(minHeight: 60)
            .contentShape(Rectangle())
        }
        .buttonStyle(FlynnPressable())
    }
}

/// Terms of Service / Privacy Policy. The full documents are hosted; this opens
/// them and states plainly what applies, rather than shipping a bare title.
struct LegalView: View {
    enum Kind { case terms, privacy
        var title: String { self == .terms ? "Terms of Service" : "Privacy Policy" }
        var url: URL? { URL(string: self == .terms ? "https://flynnai.app/terms" : "https://flynnai.app/privacy") }
    }
    let kind: Kind
    @Environment(\.openURL) private var openURL

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: FlynnSpacing.lg) {
                Text(kind == .terms
                     ? "By using Flynn you agree to our Terms of Service. They cover your subscription, how calls and messages are handled, and how invoices and payments work."
                     : "Your Privacy Policy explains what Flynn stores — your business details, calls it answers, and the clients and invoices you create — and how that data is used and protected.")
                    .flynnType(FlynnTypography.bodyLarge)
                    .foregroundColor(FlynnColor.textPrimary)
                    .fixedSize(horizontal: false, vertical: true)

                if let url = kind.url {
                    FlynnButton(title: "Read the full \(kind == .terms ? "terms" : "policy")",
                                action: { openURL(url) },
                                variant: .secondary,
                                icon: Image(systemName: "arrow.up.right"))
                }
            }
            .padding(FlynnSpacing.lg)
        }
        .background(FlynnColor.background)
        .navigationTitle(kind.title)
        .navigationBarTitleDisplayMode(.inline)
    }
}
