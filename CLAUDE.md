# Flynn AI — Project Context & Design System

## What Flynn Is

**Flynn is a payments company with an AI skin, not a SaaS company with payments attached.**
Free, unlimited invoicing for solo tradies and small crews — Flynn drafts and sends invoices
(hold a button and talk, or type), the invoice link goes out over SMS/email or via the Flynn
keyboard extension into any chat app the tradie already uses (HiPages, Airtasker, iMessage,
WhatsApp, Gmail), and the client pays on the spot. Revenue is a small capped fee on payments that
clear through Flynn's own rail — not a subscription seat.

**One promise:** "Start sending invoices for free. Get paid faster."

**Primary surface is the native Swift iOS app** — agent-first: a living dashboard home screen with
a persistent bottom bar to talk or type to Flynn, plus Jobs / Money / Clients tabs as the system of
record. The **keyboard extension is the distribution wedge**, not a secondary nicety — it lets the
boss insert a drafted reply + payment link into any app without leaving it. A shared "Team Flynn"
number lets employees text receipts, job notes, and parts-pickup requests with OTP verification and
no login. iMessage is no longer the primary channel (see Non-Goals) — it's a demoted nice-to-have.

*(Superseded 2026-07-18: Flynn was previously "a text-based business agent that lives in iMessage."
That channel — plus the self-hosted BlueBubbles relay it depended on — is a platform-risk trap and
a weak paid-acquisition funnel. See memory `flynn_positioning` and `flynn_payments_verified_facts`,
and the build plan for the full reasoning.)*

## Who It's For

Service operators who run their business from their phone: tradies, removalists, cleaners, PTs,
salons, freelancers. Beachhead is AU/NZ trades (photo-invoice + payments land hardest there);
vision is broader SMB once the payments rail and app are proven. Vertical-agnostic long-term.

## Core Principles

- **Payments-first.** The business model is a capped take-rate on payment volume that clears
  through Flynn's rail, not a subscription seat. Free invoicing is the acquisition hook.
- **Agent-first, not forms-first.** One button — talk or type — not five tabs of data entry.
  Voice-to-invoice lives in the main app (iOS keyboard extensions cannot access the microphone).
- **The keyboard is the distribution wedge.** Draft + payment link inserted into whatever app the
  lead actually lives in — text-insertion only (no attachments, no secure fields — platform limit).
- **Brain-first.** Every response uses the user's actual pricing, invoicing style, and client
  context. Onboarding lets a tradie forward an old invoice so Flynn learns their voice/format
  immediately — no blank-slate problem. Generic responses are a bug.
- **Automation only fires on-rail.** Auto-chase, paid-detection, receipt filing, and tax-sorting
  only work when the payment clears through Flynn — this is the retention mechanic, not a gimmick,
  and it's load-bearing for the whole revenue model (see `flynn_payments_verified_facts`).
- **Proactive but not pushy.** Flynn chases unpaid invoices, flags jobs, re-engages quiet users.
  Stops after 3 attempts and never nags.
- **Confirm before executing.** For anything irreversible (sending an invoice, placing an order),
  Flynn confirms first.
- **No login for crew.** Employees texting the Team Flynn number verify by OTP only — zero
  friction, zero app required for them.

## Primary Architecture

```
Swift iOS app (ios-native/, primary surface)
  → Agent-first Home: talk/type to Flynn, hybrid living dashboard
  → Jobs / Money / Clients: the system of record (org-keyed Supabase spine)
  → Keyboard extension: insert drafted reply + payment link into any app

Backend: Node.js/Express on Fly.io (flynnai-telephony.fly.dev)
Data: Supabase (zvfeafmmtfplzpnocyjw, ap-southeast-2) — org-keyed spine
  (organizations/org_members/jobs/clients/invoices/expenses/client_threads)
LLM: Qwen3.5-flash via DashScope (fast, cheap, natural tone)
Payments: Stripe Connect Express (cards/Apple Pay, free convenience, no Flynn margin) +
  a flat-fee PayID rail (Azupay/Monoova — build-blocking dependency, carries the take-rate)
Client channel: SMS + email (no iMessage relay dependency)
Team Flynn number: Twilio SMS, OTP-verified crew, no BlueBubbles/relay needed
```

Full build plan: `~/.claude/plans/iridescent-floating-moore.md`.

## Surfaces

### 1. iOS app (primary — where the boss works)
- Agent-first Home: proactive cards + persistent voice/text agent bar
- Jobs, Money (invoices/quotes + pay-now status), Clients (two-way SMS/email threads)
- Onboarding: create business → forward an old invoice to learn style → connect payments → invite
  crew by phone
- Keyboard extension for drafting into any third-party chat app
- See `~/.claude/plans/iridescent-floating-moore.md`

### 2. Client channel (SMS + email — no app needed for clients)
- Invoice/quote links delivered by SMS and email, branded short-link with OG preview
- Two-way threads: client replies get parsed and surfaced back to the boss/agent
- Auto-chase on unpaid invoices until paid

### 3. Team Flynn number (crew — no login, OTP only)
- Text a receipt photo → logged as an expense
- Text a job note/photo → attached to the active job
- "order 10 sheets of ply" → parts order placed, pickup QR texted back
- Text availability → surfaces to the boss

### 4. Web dashboard (flynnai.app/dashboard) — secondary
- Same data, browser-accessible view; not the primary funnel

## Non-Goals — Do Not Build

- Voice training or voice cloning
- Always-on screen recording or clipboard harvesting
- Autonomous sending without confirmation (invoices, orders always confirm first)
- Any UX or marketing leading with "AI"
- Desktop app or browser extension (not in current scope)
- Android app for now (parked as of the payments-first pivot — Swift only; see memory
  `flynn_android_play_app`)
- Treating iMessage/BlueBubbles as the primary channel (demoted — platform risk; see memory
  `flynn_imessage_channel_strategy`)
- Voice capture inside the keyboard extension (Apple-confirmed impossible — mic access is
  unavailable to app extensions; voice lives in the main app only)
- Klarna at launch (fees too high relative to the flat-fee PayID rail's economics)
- Multi-user/team features beyond the lightweight crew-texts-in model above (no full RBAC/org
  admin UI yet — that's a later, pulled-not-pushed build)

## Message Tone — Non-Negotiable

Flynn's SMS replies must read like a real person texted them, not a product.

- Start messages lowercase where natural ("hey", "got it", "done")
- Never use em dashes (—) — use commas or short sentences
- No bullet points in SMS — prose only
- No filler openers: never "Great!", "Sure!", "Absolutely!"
- Contractions always: I'll, you've, can't
- Short sentences. Two short ones beat one long one.
- Currency: infer from phone prefix (+61 → AUD, +64 → NZD, +1 → USD)

All outbound messages pass through `sanitiseReply()` which strips em dashes and other AI tells before sending.

## The Priority

Validate with real users. Measure **week-4 retention**. Everything else is secondary.

---

## ⚠️ Reconciliation Notes

| Prior version | Status |
|---|---|
| Keyboard-first product ("assistive AI that drafts replies") | **Superseded** — iMessage agent is primary surface |
| "Flynn never sends anything on its own" | **Updated** — Flynn sends proactively (re-engagement, confirmations) but always confirms before irreversible actions |
| Screenshot capture / OCR / keyboard insert as core loop | **Secondary** — still built, but not the onboarding path |
| IVR, telephony, voicemail pipeline | **Retired** |
| "Inbound Revenue OS" positioning | **Retired** |

**What is kept:** brand identity, mascot, design system (colors, typography, spacing, components), Supabase schema, Twilio for SMS fallback, development rules.

---

## 🎨 Design System

**The app is Swift/SwiftUI (`ios-native/`). There is no React Native in the shipped product.**
Tokens live in `ios-native/FlynnAI/DesignSystem/Tokens/`; read them before designing anything —
they are the source of truth and this document is a summary of them.

### The language

Mid-century, warm, hand-made. Not the flat blue SaaS look, and not glassmorphism everywhere.
A cream ground, ink-black 3pt outlines, chunky pill CTAs, one hot orange used sparingly for
the thing you want tapped. Dark mode is a warm brown, never black.

Glass (`FlynnGlassButton`) is reserved for actions floating over content. It is an accent, not
the surface language.

### Colour — `Tokens/Colors.swift`

```swift
// Brand — one orange, used for the primary action and nothing else
primary        #FB5B1E      primaryDark  #D94A12
primaryLight   light #FFE8DC / dark #3A1F14

// Accents — mid-century, for categorisation and illustration
mustard #E0A436   teal #3C8A86   terra #C5532B   olive #7E8B4F

// Ground
background          light #F4E6CE / dark #1C1611     ← cream, not white
backgroundSecondary light #FFFBF4 / dark #26201A
backgroundTertiary  light #ECE0C8 / dark #322A22

// Ink
textPrimary   light #2C2018 / dark #F7F0E4
textSecondary light #5A4A3C / dark #D6C9B6

// Borders — `border` is the signature ink outline
border       light #2C2018 / dark #F7F0E4
borderSubtle light #DCCDB2 / dark #3E352B
borderFocus  #FB5B1E       borderError #C5532B
```

Every colour is `Color.dynamic(light:dark:)` and resolves through the trait collection, so dark
mode is automatic if you use tokens. **Never hardcode a hex outside the token file.** The only
sanctioned exceptions are third-party brand marks in `IntegrationBrand.swift` (Google, Apple,
Xero, Gmail).

### Type — `Tokens/Typography.swift`

Space Grotesk for display/headers/buttons, Inter for body. Applied with `.flynnType(_:)`, which
also scales `lineSpacing` via `@ScaledMetric`.

| Token | Font | Size / line | Dynamic Type anchor |
|---|---|---|---|
| `displayLarge` | Space Grotesk Bold | 48 / 56 | `.largeTitle` |
| `displayMedium` | Space Grotesk Bold | 36 / 44 | `.largeTitle` |
| `h1` | Space Grotesk Bold | 30 / 36 | `.title` |
| `h2` | Space Grotesk Bold | 24 / 32 | `.title2` |
| `h3` | Space Grotesk SemiBold | 20 / 28 | `.title3` |
| `h4` | Space Grotesk SemiBold | 18 / 24 | `.headline` |
| `bodyLarge` | Inter Regular | 16 / 24 | `.body` |
| `bodyMedium` | Inter Regular | 14 / 20 | `.callout` |
| `bodySmall` | Inter Regular | 12 / 16 | `.footnote` |
| `caption` | Inter Medium | 12 / 16 | `.caption` |
| `label` | Inter Medium | 14 / 20 | `.subheadline` |
| `button` | Space Grotesk Bold | 18 / 24 | `.headline` |
| `overline` | Space Grotesk Bold | 11 / 16, +0.5 tracking, UPPERCASE | `.caption2` |

Buttons are **sentence case**. Only `overline` (eyebrow labels) is uppercase.

**Accessibility is load-bearing here.** Every token passes `relativeTo:`, so text scales with the
user's setting. If you write a raw `.font(.custom(...))` you must pass `relativeTo:` too. Never
use `.font(.system(size:))` for text — it does not scale. Prefer `minHeight` over `height` on
anything containing text.

### Spacing, radii, stroke — `Tokens/Spacing.swift`

```swift
FlynnSpacing  xxxs 2 · xxs 4 · xs 8 · sm 12 · md 16 · lg 24 · xl 32 · xxl 48 · xxxl 64
FlynnRadii    none 0 · xs 4 · sm 8 · md 12 · lg 16 · xl 20 · xxl 24 · pill 30 · full 9999
FlynnStroke   hairline 1 (dividers) · outline 3 (the signature ink border) · focus 4
```

`pill` (30) is the chunky CTA radius. `outline` (3pt) is the signature border and matches the
landing page's `border-[3px]` — the two surfaces share this palette verbatim.

### Components — `DesignSystem/Components/`

`FlynnButton` · `FlynnGlassButton` · `FlynnTextField` · `FlynnCard` · `FlynnBadge` · `Mascot` ·
`MidCentury` · `VoiceHoldButton` · `VoiceLevelMeter` · `ContextualVoiceBar`, plus the
`.flynnCardSurface()` modifier and `Modifiers/FlynnListSurface.swift`.

Compose these rather than rebuilding. `VoiceHoldButton` in particular already does real
RMS→dBFS mic amplitude, slide-to-cancel, haptics and a VoiceOver tap-toggle fallback — it needs
polish, not replacement.

### Known inconsistencies (the actual UI worklist)

1. **Two ways of building a card.** Home uses `.flynnCardSurface()`; Settings/Integrations
   hand-roll `RoundedRectangle().fill() + .brutalistBorder()`. Pick one.
2. **Five screens bypass `.flynnType`** with raw `.font(.custom(...))` at sizes (13/15) that map
   to no token: `PracticeStepView`, `KeyboardTourStepView`, `OnboardingSteps`,
   `OnboardingDesign`. `OnboardingDesign.swift:17` names them as the outstanding migration.
3. **`KeyboardSetupFlow` and `PracticeStepView` force `.colorScheme(.light)`** — that flow
   ignores the user's dark-mode setting entirely.
4. **23 fixed-size SF Symbols** (`.font(.system(size:))`) and **no `minimumScaleFactor` anywhere**
   despite several `.lineLimit(1)` labels.
5. **`FlynnColor.mascotOrange` is deprecated** with no call sites — safe to delete.

The gap in this app is *composition and motion*, not tokens. The token layer is good and
consistently applied (58 files use `.flynnType`; only 7 raw `.padding(N)` calls in the entire
feature tree). Spend the effort on hierarchy, rhythm, empty states and micro-interaction.

## 🗣️ Language & Copy

### Terminology
- Say **"job"** or **"booking"** — never "appointment"
- Say **"your calendar"** — not "the calendar"
- Say **"quote"** and **"invoice"** — the money words, plainly
- Keep copy short. The user is on a roof, in a van, or under a sink.

### Voice & tone
- **Plain and direct**, like a sharp assistant who knows the business
- **Action-oriented** — "Send invoice", "Book it in", "Divert your calls"
- **Clear status** — "Flynn answered", "Booked", "Chasing", "Paid"
- Confirm before anything irreversible; say what will happen, not that it might

### Button labels
- ✅ "Send invoice" · "Book it in" · "Divert your calls" · "Try again"
- ❌ "Submit" · "Configure" · "Schedule" · "Retry"

### Status messages
- ✅ "Flynn answered — job booked for Thursday 9am"
- ✅ "Invoice sent. Flynn will chase it."
- ❌ "API call completed" · "Data processed" · "Operation successful"

> **Superseded:** the old copy rules built around a keyboard extension ("Insert", not "Send";
> "Flynn never sends") no longer apply. Flynn answers calls and sends invoices. It confirms
> before irreversible actions — that is the guardrail now, not manual insertion.

## 📋 Component checklist

- [ ] Colour from `FlynnColor`, never a raw hex
- [ ] Type via `.flynnType(_:)`; any raw `.font(.custom(...))` passes `relativeTo:`
- [ ] Spacing/radii/stroke from `FlynnSpacing` / `FlynnRadii` / `FlynnStroke`
- [ ] Pressed and disabled states on anything interactive
- [ ] Minimum 44×44pt touch target
- [ ] Walks correctly at the largest accessibility text size
- [ ] Correct in dark mode (warm brown, not black)
- [ ] VoiceOver labels on icon-only controls
- [ ] Named `FlynnComponentName` if it belongs in the design system


## 💼 Accounting & Integration Status

Flynn integrates via the **iMessage agent tool-loop** (`services/agent/`, `FLYNN_TOOL_LOOP=1`) over the self-hosted **Nango** OAuth backbone (`connect.flynnai.app`). Connectors live in `data/integrations.tsx`; setup state tracked in `plans/integrations-tracker.md`. (Nango config is via its management API with basic auth, not the dashboard — see memory `flynn-nango-poc-plan`.)

**Live now:** Google Calendar, Google Sheets (receipts/timesheets), **Xero** (log expense / list invoices via API + browserbase invoice send), **multi-provider email** — `send_email`/`find_emails` route to Gmail (OAuth), Outlook/Microsoft 365 (Graph OAuth), or any other provider (Bigpond/iCloud/Optus/cPanel via IMAP+SMTP, `services/imapEmail.js`). Agent also does **quotes** (draft/record/chase via `agent_quotes`), the **weekly money digest** + **quote chaser** crons, and a **Stripe paywall gate** (`FLYNN_PAYWALL`).

**Ads tracking:** Meta CAPI is wired (`services/metaCapi.js`) on a dedicated web pixel — see memory `flynn-meta-capi`.

### Supported accounting platforms
- **Xero** — Cloud-first SMB (**live**)
- **MYOB** — AU/NZ focus (planned; dev approval slow)
- **QuickBooks** — US/global small business (planned)

### Planned Features
- Send invoice for a completed booking
- Create quote from a draft interaction
- Log job expenses
- Sync client data (two-way)

### UX Intent
- Clear connection status (green = connected, gray = disconnected)
- One-tap accounting actions from completed job cards
- OAuth setup flow; integration management in Settings

## 🔗 URL Scheme & Deep Links

The app registers exactly one scheme: **`flynnai`** (no hyphen) — see
`ios-native/FlynnAI/Config/Info.plist`. Links are parsed in
`ios-native/FlynnAI/Navigation/DeepLinkRouter.swift`, which rejects anything else,
so `flynn-ai://` silently does nothing.

```
flynnai://dashboard
flynnai://events              flynnai://events/<uuid>
flynnai://clients             flynnai://clients/<uuid>
flynnai://calls               flynnai://calls/<uuid>
flynnai://money               flynnai://money/invoices/<uuid>
                              flynnai://money/quotes/<uuid>
flynnai://calendar
flynnai://settings
flynnai://auth…               (Supabase email confirmation / magic link)
```

Note `flynnai://money` is the tab; the invoice/quote detail forms need the
`invoices`/`quotes` segment.

### DEBUG demo mode

Fills every screen with fixtures, skips the login and the org lookup, and
suppresses the notification/tracking prompts. Release builds compile it out.

```bash
xcrun simctl launch <device> com.flynnai.app -FlynnDemo
xcrun simctl launch <device> com.flynnai.app -FlynnDemo -FlynnDemoTab money
```

Fixtures live in `ios-native/FlynnAI/Core/FlynnDemo.swift`; `-FlynnDemoTab` takes
a `FlynnTab` raw value (`dashboard`, `brain`, `events`, `money`, `clients`).

> **Retired:** the iOS Shortcuts screenshot-capture pipeline
> (`flynn-ai://process-screenshot`, ShortcutHandler, on-device OCR) no longer
> exists in the codebase — that scheme was never registered and nothing handles
> it. Voice capture in the main app replaced it; see the Non-Goals section.

## 🚫 Development Rules

### The native apps are the shipped apps — NOT the Expo projects
- **iOS:** the app Flynn ships is **`ios-native/`** (Swift/SwiftUI, XcodeGen `project.yml`, scheme `FlynnAI`, targets `FlynnAI` + `FlynnKeyboard`). Build/run it with Xcode/`xcodebuild`.
- **Android:** the Play app is **`android-native/`** (Kotlin), built via `gradlew`.
- **DO NOT** build or run the Expo `ios/` (`ios/FlynnAI.xcworkspace`) or Expo `android/`, and **never run `expo run:ios`/`expo run:android`** — those are stale/secondary RN builds. When the user says "the app", they mean the native one for that platform.

### NEVER Run Development Servers
- **DO NOT** use `npm start`, `npm run dev`, `expo start`, or any similar commands
- **DO NOT** attempt to start development servers or preview environments
- The user will handle all server/preview management themselves
- Focus only on code implementation and file changes

### Why This Rule Exists
- Development servers are managed by the user in their local environment
- Starting servers can interfere with the user's existing development setup

## 🔄 Version History

- **v4.0.0** — Payments-first pivot: app-primary, AI agent + keyboard as distribution wedge (July 2026)
  - New product: Flynn is a payments company with an AI skin — free invoicing, capped take-rate on payment volume, not SaaS seats
  - Swift iOS app becomes the primary surface (agent-first Home, voice-to-invoice); keyboard extension repurposed as the distribution wedge (draft + payment link into any chat app)
  - iMessage/BlueBubbles demoted from primary channel to nice-to-have; clients reached via SMS + email
  - Android parked (Swift only for now)
  - Core principle: automation (auto-chase, receipt filing, tax-sorting) only fires when payment clears on Flynn's own rail — this is the retention mechanic the take-rate model depends on
  - See `~/.claude/plans/iridescent-floating-moore.md` and memory `flynn_positioning` / `flynn_payments_verified_facts`
- **v3.0.0** — Pivot to assistive keyboard reply drafter + calendar booking (June 2025)
  - New product: screenshot/clipboard capture → keyboard drafts → tap to insert
  - Retired telephony system (IVR, Twilio, Deepgram Voice Agent, voicemail pipeline)
  - Core principle: assistive only, never autonomous
  - Target: week-4 retention with real service-operator users
- **v2.0.0** — Voicemail receptionist pivot (January 2025)
- **v1.0.0** — Initial design system (December 2024)

---

# important-instruction-reminders
Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.
