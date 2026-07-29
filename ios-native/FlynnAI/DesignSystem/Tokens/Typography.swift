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
    /// The point size the font was built at. Stored explicitly because SwiftUI's
    /// `Font` doesn't expose its size, and `lineSpacing` math needs it.
    let size: CGFloat
    let lineHeight: CGFloat
    let tracking: CGFloat
    let textCase: Text.Case?

    init(
        name: String,
        size: CGFloat,
        lineHeight: CGFloat,
        tracking: CGFloat = 0,
        textCase: Text.Case? = nil
    ) {
        self.font = .custom(name, size: size)
        self.size = size
        self.lineHeight = lineHeight
        self.tracking = tracking
        self.textCase = textCase
    }
}

enum FlynnTypography {
    // Display
    static let displayLarge = FlynnTextStyle(
        name: FlynnFontName.spaceGroteskBold, size: 48, lineHeight: 56
    )
    static let displayMedium = FlynnTextStyle(
        name: FlynnFontName.spaceGroteskBold, size: 36, lineHeight: 44
    )

    // Headers
    static let h1 = FlynnTextStyle(
        name: FlynnFontName.spaceGroteskBold, size: 30, lineHeight: 36
    )
    static let h2 = FlynnTextStyle(
        name: FlynnFontName.spaceGroteskBold, size: 24, lineHeight: 32
    )
    static let h3 = FlynnTextStyle(
        name: FlynnFontName.spaceGroteskSemiBold, size: 20, lineHeight: 28
    )
    static let h4 = FlynnTextStyle(
        name: FlynnFontName.spaceGroteskSemiBold, size: 18, lineHeight: 24
    )

    // Body
    static let bodyLarge = FlynnTextStyle(
        name: FlynnFontName.interRegular, size: 16, lineHeight: 24
    )
    static let bodyMedium = FlynnTextStyle(
        name: FlynnFontName.interRegular, size: 14, lineHeight: 20
    )
    static let bodySmall = FlynnTextStyle(
        name: FlynnFontName.interRegular, size: 12, lineHeight: 16
    )

    // Specialty
    static let caption = FlynnTextStyle(
        name: FlynnFontName.interMedium, size: 12, lineHeight: 16
    )
    static let label = FlynnTextStyle(
        name: FlynnFontName.interMedium, size: 14, lineHeight: 20
    )
    /// Buttons are sentence case, not uppercase — neither the landing page nor
    /// the mid-century onboarding uses uppercase CTAs, and letterspaced caps
    /// were the last piece of hard brutalist type in the system.
    static let button = FlynnTextStyle(
        name: FlynnFontName.spaceGroteskBold, size: 18, lineHeight: 24
    )
    /// Eyebrow labels stay uppercase — matches the landing page's SectionLabel.
    static let overline = FlynnTextStyle(
        name: FlynnFontName.spaceGroteskBold, size: 11, lineHeight: 16,
        tracking: 0.5, textCase: .uppercase
    )
}

struct FlynnTextStyleModifier: ViewModifier {
    let style: FlynnTextStyle

    func body(content: Content) -> some View {
        content
            .font(style.font)
            .tracking(style.tracking)
            .lineSpacing(max(0, style.lineHeight - style.size))
            .textCase(style.textCase)
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
