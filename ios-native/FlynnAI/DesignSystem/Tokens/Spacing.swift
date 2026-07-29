import CoreGraphics

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

/// Corner radii. Rescaled for the mid-century language — the old scale topped
/// out at 16 with a 6pt default, which is what made the app read tight and
/// hard-edged rather than warm. Call sites use the semantic names, so moving
/// the scale moves them.
enum FlynnRadii {
    static let none: CGFloat = 0
    static let xs: CGFloat = 4
    static let sm: CGFloat = 8
    static let md: CGFloat = 12
    static let lg: CGFloat = 16
    static let xl: CGFloat = 20
    static let xxl: CGFloat = 24
    /// Buttons and chips — the chunky cartoon CTA radius.
    static let pill: CGFloat = 30
    static let full: CGFloat = 9999
}

/// Stroke weights. TIER 2 of the design rule: `outline` is the signature ink
/// border, matching the landing page's `border-[3px]`.
enum FlynnStroke {
    /// Dividers and quiet list rows — structure without shouting.
    static let hairline: CGFloat = 1
    /// The signature outline on cards, buttons and inputs.
    static let outline: CGFloat = 3
    /// Focused inputs.
    static let focus: CGFloat = 4
}

enum FlynnLayout {
    static let headerHeight: CGFloat = 60
    static let tabBarHeight: CGFloat = 80
    static let buttonHeight: CGFloat = 58
    static let inputHeight: CGFloat = 56
    static let avatarSizeSmall: CGFloat = 24
    static let avatarSizeMedium: CGFloat = 40
    static let avatarSizeLarge: CGFloat = 64
}
