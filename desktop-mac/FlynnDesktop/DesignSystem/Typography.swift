import SwiftUI

// Flynn uses SpaceGrotesk (headers) + Inter (body) when available.
// On macOS these fonts must be bundled in Resources/Fonts/ and listed in Info.plist
// under ATSApplicationFontsPath (or CFBundleFonts). Falls back to system SF Pro.

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

private func spaceGrotesk(size: CGFloat, weight: Font.Weight = .bold) -> Font {
    let name = weight == .bold ? FlynnFontName.spaceGroteskBold : FlynnFontName.spaceGroteskSemiBold
    return Font.custom(name, size: size).weight(weight)
}

private func inter(size: CGFloat, weight: Font.Weight = .regular) -> Font {
    let name = weight == .medium ? FlynnFontName.interMedium : FlynnFontName.interRegular
    return Font.custom(name, size: size)
}

enum FlynnTypography {
    static let displayLarge = FlynnTextStyle(font: spaceGrotesk(size: 48), lineHeight: 56)
    static let displayMedium = FlynnTextStyle(font: spaceGrotesk(size: 36), lineHeight: 44)

    static let h1 = FlynnTextStyle(font: spaceGrotesk(size: 30), lineHeight: 36)
    static let h2 = FlynnTextStyle(font: spaceGrotesk(size: 24), lineHeight: 32)
    static let h3 = FlynnTextStyle(font: spaceGrotesk(size: 20, weight: .semibold), lineHeight: 28)
    static let h4 = FlynnTextStyle(font: spaceGrotesk(size: 18, weight: .semibold), lineHeight: 24)

    static let bodyLarge  = FlynnTextStyle(font: inter(size: 16), lineHeight: 24)
    static let bodyMedium = FlynnTextStyle(font: inter(size: 14), lineHeight: 20)
    static let bodySmall  = FlynnTextStyle(font: inter(size: 12), lineHeight: 16)

    static let caption  = FlynnTextStyle(font: inter(size: 12, weight: .medium), lineHeight: 16)
    static let label    = FlynnTextStyle(font: inter(size: 14, weight: .medium), lineHeight: 20)
    static let button   = FlynnTextStyle(font: spaceGrotesk(size: 16), lineHeight: 24, tracking: 1, textCase: .uppercase)
    static let overline = FlynnTextStyle(font: spaceGrotesk(size: 11), lineHeight: 16, tracking: 0.5, textCase: .uppercase)
}

struct FlynnTextStyleModifier: ViewModifier {
    let style: FlynnTextStyle

    func body(content: Content) -> some View {
        content
            .font(style.font)
            .tracking(style.tracking)
            .lineSpacing(max(0, style.lineHeight - estimatedFontSize))
            .textCase(style.textCase)
    }

    private var estimatedFontSize: CGFloat {
        switch style.lineHeight {
        case 56: return 48; case 44: return 36; case 36: return 30
        case 32: return 24; case 28: return 20; case 24: return 16
        case 20: return 14; case 16: return 12
        default: return style.lineHeight * 0.7
        }
    }
}

extension View {
    func flynnType(_ style: FlynnTextStyle) -> some View {
        modifier(FlynnTextStyleModifier(style: style))
    }
}
