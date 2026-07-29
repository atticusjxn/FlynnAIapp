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

// MARK: - Flynn palette (mid-century: cream ground, ink outline, one orange)
//
// TIER 1 of the Flynn design rule — the *ground*. This is the brand, and it is
// shared verbatim with the landing page (flynn-ai-new-landingpage) and /brand
// assets so the ad → web → App Store → app path reads as one product.
//
//   ground     cream  #F4E6CE
//   ink        text + the signature outline  #2C2018
//   orange     #FB5B1E  — the ONLY orange. Do not introduce another.
//
// Dark mode is a *warm* dark (deep brown), not a cool black — the palette has
// no cool tones in it anywhere, and a slate-black dark mode broke that.
enum FlynnColor {
    // Brand — one orange, constant in both modes. Previously this was split
    // across #ff4500 (primary), #FB5B1E (mascot/landing/brand) and #FE5A12
    // (splash); they are now collapsed onto the brand value.
    static let primary = Color(hex: "#FB5B1E")
    static let primaryDark = Color(hex: "#D94A12")
    static let primaryLight = Color.dynamic(light: "#FFE8DC", dark: "#3A1F14")

    // Mid-century accent set — promoted from the onboarding-local `OB` palette
    // so status, category and illustration tinting can use them app-wide.
    static let mustard = Color(hex: "#E0A436")
    static let teal = Color(hex: "#3C8A86")
    static let terra = Color(hex: "#C5532B")
    static let olive = Color(hex: "#7E8B4F")

    // Neutrals — a WARM ramp (cream → ink), not the old cool slate. Dozens of
    // views reference these stops directly; re-pointing the ramp harmonises all
    // of them with the cream ground without touching those files.
    static let secondary = Color(hex: "#8C7B6A")
    static let gray50 = Color.dynamic(light: "#FDFAF3", dark: "#211A14")
    static let gray100 = Color.dynamic(light: "#F7F0E2", dark: "#26201A")
    static let gray200 = Color.dynamic(light: "#ECE0C8", dark: "#322A22")
    static let gray300 = Color.dynamic(light: "#DCCDB2", dark: "#3E352B")
    static let gray400 = Color.dynamic(light: "#A2937F", dark: "#6E6152")
    static let gray500 = Color.dynamic(light: "#8C7B6A", dark: "#A2937F")
    static let gray600 = Color.dynamic(light: "#5A4A3C", dark: "#C4B49F")
    static let gray700 = Color.dynamic(light: "#493B2F", dark: "#D6C9B6")
    static let gray800 = Color.dynamic(light: "#3A2E24", dark: "#E9DFCE")
    static let gray900 = Color.dynamic(light: "#2C2018", dark: "#F7F0E4")

    // Semantic — re-toned onto the mid-century accents so status colour belongs
    // to the palette instead of reading as generic framework green/amber/red.
    static let success = Color(hex: "#3C8A86")
    static let successLight = Color.dynamic(light: "#D9EDEB", dark: "#12302E")
    static let successDark = Color(hex: "#2A6664")

    static let warning = Color(hex: "#E0A436")
    static let warningLight = Color.dynamic(light: "#FAEDD2", dark: "#3A2E12")
    static let warningDark = Color(hex: "#A97722")

    static let error = Color(hex: "#C5532B")
    static let errorLight = Color.dynamic(light: "#F7DDD3", dark: "#3A1D12")
    static let errorDark = Color(hex: "#963C1D")

    // UI — these are literal colors, not semantic. Use `textInverse` when
    // you want "text on a colored chip" (stays cream regardless of mode).
    static let white = Color.white
    static let black = Color.black

    // Semantic backgrounds — cream ground, off-white card. Flip warm for dark.
    static let background = Color.dynamic(light: "#F4E6CE", dark: "#1C1611")
    static let backgroundSecondary = Color.dynamic(light: "#FFFBF4", dark: "#26201A")
    static let backgroundTertiary = Color.dynamic(light: "#ECE0C8", dark: "#322A22")

    // Semantic text — ink browns, not near-black greys.
    static let textPrimary = Color.dynamic(light: "#2C2018", dark: "#F7F0E4")
    static let textSecondary = Color.dynamic(light: "#5A4A3C", dark: "#D6C9B6")
    static let textTertiary = Color.dynamic(light: "#8C7B6A", dark: "#A2937F")
    static let textPlaceholder = Color.dynamic(light: "#8C7B6A", dark: "#8C7B6A")
    static let textInverse = Color(hex: "#FFFBF4")

    // Borders — TIER 2, the signature 3pt ink outline. NEVER literal black:
    // a hardcoded .black here is what made every card lose its border on the
    // dark background.
    static let border = Color.dynamic(light: "#2C2018", dark: "#F7F0E4")
    static let borderSubtle = Color.dynamic(light: "#DCCDB2", dark: "#3E352B")
    static let borderFocus = Color(hex: "#FB5B1E")
    static let borderError = Color(hex: "#C5532B")

    // Mascot — Flynn the chat-bubble character. `cream` is now the app ground,
    // so this is an alias kept for existing call sites.
    static let cream = background

    @available(*, deprecated, message: "Use FlynnColor.primary — Flynn has one orange (#FB5B1E).")
    static let mascotOrange = primary

    // Splash — cream field, ink wordmark, orange dot.
    static let splashBackground = background
    static let splashLogoBody = textPrimary
    static let splashLogoDot = primary
}
