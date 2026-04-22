# FlynnAI — Native iOS (SwiftUI)

This is the SwiftUI rewrite of FlynnAI targeting **iOS 26+** with Liquid Glass chrome and a brutalist orange content layer. It lives alongside the React Native project (`/ios/` is still the RN Expo build, used for Android). This directory builds a separate Xcode project that will eventually replace the RN iOS app.

**Phase 1 scope** (what's here):
- Design system tokens + 4 brutalist components (FlynnButton, FlynnCard, FlynnTextField, FlynnBadge)
- Liquid Glass tab bar with per-tab NavigationStack + deep linking
- Animated splash (F logo stroke-draw + fill + zoom-out, matches the RN version)
- Supabase auth (email/password, OTP, signup) with Keychain-backed session persistence
- Dashboard (recent events) + Events list + EventDetail, read-only

Everything else — remaining 31 screens, Deepgram voice agent, Stripe, push, calendar, camera, and the migration cutover — is planned in later phases.

## First-time setup

Prerequisites:
- macOS with Xcode 26+
- [Homebrew](https://brew.sh)

```bash
# 1. Install xcodegen (generates the Xcode project from project.yml)
brew install xcodegen

# 2. Copy fonts from the RN project's node_modules
cd /Users/atticus/FlynnAIapp
npm install          # if not already
cp node_modules/@expo-google-fonts/inter/400Regular/Inter_400Regular.ttf \
   ios-native/FlynnAI/Resources/Fonts/Inter-Regular.ttf
cp node_modules/@expo-google-fonts/inter/500Medium/Inter_500Medium.ttf \
   ios-native/FlynnAI/Resources/Fonts/Inter-Medium.ttf
cp node_modules/@expo-google-fonts/space-grotesk/600SemiBold/SpaceGrotesk_600SemiBold.ttf \
   ios-native/FlynnAI/Resources/Fonts/SpaceGrotesk-SemiBold.ttf
cp node_modules/@expo-google-fonts/space-grotesk/700Bold/SpaceGrotesk_700Bold.ttf \
   ios-native/FlynnAI/Resources/Fonts/SpaceGrotesk-Bold.ttf

# 3. Set up secrets
cd ios-native/FlynnAI/Config
cp Secrets.local.xcconfig.example Secrets.local.xcconfig
# Open Secrets.local.xcconfig and paste the Supabase anon key (copy from
# /Users/atticus/FlynnAIapp/app.config.js -> extra.supabaseAnonKey)

# 4. Generate the Xcode project
cd /Users/atticus/FlynnAIapp/ios-native
xcodegen

# 5. Open and run
open FlynnAI.xcodeproj
```

In Xcode:
- Select the `FlynnAI` scheme and an iPhone 17 / iOS 26.x simulator
- `Cmd+R` to build and run

## Regenerating the project

Whenever `project.yml` changes (new targets, new SPM deps, new Info.plist keys), regenerate:

```bash
cd /Users/atticus/FlynnAIapp/ios-native && xcodegen
```

The `.xcodeproj` is gitignored — the source of truth is `project.yml` + the Swift files under `FlynnAI/`.

## Project layout

```
FlynnAI/
  App/                FlynnAIApp.swift, RootView.swift, MainTabView.swift
  DesignSystem/
    Tokens/           Colors.swift, Typography.swift, Spacing.swift, Shadows.swift
    Components/       FlynnButton, FlynnCard, FlynnTextField, FlynnBadge
  Features/
    Splash/           AnimatedSplashView.swift, FLogoPaths.swift
    Auth/             AuthStore.swift, LoginView.swift
    Dashboard/        DashboardStore.swift, DashboardView.swift
    Events/           EventsListView.swift, EventDetailView.swift, EventRow.swift
    (Calls, Clients, Money, Settings — placeholders until later phases)
  Navigation/         Route.swift, DeepLinkRouter.swift
  Networking/
    Supabase/         SupabaseClient+Flynn.swift, EventsRepository.swift
    DTOs/             EventDTO.swift
  Core/               Environment.swift, Keychain.swift, Logger.swift
  Resources/
    Fonts/            (TTF files go here — see Fonts/README.md)
    Assets.xcassets/  AccentColor, AppIcon
  Config/             xcconfig files — Secrets.local.xcconfig is gitignored
```

## Design system at a glance

- **Colors** ported verbatim from `src/theme/index.ts`. `FlynnColor.primary = #ff4500`.
- **Fonts** are Space Grotesk (headings / button / overline) and Inter (body). Use the `.flynnType(FlynnTypography.h2)` modifier rather than applying `.font()` directly.
- **Shadows** are hard-offset solid black blocks (not Gaussian). Apply with `.brutalistShadow(.md)` and `.brutalistBorder()`.
- **Liquid Glass** is used for floating chrome only (tab bar, future FABs, sheet grabbers). Content surfaces (cards, form inputs, list rows) stay brutalist-solid. The contrast is intentional.

## Verification — 12-step smoke test

Run through these after any major change:

1. Open `ios-native/FlynnAI.xcodeproj` in Xcode 26
2. Run on iPhone 17 / iOS 26.x simulator (`Cmd+R`)
3. Splash: white background, orange dot + dark-grey F stroke-draws over ~2s, fills, scale+fades out
4. No stored session → `LoginView` appears. Log in with `atticusjxn@gmail.com` + existing Supabase password
5. Lands on `MainTabView`. Tab bar refracts content as you scroll (Liquid Glass)
6. Dashboard loads recent events from Supabase
7. Tap Events tab → list of events. Tap one → `EventDetailView` pushes
8. Back button pops. Switch tabs — each tab preserves its stack independently
9. Background the app. From a terminal: `xcrun simctl openurl booted flynnai://events/<real-event-uuid>` → foregrounds to Events tab with detail pushed
10. Simulator Settings → Accessibility → Reduce Transparency ON → tab bar becomes solid; brutalist content unchanged
11. Kill + relaunch → splash plays, session restored from Keychain, lands on Dashboard without re-login
12. Sign out from a placeholder call site → returns to `LoginView`

All 12 passing = Phase 1 acceptance-complete. Phase 2 (remaining screens) starts from here.

## Known notes / gotchas

- **Reanimated → CABasicAnimation parity:** the splash uses SwiftUI `withAnimation` + `.timingCurve(0.25, 0.1, 0.25, 1, ...)` matching the RN bezier. If timing ever drifts, check `AnimatedSplashView.drawDuration`.
- **Glass elsewhere in the app:** add new floating chrome via `.glassEffect()`. Wrap clusters in `GlassEffectContainer { … }` so overlapping glass merges rather than double-refracting.
- **Font PostScript names** must match `Info.plist` `UIAppFonts` entries exactly (`SpaceGrotesk-Bold`, not `SpaceGrotesk_700Bold`). `FlynnFontDebug.logAvailable()` runs in DEBUG on launch and logs missing fonts.
- **Bundle ID is `com.flynnai.app.native` during development** so it doesn't clash with the RN build. Switch to `com.flynnai.app` at cutover (also bump `CURRENT_PROJECT_VERSION` past 56).
- **Secrets** live in `Config/Secrets.local.xcconfig` (gitignored). Don't commit real keys. The Supabase anon key is technically public-safe but we keep it out of the repo for hygiene.

## Authoritative Liquid Glass docs

- [Applying Liquid Glass to custom views](https://developer.apple.com/documentation/SwiftUI/Applying-Liquid-Glass-to-custom-views)
- [`.glassEffect()` modifier](https://developer.apple.com/documentation/swiftui/view/glasseffect(_:in:))
- [`GlassEffectContainer`](https://developer.apple.com/documentation/swiftui/glasseffectcontainer)
- [HIG: Materials](https://developer.apple.com/design/human-interface-guidelines/materials)
