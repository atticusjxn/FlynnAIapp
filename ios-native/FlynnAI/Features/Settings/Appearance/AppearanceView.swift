import SwiftUI

enum AppTheme: String, CaseIterable, Identifiable, Sendable {
    case system, light, dark

    var id: String { rawValue }

    var title: String {
        switch self {
        case .system: return "Match device"
        case .light: return "Light"
        case .dark: return "Dark"
        }
    }

    var colorScheme: ColorScheme? {
        switch self {
        case .system: return nil
        case .light: return .light
        case .dark: return .dark
        }
    }
}

struct AppearanceView: View {
    @AppStorage("flynn.appTheme") private var themeRaw: String = AppTheme.system.rawValue

    private var theme: AppTheme {
        get { AppTheme(rawValue: themeRaw) ?? .system }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: FlynnSpacing.md) {
                header
                themePicker
            }
            .padding(FlynnSpacing.lg)
        }
        .background(FlynnColor.background)
        .navigationTitle("Appearance")
        .navigationBarTitleDisplayMode(.large)
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: FlynnSpacing.xs) {
            Text("Theme")
                .flynnType(FlynnTypography.overline)
                .foregroundColor(FlynnColor.textTertiary)
            Text("How Flynn looks on your device")
                .flynnType(FlynnTypography.h3)
                .foregroundColor(FlynnColor.textPrimary)
        }
    }

    private var themePicker: some View {
        VStack(spacing: FlynnSpacing.sm) {
            ForEach(AppTheme.allCases) { option in
                Button(action: { themeRaw = option.rawValue }) {
                    HStack {
                        Text(option.title)
                            .flynnType(FlynnTypography.bodyMedium)
                            .foregroundColor(FlynnColor.textPrimary)
                        Spacer()
                        if themeRaw == option.rawValue {
                            Image(systemName: "checkmark.circle.fill")
                                .foregroundColor(FlynnColor.primary)
                        } else {
                            Circle()
                                .stroke(FlynnColor.border, lineWidth: 1.5)
                                .frame(width: 20, height: 20)
                        }
                    }
                    .padding(FlynnSpacing.md)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(
                        RoundedRectangle(cornerRadius: FlynnRadii.md, style: .continuous)
                            .fill(themeRaw == option.rawValue ? FlynnColor.primaryLight : FlynnColor.backgroundSecondary)
                    )
                    .brutalistBorder(
                        cornerRadius: FlynnRadii.md,
                        color: themeRaw == option.rawValue ? FlynnColor.primary : FlynnColor.border,
                        lineWidth: themeRaw == option.rawValue ? 3 : 2
                    )
                }
                .buttonStyle(.plain)
            }
        }
    }
}
