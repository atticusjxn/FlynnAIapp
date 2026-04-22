import SwiftUI

// PostScript names — must match the .ttf files registered in Info.plist UIAppFonts.
enum FlynnFontName {
    static let spaceGroteskBold = "SpaceGrotesk-Bold"
    static let spaceGroteskSemiBold = "SpaceGrotesk-SemiBold"
    static let interRegular = "Inter-Regular"
    static let interMedium = "Inter-Medium"
}

struct FlynnTextStyle {
    let font: Font
    let lineHeight: CGFloat
    let tracking: CGFloat
    let textCase: Text.Case?

    init(font: Font, lineHeight: CGFloat, tracking: CGFloat = 0, textCase: Text.Case? = nil) {
        self.font = font
        self.lineHeight = lineHeight
        self.tracking = tracking
        self.textCase = textCase
    }
}

enum FlynnTypography {
    // Display
    static let displayLarge = FlynnTextStyle(
        font: .custom(FlynnFontName.spaceGroteskBold, size: 48),
        lineHeight: 56
    )
    static let displayMedium = FlynnTextStyle(
        font: .custom(FlynnFontName.spaceGroteskBold, size: 36),
        lineHeight: 44
    )

    // Headers
    static let h1 = FlynnTextStyle(
        font: .custom(FlynnFontName.spaceGroteskBold, size: 30),
        lineHeight: 36
    )
    static let h2 = FlynnTextStyle(
        font: .custom(FlynnFontName.spaceGroteskBold, size: 24),
        lineHeight: 32
    )
    static let h3 = FlynnTextStyle(
        font: .custom(FlynnFontName.spaceGroteskSemiBold, size: 20),
        lineHeight: 28
    )
    static let h4 = FlynnTextStyle(
        font: .custom(FlynnFontName.spaceGroteskSemiBold, size: 18),
        lineHeight: 24
    )

    // Body
    static let bodyLarge = FlynnTextStyle(
        font: .custom(FlynnFontName.interRegular, size: 16),
        lineHeight: 24
    )
    static let bodyMedium = FlynnTextStyle(
        font: .custom(FlynnFontName.interRegular, size: 14),
        lineHeight: 20
    )
    static let bodySmall = FlynnTextStyle(
        font: .custom(FlynnFontName.interRegular, size: 12),
        lineHeight: 16
    )

    // Specialty
    static let caption = FlynnTextStyle(
        font: .custom(FlynnFontName.interMedium, size: 12),
        lineHeight: 16
    )
    static let label = FlynnTextStyle(
        font: .custom(FlynnFontName.interMedium, size: 14),
        lineHeight: 20
    )
    static let button = FlynnTextStyle(
        font: .custom(FlynnFontName.spaceGroteskBold, size: 16),
        lineHeight: 24,
        tracking: 1,
        textCase: .uppercase
    )
    static let overline = FlynnTextStyle(
        font: .custom(FlynnFontName.spaceGroteskBold, size: 11),
        lineHeight: 16,
        tracking: 0.5,
        textCase: .uppercase
    )
}

struct FlynnTextStyleModifier: ViewModifier {
    let style: FlynnTextStyle

    func body(content: Content) -> some View {
        content
            .font(style.font)
            .tracking(style.tracking)
            .lineSpacing(max(0, style.lineHeight - uiFontSize(for: style)))
            .textCase(style.textCase)
    }

    // Approximates base size for lineSpacing math. SwiftUI's .font(.custom) doesn't
    // expose size directly from Font, so we rely on the token definition.
    private func uiFontSize(for style: FlynnTextStyle) -> CGFloat {
        switch style.lineHeight {
        case 56: return 48
        case 44: return 36
        case 36: return 30
        case 32: return 24
        case 28: return 20
        case 24: return 16
        case 20: return 14
        case 16: return 12
        default: return style.lineHeight * 0.7
        }
    }
}

extension View {
    func flynnType(_ style: FlynnTextStyle) -> some View {
        modifier(FlynnTextStyleModifier(style: style))
    }
}

#if DEBUG
enum FlynnFontDebug {
    /// Prints available PostScript names at launch when fonts don't render.
    /// Call once from FlynnAIApp.init() in DEBUG only.
    static func logAvailable() {
        let expected = [
            FlynnFontName.spaceGroteskBold,
            FlynnFontName.spaceGroteskSemiBold,
            FlynnFontName.interRegular,
            FlynnFontName.interMedium
        ]
        for name in expected {
            if UIFont(name: name, size: 12) == nil {
                print("⚠️ [FlynnFont] Missing: \(name) — check Resources/Fonts/ and Info.plist UIAppFonts")
            }
        }
    }
}
#endif
