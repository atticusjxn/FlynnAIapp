import SwiftUI

// MARK: - List / Form surface
//
// SwiftUI's `List` and `Form` paint their own background (systemGroupedBackground)
// and their own row fills (systemBackground). Left alone, a themed screen ends up
// as stock iOS grey-on-white sitting inside the cream app — which is exactly how
// Settings, Brain and the Money editors used to read.
//
// This puts them on the cream ground with off-white rows, so a Form looks like the
// rest of Flynn without every screen having to restate it.

extension View {
    /// Applies the Flynn ground, row fill and warm greys to a `List` or `Form`.
    ///
    /// `listRowBackground` propagates down to every row through the list-row
    /// environment, so it only needs to be stated once here rather than on each
    /// row in each screen.
    ///
    /// Separators are retinted here because iOS's neutral grey hairline reads as
    /// *dirty* rather than muted against a warm cream ground.
    ///
    /// Section headers and disclosure chevrons still use iOS's own greys. The
    /// obvious fix — `.foregroundStyle(primary, secondary, tertiary)` on the
    /// list — is too blunt: it also captures the row icons, which then lose
    /// their brand orange. Headers need retinting at the `Section` header call
    /// site instead. Left as-is for now rather than shipping ink-grey icons.
    func flynnListSurface(rowFill: Color = FlynnColor.backgroundSecondary) -> some View {
        self
            .scrollContentBackground(.hidden)
            .background(FlynnColor.background)
            .listRowBackground(rowFill)
            .listRowSeparatorTint(FlynnColor.borderSubtle)
    }
}
