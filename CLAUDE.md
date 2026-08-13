# Flynn AI — Project Context & Design System

## What Flynn Is

**Flynn is a payments company with an AI skin, not a SaaS company with payments attached.**
An AI receptionist answers the calls a solo tradie or small crew can't get to, books the job
straight into their calendar, and sends a branded booking link by SMS — then Flynn drafts and
sends the invoice (hold a button and talk, or type), with photos of the job on it, and chases it
until it's paid. Revenue is a small capped fee on payments that clear through Flynn's own rail —
not a subscription seat on its own; the receptionist is priced under the field to get the payments
rail installed.

**Positioning: "Never miss a job. Never chase a payment."** The receptionist is the hook; the
money tail (photo invoice → auto-chase → paid) is the differentiator none of the AU AI-receptionist
competitors lead with.

**Pricing:** two StoreKit tiers, 7-day card-required trial, no free tier — **Flynn Link (A$29)**
and **Flynn Receptionist (A$69)**. Billed via StoreKit IAP only (15% under Apple's Small Business
Program).

**Primary surface is the native Swift iOS app** — agent-first: a living dashboard home screen with
a persistent bottom bar to talk or type to Flynn, plus Jobs / Money / Clients tabs as the system of
record and what the receptionist answered surfaced from Home. Clients are reached over
**SMS + email only** — no keyboard extension, no iMessage/BlueBubbles relay, no crew number. All
three were cut (see Non-Goals and the Version History below); the client-facing artifact is the
branded booking link, not a chat-app insertion.

*(Superseded 2026-08 — Gate 5, "Road to A$10k MRR": the FlynnKeyboard app extension, the
BlueBubbles/iMessage relay and Sendblue fallback, the group-chat note-taker
(`services/groupAgent/`), and the Team Flynn crew-number surface are all **physically deleted**
from the codebase, not just demoted. See `~/.claude/plans/i-am-back-after-elegant-canyon.md` and
the live checklist in `a.md` for the full gate-by-gate record.)*

## Who It's For

Service operators who run their business from their phone: tradies, removalists, cleaners, PTs,
salons, freelancers. Beachhead is AU/NZ trades (missed-call cost + photo-invoice + payments land
hardest there); vision is broader SMB once the payments rail and app are proven.
Vertical-agnostic long-term.

## Core Principles

- **Payments-first.** The business model is a capped take-rate on payment volume that clears
  through Flynn's rail, not a subscription seat on its own. The receptionist + free invoicing are
  the acquisition hooks.
- **Agent-first, not forms-first.** One button — talk or type — not five tabs of data entry.
- **Never miss the call.** The AI receptionist answers when the operator can't, sounds like a real
  person, and books straight into the calendar. A missed/declined call still gets a booking-link
  SMS — nothing goes to voicemail with no follow-up.
- **Brain-first.** Every response — on a call or in a text — uses the user's actual pricing,
  invoicing style, and client context. Onboarding captures trade, services and pricing (by voice
  or by forwarding an old invoice) so Flynn never starts from a blank slate. Generic responses are
  a bug.
- **Automation only fires on-rail.** Auto-chase, paid-detection, receipt filing, and tax-sorting
  only work when the payment clears through Flynn — this is the retention mechanic, not a gimmick,
  and it's load-bearing for the whole revenue model.
- **Proactive but not pushy.** Flynn chases unpaid invoices, flags jobs, re-engages quiet signups.
  Stops after 3 attempts and never nags.
- **Confirm before executing.** For anything irreversible (sending an invoice, placing an order),
  Flynn confirms first.
- **Client channel is SMS + email, full stop.** No app, no login, no third-party chat platform
  required for a client to receive an invoice or a booking link.

## Primary Architecture

```
Swift iOS app (ios-native/, primary surface)
  → Agent-first Home: talk/type to Flynn, hybrid living dashboard
  → Jobs / Money / Clients tabs are the system of record (org-keyed Supabase spine); calls the
    receptionist answered are a pushed list from Home, not a fifth tab

Backend: Node.js/Express on Fly.io (flynnai-telephony.fly.dev)
Data: Supabase (zvfeafmmtfplzpnocyjw, ap-southeast-2) — org-keyed spine
  (organizations/org_members/jobs/clients/invoices/expenses/client_threads)
Telephony: Twilio numbers, Deepgram (ASR) + Cartesia (TTS) voice agent for the AI receptionist
LLM: Qwen3.5-flash via DashScope (fast, cheap, natural tone) for text/agent turns
Payments: Stripe Connect Express (cards/Apple Pay, free convenience, no Flynn margin) +
  a flat-fee PayID rail (Azupay/Monoova — build-blocking dependency, carries the take-rate)
Billing: StoreKit IAP, two tiers (Flynn Link A$29 / Flynn Receptionist A$69), 7-day trial
Client channel: SMS + email only — no iMessage/BlueBubbles relay, no keyboard extension
```

Full build plan: `~/.claude/plans/i-am-back-after-elegant-canyon.md`. Live gate checklist: `a.md`.

## Surfaces

### 1. iOS app (primary — where the boss works)
- Agent-first Home: proactive cards + persistent voice/text agent bar
- Jobs, Money (invoices/quotes + pay-now status), Clients (two-way SMS/email threads); calls the
  receptionist answered are a pushed list from Home, not a rendered tab
- Target onboarding sequence (Gate 2 in `a.md`, partially built): phone-OTP signup →
  trade/services/pricing → calendar connect (skippable) → a live demo call → paywall → number
  assigned → forwarding verified. Check `a.md` Gate 2 for which steps are actually wired today
  before assuming the funnel is complete end-to-end.
- See `~/.claude/plans/i-am-back-after-elegant-canyon.md`

### 2. Client channel (SMS + email — no app needed for clients)
- Invoice/quote links and the branded booking page delivered by SMS and email, with an OG preview
- Two-way threads: client replies get parsed and surfaced back to the boss/agent
- Auto-chase on unpaid invoices until paid; missed/declined calls still get a booking-link SMS

### 3. Web dashboard (flynnai.app/dashboard) — secondary
- Same data, browser-accessible view; not the primary funnel

## Non-Goals — Do Not Build

- Voice training or voice cloning
- Always-on screen recording or clipboard harvesting
- Autonomous sending without confirmation (invoices, orders always confirm first)
- Any UX or marketing leading with "AI"
- Desktop app or browser extension (not in current scope; a `desktop-mac/` prototype exists but
  is not the shipped product)
- Android app for now (parked as of the payments-first pivot — Swift only; `android-native/` is
  not actively developed)
- **The FlynnKeyboard app extension.** Deleted entirely (Gate 5.1) — iOS keyboard extensions
  cannot access the microphone, and it was a weak distribution mechanic compared to the
  receptionist + booking link. Voice-to-invoice lives in the main app only.
- **The iMessage/BlueBubbles relay, Sendblue fallback, and the group-chat note-taker.** Deleted
  entirely (Gate 5.3) — a self-hosted platform-risk trap and a weak paid-acquisition funnel. The
  client channel is SMS + email, full stop.
- **The Team Flynn crew-number surface.** Deleted entirely (Gate 5.2) — no crew-texts-in model,
  no OTP-verified employee number. If a lightweight crew feature returns later it needs a fresh
  design, not a revival of the old one.
- Klarna at launch (fees too high relative to the flat-fee PayID rail's economics)
- Multi-user/team features (no full RBAC/org admin UI — a later, pulled-not-pushed build)

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

**A$10k MRR by December 2026**, profitable on ad spend plus organic — see
`~/.claude/plans/i-am-back-after-elegant-canyon.md` for the gated operating plan and the 7 Sept
2026 kill-gate. Validate with real users. Measure **week-4 retention** and trial→paid conversion.
Everything else is secondary.

---

## ⚠️ Reconciliation Notes

| Prior version | Status |
|---|---|
| Keyboard-first product ("assistive AI that drafts replies") | **Superseded, then physically deleted** (Gate 5.1) — the AI receptionist + payments rail is primary |
| "iMessage agent is primary surface" | **Superseded, then physically deleted** (Gate 5.3) — client channel is SMS + email only |
| Team Flynn crew number | **Physically deleted** (Gate 5.2) |
| "IVR, telephony, voicemail pipeline — Retired" | **Un-retired.** The AI receptionist (Twilio + Deepgram + Cartesia) answering real calls is now the primary acquisition wedge — see `a.md` Gate 2 |
| "Flynn never sends anything on its own" | **Updated** — Flynn sends proactively (re-engagement, confirmations, booking links on a missed call) but always confirms before irreversible actions |
| "Inbound Revenue OS" positioning | **Retired** |

**What is kept:** brand identity, mascot, design system (colors, typography, spacing, components), Supabase schema, Twilio, development rules.

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
2. **`OnboardingDesign` bypasses `.flynnType`** with raw `.font(.custom(...))` at sizes (13/15)
   that map to no token — `OnboardingDesign.swift:17` names it as the outstanding migration. (The
   sibling screens that shared this issue — `PracticeStepView`, `KeyboardTourStepView`,
   `OnboardingSteps` — were deleted with the keyboard extension in Gate 5.1.)
3. **23 fixed-size SF Symbols** (`.font(.system(size:))`) and **no `minimumScaleFactor` anywhere**
   despite several `.lineLimit(1)` labels.
4. **`FlynnColor.mascotOrange` is deprecated** with no call sites — safe to delete.

The gap in this app is *composition and motion*, not tokens. The token layer is good and
consistently applied. Spend the effort on hierarchy, rhythm, empty states and micro-interaction.

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
> "Flynn never sends") no longer apply — the keyboard is deleted. Flynn answers calls and sends
> invoices. It confirms before irreversible actions — that is the guardrail now, not manual
> insertion.

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

Flynn integrates via the **SMS agent tool-loop** (`services/agent/`, `FLYNN_TOOL_LOOP=1`) over the
self-hosted **Nango** OAuth backbone (`connect.flynnai.app`). Connectors live in
`data/integrations.tsx`; setup state tracked in `plans/integrations-tracker.md`. (Nango config is
via its management API with basic auth, not the dashboard — see memory `flynn-nango-poc-plan`.)

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
- **iOS:** the app Flynn ships is **`ios-native/`** (Swift/SwiftUI, XcodeGen `project.yml`, scheme `FlynnAI`, single target `FlynnAI` — the `FlynnKeyboard` extension target was deleted in Gate 5.1). Build/run it with Xcode/`xcodebuild`.
- **Android:** the Play app is **`android-native/`** (Kotlin), built via `gradlew`, but parked (Non-Goals) — do not build features against it unless explicitly asked.
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

- **v5.0.0** — Road to A$10k MRR: AI receptionist un-retired, keyboard/iMessage/crew-number
  physically deleted (August 2026)
  - Telephony (Twilio + Deepgram + Cartesia) is un-retired and now the primary acquisition wedge:
    an AI receptionist answers real calls, books the job, and texts a branded booking link
  - The FlynnKeyboard app extension, the BlueBubbles/iMessage/Sendblue relay + group-chat
    note-taker, and the Team Flynn crew-number surface are **deleted from the codebase**, not
    just demoted — client channel is SMS + email only
  - Two StoreKit tiers locked: Flynn Link A$29 / Flynn Receptionist A$69, 7-day trial, no free tier
  - Positioning: "Never miss a job. Never chase a payment." — the receptionist is the hook, the
    photo-invoice → auto-chase money tail is the differentiator
  - See `~/.claude/plans/i-am-back-after-elegant-canyon.md` and the live checklist in `a.md`
- **v4.0.0** — Payments-first pivot: app-primary, AI agent + keyboard as distribution wedge (July 2026)
  - New product: Flynn is a payments company with an AI skin — free invoicing, capped take-rate on payment volume, not SaaS seats
  - Swift iOS app becomes the primary surface (agent-first Home, voice-to-invoice); keyboard extension repurposed as the distribution wedge (draft + payment link into any chat app) — **superseded in v5.0.0, keyboard deleted**
  - iMessage/BlueBubbles demoted from primary channel to nice-to-have; clients reached via SMS + email — **superseded in v5.0.0, relay deleted**
  - Android parked (Swift only for now)
  - Core principle: automation (auto-chase, receipt filing, tax-sorting) only fires when payment clears on Flynn's own rail — this is the retention mechanic the take-rate model depends on
- **v3.0.0** — Pivot to assistive keyboard reply drafter + calendar booking (June 2025)
  - New product: screenshot/clipboard capture → keyboard drafts → tap to insert
  - Retired telephony system (IVR, Twilio, Deepgram Voice Agent, voicemail pipeline) — **un-retired in v5.0.0**
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
