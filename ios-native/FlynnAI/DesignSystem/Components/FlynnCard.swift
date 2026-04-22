import SwiftUI

struct FlynnCard<Content: View>: View {
    var padding: CGFloat = FlynnSpacing.md
    var shadow: BrutalistShadowSize = .md
    var cornerRadius: CGFloat = FlynnRadii.lg
    let content: Content

    init(
        padding: CGFloat = FlynnSpacing.md,
        shadow: BrutalistShadowSize = .md,
        cornerRadius: CGFloat = FlynnRadii.lg,
        @ViewBuilder content: () -> Content
    ) {
        self.padding = padding
        self.shadow = shadow
        self.cornerRadius = cornerRadius
        self.content = content()
    }

    var body: some View {
        content
            .padding(padding)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                    .fill(FlynnColor.backgroundSecondary)
            )
            .brutalistBorder(cornerRadius: cornerRadius)
            .brutalistShadow(shadow, cornerRadius: cornerRadius)
    }
}

#Preview {
    VStack(spacing: FlynnSpacing.md) {
        FlynnCard {
            VStack(alignment: .leading, spacing: FlynnSpacing.xs) {
                Text("Roof repair")
                    .flynnType(FlynnTypography.h3)
                Text("Jane Doe • Tuesday, 2:00pm")
                    .flynnType(FlynnTypography.bodyMedium)
                    .foregroundColor(FlynnColor.textSecondary)
            }
        }
        FlynnCard(shadow: .sm) {
            Text("Smaller shadow card")
                .flynnType(FlynnTypography.bodyLarge)
        }
    }
    .padding(FlynnSpacing.lg)
    .background(FlynnColor.background)
}
