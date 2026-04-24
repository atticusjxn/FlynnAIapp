# Flynn AI iOS — UX Audit Findings
**Date:** 2026-04-23  
**Device:** iPhone 17 Pro Simulator (iOS 26.3)  
**Account:** demo@flynnai.app  
**Build:** 1.3.0 (57)  
**Auditor:** Claude Code (automated walkthrough of all 6 onboarding steps + dashboard)

Screenshots in `/tmp/flynn-ux-audit/`.

---

## P0 — Critical (crashes or navigation permanently stuck)

### P0-1 · Login flashes MainTabView before onboarding
**File:** `FlynnAI/App/RootView.swift`  
**Symptom:** On first sign-in the user sees the Dashboard for ~300ms then snaps into the onboarding coordinator. Looks broken and low-quality.  
**Root cause:** `onboarding.onboardingCompleted` starts as `nil` (not yet loaded from DB). The condition `onboarding.onboardingCompleted == false` evaluates to `false` when the value is `nil`, so SwiftUI renders `MainTabView` until `load()` completes and sets the value to `false`.  
**Fix:**
```swift
// RootView.swift — signedInContent
// Current (broken):
if onboarding.onboardingCompleted == false {
// Fixed:
if onboarding.onboardingCompleted != true {   // nil and false both route to onboarding
```
Or show a `ProgressView` / `Color.white` while `onboardingCompleted == nil`.

---

### P0-2 · "I'm ready — go live" (Step 6) never transitions to the dashboard
**Files:** `FlynnAI/App/RootView.swift`, `FlynnAI/Features/Onboarding/OnboardingCoordinator.swift`  
**Symptom:** Tapping the final CTA does nothing visible. The app stays on Step 6 forever. `onboarding_completed` IS written to the database correctly, but the UI never updates.  
**Root cause:** `RootView` owns `@State private var onboarding = OnboardingStore()`. `OnboardingCoordinator` creates its own separate `@State private var store = OnboardingStore()`. When `finish()` in the coordinator calls `await store.markComplete()` it sets `store.onboardingCompleted = true` on the coordinator's private instance — `RootView.onboarding` (a different object) is never notified and stays `false`.  
**Fix:** Pass `RootView`'s `onboarding` store into the coordinator rather than creating a new one.
```swift
// RootView.swift
OnboardingCoordinator(store: onboarding)   // pass the shared store

// OnboardingCoordinator.swift
struct OnboardingCoordinator: View {
    @Bindable var store: OnboardingStore   // receive, don't create
    // remove: @State private var store = OnboardingStore()
```

---

### P0-3 · Missing `NSMicrophoneUsageDescription` in Info.plist → crash on Step 4
**File:** `FlynnAI/Config/Info.plist`  
**Symptom:** App hard-crashes (SIGABRT / TCC violation) when navigating from Step 3 to Step 4 because Step 4's `.task` calls `AVAudioApplication.requestRecordPermission()` with no usage description string.  
**Status:** ✅ Fixed this session — `NSMicrophoneUsageDescription` was added.  
**Crash reason from report:** `"This app has crashed because it attempted to access privacy-sensitive data without a usage description. The app's Info.plist must contain an NSMicrophoneUsageDescription key."`

---

### P0-4 · No `business_profiles` row for demo account → Step 3 always fails
**Symptom:** Step 3 ("Pick an IVR template") always shows "Couldn't load IVR settings / The data couldn't be read because it is missing" with no way to recover. RETRY never succeeds.  
**Root cause (two parts):**  
1. The demo account seed SQL created an `org_members` row (org `44394955-4a05-41aa-ae28-0d6639c859a7`) but wrote **no `business_profiles` row** for that org. `IVRScriptEditorStore.load()` calls `profileRepo.fetch()` which returns `nil`/empty, causing a Swift `DecodingError` when the DTO tries to decode a required field.  
2. The website scrape endpoint (`POST /api/scrape-website`) writes scraped data to the `users` table but **not** to `business_profiles` (see plan Part 2a — this backend fix is still pending). So even after scraping, no profile row exists.  
**Fix:**
- Apply the `business_profiles` upsert in `/api/scrape-website` (plan Part 2a).
- Seed the demo account's `business_profiles` row manually (see plan Part 3).
- Make the IVR step gracefully handle a missing profile by pre-populating with empty defaults rather than hard-erroring.

---

### P0-5 · Step 4 Live Voice Demo always shows "Couldn't connect"
**File:** `FlynnAI/Features/Onboarding/LiveVoiceDemoStepView.swift` → `OnboardingStore.loadDemoSession()`  
**Symptom:** Step 4 immediately shows a red flash "Couldn't connect — tap continue to skip". The waveform shows as disconnected dots. The voice demo is completely non-functional.  
**Root cause:** `loadDemoSession()` calls `POST /api/demo/start-voice-session` which **does not yet exist** on the backend. The plan specifies it in Part 2c but it hasn't been implemented.  
**Fix:** Implement `POST /api/demo/start-voice-session` in `server.js` (see plan Part 2c).

---

## P1 — Important (bad experience, not a crash)

### P1-1 · Step 2: heading "How should Flynn handle missed calls?" appears twice
**File:** `FlynnAI/Features/Onboarding/OnboardingSteps.swift` — `CallHandlingModeStepView`  
**Symptom:** The step title (H2) and a section subheading directly below the subtitle both read "How should Flynn handle missed calls?" — identical text, 40px apart.  
**Fix:** Remove the duplicate section heading. The subtitle "Start with SMS Links — it's free. Switch to AI any time." followed immediately by the three option cards is sufficient.

---

### P1-2 · Step 5 Paywall: "No plans available right now."
**File:** `FlynnAI/Features/Onboarding/PaywallStepView.swift` (wraps `SubscriptionView`)  
**Symptom:** The entire paywall body is empty except "No plans available right now." followed by "Skip for now — use SMS links (free)". No subscription tiers are shown. No loading spinner precedes this state.  
**Root cause:** StoreKit is not configured in the Simulator environment. There is no `.storekit` configuration file in the project to enable sandbox testing. The App Store product IDs may also not be registered in App Store Connect yet.  
**Fix:**
- Add a `FlynnAI.storekit` configuration file targeting the three product IDs (Starter $29, Growth $79, Pro $199 AUD) and set it as the active StoreKit config in the scheme.
- Add a `ProgressView` while StoreKit loads products.
- Do not replace the plan cards with an error message — show a "Couldn't load plans, please try again" retry button instead.

---

### P1-3 · Custom fonts (SpaceGrotesk, Inter) not bundled — system fallback throughout
**File:** `FlynnAI/Config/Info.plist` (UIAppFonts), Xcode project target membership  
**Symptom:** All text renders in San Francisco (iOS system font). The brand identity is completely absent.  
**Root cause:** `Info.plist` declares four font files (`SpaceGrotesk-Bold.ttf`, `SpaceGrotesk-SemiBold.ttf`, `Inter-Regular.ttf`, `Inter-Medium.ttf`) but **the .ttf files do not exist anywhere in the project directory**. They were referenced but never added to the bundle.  
**Fix:** Download SpaceGrotesk and Inter from Google Fonts, add them to the Xcode project target (Copy Bundle Resources), and verify with `UIFont.familyNames` at launch.

---

### P1-4 · Step 1 scrape returns "Your Business" — not actual business name
**Symptom:** After scraping `matesplumbing.com.au`, the result card shows business name "Your Business" — a generic placeholder. This undermines the "Flynn knows your business" value moment.  
**Root cause:** The `/api/scrape-website` endpoint's business name extraction didn't parse the site correctly, OR the result is cached from a prior failed scrape and returns a default value. Because `business_profiles` has no row for this org, the scrape result isn't being persisted or read correctly.  
**Fix:** Tied to P0-4. Once the scrape correctly writes to `business_profiles`, the name will be populated from the actual scraped data. Also verify the scraper correctly extracts `businessName` from `matesplumbing.com.au`.

---

### P1-5 · Dashboard shows "Start 14-day free trial" for a demo account already in trial
**File:** `FlynnAI/Features/Dashboard/DashboardView.swift` (or UsageStore)  
**Symptom:** The dashboard promo card reads "Start 14-day free trial — Unlock AI receptionist minutes. Cancel anytime." even though the demo account has `subscription_status = 'trialing'`.  
**Root cause:** Either (a) the subscription status was not seeded correctly in the DB, or (b) the `UsageStore`/`SubscriptionStore` doesn't check `subscription_status` from the `users` table before showing the upsell card.  
**Fix:** Don't show the trial upsell card when `subscription_status` is `'trialing'` or `'active'`. Show a usage bar instead.

---

## P2 — Polish (noticeable, makes the app feel unfinished)

### P2-1 · Step 4 waveform renders as orange dots when disconnected
**File:** `FlynnAI/Features/Onboarding/LiveVoiceDemoStepView.swift` — `WaveformView`  
**Symptom:** In the disconnected state, `isActive = false` sets `amplitude = 3.0`. With `cornerRadius = barWidth / 2`, very flat rectangles become perfect circles → a row of orange dots instead of a flat waveform line.  
**Fix:**
```swift
// In WaveformView Canvas block — use a flat rect, skip cornerRadius when inactive
let rect = CGRect(x: x - barWidth/2, y: centerY - amplitude, width: barWidth, height: amplitude * 2)
let path = isActive
    ? Path(roundedRect: rect, cornerRadius: barWidth / 2)
    : Path(rect)  // flat rectangle when inactive, no rounding
```

---

### P2-2 · Excessive empty space on Steps 1, 5, 6
**Symptom:** Steps 1 (after scrape result), 5 (paywall), and 6 (phone) all have content only in the top 40% of the screen. The bottom half is plain white. Feels sparse and unfinished.  
**Fix:** Use `Spacer()` deliberately, add more contextual information (e.g. social proof, what happens next), or use `.frame(maxHeight: .infinity)` with a vertically centred layout.

---

### P2-3 · Progress bar capsules: low contrast between active and inactive
**Symptom:** Inactive capsules (`FlynnColor.gray200`) on a near-white background are nearly invisible. Active (orange) vs inactive is hard to read at a glance.  
**Fix:** Darken inactive capsules to `gray300` or add a 1pt border. Or use opacity: active = 1.0, inactive = 0.3 of primary.

---

### P2-4 · "STEP X OF 6" overline: very small, low contrast
**Symptom:** The step indicator text (10–11pt, `FlynnColor.textSecondary`) is difficult to read on the light background, especially in bright conditions.  
**Fix:** Use `FlynnColor.textPrimary` or increase to `FlynnTypography.caption` with `textSecondary`. Already flagged as a plan item (Part 6 — Contrast fixes).

---

### P2-5 · "I don't have a website" and "Skip for now" links likely under 44pt touch target
**Files:** `OnboardingSteps.swift` (WebsiteScrapeStepView), `PaywallStepView.swift`  
**Symptom:** Both are rendered as plain `Text` links without `.frame(minHeight: 44)` or `.contentShape(Rectangle())`. On device they will be hard to tap accurately.  
**Fix:**
```swift
Button("I don't have a website") { ... }
    .frame(minHeight: 44)
    .contentShape(Rectangle())
```

---

### P2-6 · No onboarding progress saved between app launches
**Symptom:** Killing and relaunching the app always returns to Step 1 URL entry, even if the user had already scraped and advanced to Step 3. All progress is lost.  
**Fix:** Persist `currentStep` (and the scraped URL) to `UserDefaults` or to the `users` table. On `OnboardingStore.load()`, restore the step if `onboarding_completed == false` and a step is saved.

---

### P2-7 · No "Skip" button on Step 6; no clear escape if "go live" is stuck
**Symptom:** All other steps have a Skip button (top right) but Step 6 only has Back. If the CTA is non-functional (as it currently is due to P0-2), the user has no escape path other than killing the app.  
**Fix:** Add a subtle "Set up later" text link below the CTA that calls `onFinish()` directly. (The `Skip` toolbar item is already conditionally suppressed for `.phoneNumber` in the coordinator — remove that suppression or add an in-body link.)

---

## Summary table

| ID | Step | Severity | Category | Status |
|----|------|----------|----------|--------|
| P0-1 | Login | P0 | Bug | Open |
| P0-2 | Step 6 | P0 | Bug | Open |
| P0-3 | Step 4 | P0 | Crash | **Fixed** |
| P0-4 | Step 3 | P0 | Data/Backend | Open |
| P0-5 | Step 4 | P0 | Backend | Open |
| P1-1 | Step 2 | P1 | Visual | Open |
| P1-2 | Step 5 | P1 | StoreKit | Open |
| P1-3 | All | P1 | Assets | Open |
| P1-4 | Step 1 | P1 | Backend | Open |
| P1-5 | Dashboard | P1 | Logic | Open |
| P2-1 | Step 4 | P2 | Visual | Open |
| P2-2 | Steps 1,5,6 | P2 | Layout | Open |
| P2-3 | All | P2 | Contrast | Open |
| P2-4 | All | P2 | Contrast | Open |
| P2-5 | Steps 1,5 | P2 | Touch target | Open |
| P2-6 | All | P2 | UX | Open |
| P2-7 | Step 6 | P2 | UX | Open |

## Recommended fix order

1. **P0-2** — two-store bug (blocks everything from completing onboarding)
2. **P0-1** — nil flash (first impression)
3. **P0-4** — seed `business_profiles`, fix scrape endpoint write (unlocks Steps 1 & 3)
4. **P0-5** — implement `/api/demo/start-voice-session` (unlocks Step 4)
5. **P1-3** — add font files to bundle (brand identity)
6. **P1-2** — StoreKit config file for Simulator testing
7. **P1-1, P1-5** — minor code fixes (duplicate heading, subscription upsell)
8. **P2-x** — polish pass (waveform, spacing, contrast, touch targets)
