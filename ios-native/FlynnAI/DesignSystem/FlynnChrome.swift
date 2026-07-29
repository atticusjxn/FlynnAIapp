import SwiftUI
import UIKit

/// Themes the UIKit-backed chrome that SwiftUI renders with system defaults —
/// the tab bar and the navigation bars.
///
/// Without this, `TabView` and every `.navigationTitle` render as stock iOS:
/// SF Pro on system white, sitting directly above cream content. That single
/// inconsistency is what made the app read as "default iOS with a themed middle"
/// no matter how well the content below was styled.
///
/// Call once from `FlynnAIApp.init()`.
enum FlynnChrome {
    static func apply() {
        applyTabBar()
        applyNavigationBar()
    }

    private static func applyTabBar() {
        let appearance = UITabBarAppearance()
        appearance.configureWithOpaqueBackground()
        appearance.backgroundColor = UIColor.dynamic(lightHex: "#FFFBF4", darkHex: "#26201A")
        // The ink hairline that separates the bar from the cream page.
        appearance.shadowColor = UIColor.dynamic(lightHex: "#2C2018", darkHex: "#F7F0E4")

        for item in [appearance.stackedLayoutAppearance,
                     appearance.inlineLayoutAppearance,
                     appearance.compactInlineLayoutAppearance] {
            item.selected.iconColor = UIColor(hex: "#FB5B1E")
            item.normal.iconColor = UIColor.dynamic(lightHex: "#8C7B6A", darkHex: "#A2937F")

            item.selected.titleTextAttributes = [
                .foregroundColor: UIColor(hex: "#FB5B1E"),
                .font: chromeFont(FlynnFontName.spaceGroteskBold, size: 10)
            ]
            item.normal.titleTextAttributes = [
                .foregroundColor: UIColor.dynamic(lightHex: "#8C7B6A", darkHex: "#A2937F"),
                .font: chromeFont(FlynnFontName.interMedium, size: 10)
            ]
        }

        UITabBar.appearance().standardAppearance = appearance
        UITabBar.appearance().scrollEdgeAppearance = appearance
    }

    private static func applyNavigationBar() {
        let appearance = UINavigationBarAppearance()
        appearance.configureWithOpaqueBackground()
        // Nav bars sit on the cream ground, not on white.
        appearance.backgroundColor = UIColor.dynamic(lightHex: "#F4E6CE", darkHex: "#1C1611")
        appearance.shadowColor = .clear

        let ink = UIColor.dynamic(lightHex: "#2C2018", darkHex: "#F7F0E4")
        appearance.titleTextAttributes = [
            .foregroundColor: ink,
            .font: chromeFont(FlynnFontName.spaceGroteskSemiBold, size: 18)
        ]
        appearance.largeTitleTextAttributes = [
            .foregroundColor: ink,
            .font: chromeFont(FlynnFontName.spaceGroteskBold, size: 30)
        ]

        UINavigationBar.appearance().standardAppearance = appearance
        UINavigationBar.appearance().compactAppearance = appearance
        UINavigationBar.appearance().scrollEdgeAppearance = appearance
        UINavigationBar.appearance().tintColor = UIColor(hex: "#FB5B1E")
    }

    /// Falls back to the system font if the custom face didn't register — a
    /// missing font here would otherwise crash `UIFont(name:size:)!`.
    private static func chromeFont(_ name: String, size: CGFloat) -> UIFont {
        UIFont(name: name, size: size) ?? .systemFont(ofSize: size, weight: .semibold)
    }
}
