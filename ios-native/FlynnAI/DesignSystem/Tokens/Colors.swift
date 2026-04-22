import SwiftUI

extension Color {
    init(hex: String) {
        let sanitized = hex.trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: "#", with: "")
        var rgb: UInt64 = 0
        Scanner(string: sanitized).scanHexInt64(&rgb)
        let r, g, b, a: Double
        switch sanitized.count {
        case 6:
            r = Double((rgb & 0xFF0000) >> 16) / 255
            g = Double((rgb & 0x00FF00) >> 8) / 255
            b = Double(rgb & 0x0000FF) / 255
            a = 1
        case 8:
            r = Double((rgb & 0xFF000000) >> 24) / 255
            g = Double((rgb & 0x00FF0000) >> 16) / 255
            b = Double((rgb & 0x0000FF00) >> 8) / 255
            a = Double(rgb & 0x000000FF) / 255
        default:
            r = 0; g = 0; b = 0; a = 1
        }
        self = Color(.sRGB, red: r, green: g, blue: b, opacity: a)
    }
}

enum FlynnColor {
    // Brand — International Orange
    static let primary = Color(hex: "#ff4500")
    static let primaryDark = Color(hex: "#ea3e00")
    static let primaryLight = Color(hex: "#ffe4e6")

    // Neutrals
    static let secondary = Color(hex: "#64748B")
    static let gray50 = Color(hex: "#F9FAFB")
    static let gray100 = Color(hex: "#F3F4F6")
    static let gray200 = Color(hex: "#E5E7EB")
    static let gray300 = Color(hex: "#D1D5DB")
    static let gray400 = Color(hex: "#9CA3AF")
    static let gray500 = Color(hex: "#6B7280")
    static let gray600 = Color(hex: "#4B5563")
    static let gray700 = Color(hex: "#374151")
    static let gray800 = Color(hex: "#1F2937")
    static let gray900 = Color(hex: "#111827")

    // Semantic
    static let success = Color(hex: "#10B981")
    static let successLight = Color(hex: "#D1FAE5")
    static let successDark = Color(hex: "#047857")

    static let warning = Color(hex: "#F59E0B")
    static let warningLight = Color(hex: "#FEF3C7")
    static let warningDark = Color(hex: "#D97706")

    static let error = Color(hex: "#EF4444")
    static let errorLight = Color(hex: "#FEE2E2")
    static let errorDark = Color(hex: "#DC2626")

    // UI
    static let white = Color.white
    static let black = Color.black

    // Backgrounds
    static let background = Color(hex: "#F3F4F6")
    static let backgroundSecondary = Color.white
    static let backgroundTertiary = Color(hex: "#E5E7EB")

    // Text
    static let textPrimary = Color(hex: "#111827")
    static let textSecondary = Color(hex: "#4B5563")
    static let textTertiary = Color(hex: "#9CA3AF")
    static let textPlaceholder = Color(hex: "#9CA3AF")
    static let textInverse = Color.white

    // Borders — the signature 2pt black brutalist border
    static let border = Color.black
    static let borderFocus = Color(hex: "#ff4500")
    static let borderError = Color(hex: "#EF4444")

    // Splash-specific (from AnimatedSplashScreen.tsx)
    static let splashBackground = Color.white
    static let splashLogoBody = Color(hex: "#2E2F30")
    static let splashLogoDot = Color(hex: "#FE5A12")
}
