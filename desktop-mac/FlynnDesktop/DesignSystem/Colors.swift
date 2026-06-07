import SwiftUI
import AppKit

// MARK: - NSColor hex init

extension NSColor {
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
        self.init(calibratedRed: r, green: g, blue: b, alpha: a)
    }

    static func dynamic(lightHex: String, darkHex: String) -> NSColor {
        NSColor(name: nil) { appearance in
            let isDark = appearance.bestMatch(from: [.aqua, .darkAqua]) == .darkAqua
            return isDark ? NSColor(hex: darkHex) : NSColor(hex: lightHex)
        }
    }
}

extension Color {
    init(nsHex: String) {
        self.init(nsColor: NSColor(hex: nsHex))
    }

    static func dynamic(lightHex: String, darkHex: String) -> Color {
        Color(nsColor: .dynamic(lightHex: lightHex, darkHex: darkHex))
    }
}

// MARK: - Flynn design tokens

enum FlynnColor {
    // Brand — International Orange.
    static let primary = Color(nsHex: "#FF5B1E")
    static let primaryDark = Color(nsHex: "#ea3e00")
    static let primaryLight = Color.dynamic(lightHex: "#ffe4e6", darkHex: "#3a1a11")

    static let secondary = Color(nsHex: "#64748B")
    static let gray50 = Color(nsHex: "#F9FAFB")
    static let gray100 = Color(nsHex: "#F3F4F6")
    static let gray200 = Color(nsHex: "#E5E7EB")
    static let gray300 = Color.dynamic(lightHex: "#D1D5DB", darkHex: "#3F3F46")
    static let gray400 = Color(nsHex: "#9CA3AF")
    static let gray500 = Color(nsHex: "#6B7280")
    static let gray600 = Color(nsHex: "#4B5563")
    static let gray700 = Color(nsHex: "#374151")
    static let gray800 = Color(nsHex: "#1F2937")
    static let gray900 = Color(nsHex: "#111827")

    static let success = Color(nsHex: "#10B981")
    static let successLight = Color.dynamic(lightHex: "#D1FAE5", darkHex: "#0F2E25")
    static let successDark = Color(nsHex: "#047857")

    static let warning = Color(nsHex: "#F59E0B")
    static let warningLight = Color.dynamic(lightHex: "#FEF3C7", darkHex: "#3A2E0E")
    static let warningDark = Color(nsHex: "#D97706")

    static let error = Color(nsHex: "#EF4444")
    static let errorLight = Color.dynamic(lightHex: "#FEE2E2", darkHex: "#3A1819")
    static let errorDark = Color(nsHex: "#DC2626")

    static let white = Color.white
    static let black = Color.black

    static let background = Color.dynamic(lightHex: "#F3F4F6", darkHex: "#0B0B0F")
    static let backgroundSecondary = Color.dynamic(lightHex: "#FFFFFF", darkHex: "#18181D")
    static let backgroundTertiary = Color.dynamic(lightHex: "#E5E7EB", darkHex: "#25252D")

    static let textPrimary = Color.dynamic(lightHex: "#111827", darkHex: "#F9FAFB")
    static let textSecondary = Color.dynamic(lightHex: "#4B5563", darkHex: "#D1D5DB")
    static let textTertiary = Color.dynamic(lightHex: "#9CA3AF", darkHex: "#9CA3AF")
    static let textPlaceholder = Color.dynamic(lightHex: "#9CA3AF", darkHex: "#6B7280")
    static let textInverse = Color.white

    // Brutalist border: solid black in light, solid white in dark
    static let border = Color.dynamic(lightHex: "#000000", darkHex: "#F9FAFB")
    static let borderFocus = Color(nsHex: "#FF5B1E")
    static let borderError = Color(nsHex: "#EF4444")

    // Mascot cream: the warm card/popup background
    static let mascotOrange = Color(nsHex: "#FB5B1E")
    static let cream = Color.dynamic(lightHex: "#F4E6CE", darkHex: "#2A2620")
    static let creamCard = Color.dynamic(lightHex: "#FFFBF4", darkHex: "#1E1C18")

    static let splashBackground = Color.dynamic(lightHex: "#FFFFFF", darkHex: "#0B0B0F")
    static let splashLogoBody = Color.dynamic(lightHex: "#2E2F30", darkHex: "#F9FAFB")
    static let splashLogoDot = Color(nsHex: "#FE5A12")
}

// MARK: - Spacing

enum FlynnSpacing {
    static let xxxs: CGFloat = 2
    static let xxs: CGFloat = 4
    static let xs: CGFloat = 8
    static let sm: CGFloat = 12
    static let md: CGFloat = 16
    static let lg: CGFloat = 24
    static let xl: CGFloat = 32
    static let xxl: CGFloat = 48
    static let xxxl: CGFloat = 64
}
