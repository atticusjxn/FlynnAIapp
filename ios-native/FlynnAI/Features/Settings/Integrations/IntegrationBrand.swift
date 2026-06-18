import SwiftUI

/// Brand metadata for an integration Flynn can connect to. Drives the Connected
/// tab so every row shows the real product logo (bundled SVG in the asset catalog
/// under the "Integrations" namespace) rather than a generic SF Symbol — third-party
/// brands get their actual logo; Flynn's own surfaces and Apple-native ones use a
/// system glyph by design.
struct IntegrationBrand: Identifiable, Equatable {
    let id: String
    let name: String
    /// Asset-catalog name of a bundled full-colour logo, e.g. "Integrations/logo-xero".
    /// nil → render the SF Symbol fallback in the brand tint.
    let logoAsset: String?
    /// SF Symbol used when there's no bundled logo (Apple-native + Flynn-own surfaces,
    /// or integrations whose logo isn't bundled yet).
    let systemSymbol: String
    /// Brand colour — used for the fallback glyph and subtle accents.
    let tint: Color

    static let googleCalendar = IntegrationBrand(
        id: "google_calendar", name: "Google Calendar",
        logoAsset: "Integrations/logo-google-calendar", systemSymbol: "calendar", tint: Color(hex: "4285F4"))

    static let appleCalendar = IntegrationBrand(
        id: "apple_calendar", name: "Apple Calendar",
        logoAsset: nil, systemSymbol: "calendar", tint: Color(hex: "FF3B30"))

    static let xero = IntegrationBrand(
        id: "xero", name: "Xero",
        logoAsset: "Integrations/logo-xero", systemSymbol: "doc.text", tint: Color(hex: "13B5EA"))

    static let gmail = IntegrationBrand(
        id: "gmail", name: "Gmail",
        logoAsset: "Integrations/logo-gmail", systemSymbol: "envelope", tint: Color(hex: "EA4335"))

    static let flynnKeyboard = IntegrationBrand(
        id: "flynn_keyboard", name: "Flynn Keyboard",
        logoAsset: nil, systemSymbol: "keyboard", tint: FlynnColor.primary)
}

/// A clean white tile with the brand's real logo inset (or a tinted SF Symbol
/// fallback). The standard "connect with X" look.
struct IntegrationLogoView: View {
    let brand: IntegrationBrand
    var size: CGFloat = 44

    var body: some View {
        RoundedRectangle(cornerRadius: size * 0.24, style: .continuous)
            .fill(FlynnColor.white)
            .overlay(
                RoundedRectangle(cornerRadius: size * 0.24, style: .continuous)
                    .stroke(FlynnColor.border, lineWidth: 1)
            )
            .overlay(logo)
            .frame(width: size, height: size)
    }

    @ViewBuilder
    private var logo: some View {
        if let asset = brand.logoAsset {
            Image(asset)
                .resizable()
                .scaledToFit()
                .padding(size * 0.2)
        } else {
            Image(systemName: brand.systemSymbol)
                .font(.system(size: size * 0.44, weight: .semibold))
                .foregroundColor(brand.tint)
        }
    }
}
