import SwiftUI
import UIKit

extension Color {
    init(hex: String) {
        self = Color(uiColor: UIColor(hex: hex))
    }

    /// Resolves to `light` in light mode and `dark` in dark mode by asking the
    /// current trait collection on every resolve. Use via `FlynnColor.*` tokens —
    /// do not call at view-body level as it creates a new UIColor each call.
    static func dynamic(light: String, dark: String) -> Color {
        Color(uiColor: UIColor.dynamic(lightHex: light, darkHex: dark))
    }
}

extension UIColor {
    convenience init(hex: String) {
        let sanitized = hex.trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: "#", with: "")
        var rgb: UInt64 = 0
        Scanner(string: sanitized).scanHexInt64(&rgb)
        let r, g, b, a: CGFloat
        switch sanitized.count {
        case 6:
            r = CGFloat((rgb & 0xFF0000) >> 16) / 255
            g = CGFloat((rgb & 0x00FF00) >> 8) / 255
            b = CGFloat(rgb & 0x0000FF) / 255
            a = 1
        case 8:
            r = CGFloat((rgb & 0xFF000000) >> 24) / 255
            g = CGFloat((rgb & 0x00FF0000) >> 16) / 255
            b = CGFloat((rgb & 0x0000FF00) >> 8) / 255
            a = CGFloat(rgb & 0x000000FF) / 255
        default:
            r = 0; g = 0; b = 0; a = 1
        }
        self.init(red: r, green: g, blue: b, alpha: a)
    }

    static func dynamic(lightHex: String, darkHex: String) -> UIColor {
        let light = UIColor(hex: lightHex)
        let dark = UIColor(hex: darkHex)
        return UIColor { traits in
            traits.userInterfaceStyle == .dark ? dark : light
        }
    }
}

enum FlynnColor {
    // Brand — International Orange. Constant in both modes.
    static let primary = Color(hex: "#ff4500")
    static let primaryDark = Color(hex: "#ea3e00")
    static let primaryLight = Color.dynamic(light: "#ffe4e6", dark: "#3a1a11")

    // Neutrals — kept as plain hex since they're used as explicit stops,
    // not semantic tokens. Use the semantic tokens below for anything
    // the eye is meant to read as "background" / "text" / etc.
    static let secondary = Color(hex: "#64748B")
    static let gray50 = Color(hex: "#F9FAFB")
    static let gray100 = Color(hex: "#F3F4F6")
    static let gray200 = Color(hex: "#E5E7EB")
    static let gray300 = Color.dynamic(light: "#D1D5DB", dark: "#3F3F46")
    static let gray400 = Color(hex: "#9CA3AF")
    static let gray500 = Color(hex: "#6B7280")
    static let gray600 = Color(hex: "#4B5563")
    static let gray700 = Color(hex: "#374151")
    static let gray800 = Color(hex: "#1F2937")
    static let gray900 = Color(hex: "#111827")

    // Semantic — brand-tinted semantic colors stay vivid in dark mode.
    static let success = Color(hex: "#10B981")
    static let successLight = Color.dynamic(light: "#D1FAE5", dark: "#0F2E25")
    static let successDark = Color(hex: "#047857")

    static let warning = Color(hex: "#F59E0B")
    static let warningLight = Color.dynamic(light: "#FEF3C7", dark: "#3A2E0E")
    static let warningDark = Color(hex: "#D97706")

    static let error = Color(hex: "#EF4444")
    static let errorLight = Color.dynamic(light: "#FEE2E2", dark: "#3A1819")
    static let errorDark = Color(hex: "#DC2626")

    // UI — these are literal colors, not semantic. Use `textInverse` when
    // you want "text on a colored chip" (stays white regardless of mode).
    static let white = Color.white
    static let black = Color.black

    // Semantic backgrounds — flip for dark mode.
    static let background = Color.dynamic(light: "#F3F4F6", dark: "#0B0B0F")
    static let backgroundSecondary = Color.dynamic(light: "#FFFFFF", dark: "#18181D")
    static let backgroundTertiary = Color.dynamic(light: "#E5E7EB", dark: "#25252D")

    // Semantic text — flip for dark mode.
    static let textPrimary = Color.dynamic(light: "#111827", dark: "#F9FAFB")
    static let textSecondary = Color.dynamic(light: "#4B5563", dark: "#D1D5DB")
    static let textTertiary = Color.dynamic(light: "#9CA3AF", dark: "#9CA3AF")
    static let textPlaceholder = Color.dynamic(light: "#9CA3AF", dark: "#6B7280")
    static let textInverse = Color.white

    // Borders — the signature 2pt brutalist border becomes a light stroke in dark mode.
    static let border = Color.dynamic(light: "#000000", dark: "#F9FAFB")
    static let borderFocus = Color(hex: "#ff4500")
    static let borderError = Color(hex: "#EF4444")

    // Splash — swap the mascot so it stays legible on the dark background.
    static let splashBackground = Color.dynamic(light: "#FFFFFF", dark: "#0B0B0F")
    static let splashLogoBody = Color.dynamic(light: "#2E2F30", dark: "#F9FAFB")
    static let splashLogoDot = Color(hex: "#FE5A12")
}
