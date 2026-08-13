# Flynn — Road to A$10k MRR

Live checklist. Gates, not dates. Full plan and reasoning:
`~/.claude/plans/i-am-back-after-elegant-canyon.md`

**Goal:** A$10k MRR by December 2026 ≈ **145 paying accounts** at A$69 blended,
on ~A$900/mo of Meta spend plus organic.

---

## Locked decisions

- **Positioning** — whole-loop, priced under the field. *"Never miss a job. Never chase a
  payment."* The receptionist is the hook; the money tail (invoice with photos → auto-chase →
  paid) is the differentiator no AU competitor leads with.
- **Pricing** — **A$29 Flynn Link** / **A$69 Flynn Receptionist**. 7-day card-required trial.
  No free tier. One source of truth: `services/pricing.js`.
- **Billing rail** — StoreKit IAP only (15% under Apple's Small Business Program).
  Revisit above A$25k MRR.
- **Onboarding** — guided wizard, value before paywall, paywall before number provisioning.
- **Value moment** — Flynn rings them live from a shared demo number, using the details they
  just entered.
- **Booking link** — real calendar availability + price disclosure, no deposit.
- **Analytics** — PostHog everywhere; Meta CAPI retained for ad optimisation.
- **Cut entirely** — keyboard extension, Team Flynn crew number, iMessage/BlueBubbles.

## Grounded assumptions

- ❌ *"Incumbents won't change"* — **falsified.** ServiceM8 Phone Agent (Sept 2025), Jobber AI
  Receptionist (Aug 2025), Housecall Pro CSR AI, Simpro Lightning (May 2026).
- ✅ The surviving version — all of them gate AI behind adopting their whole system first
  (Jobber Plus US$599, ServiceM8 Connect Plus). The one-van operator is under-served.
- ✅ *"The positioning is taken; the execution is not."* Johnni.ai, Voxworks (A$49), Sophiie,
  TransferToAI (A$99) all exist — but Rosie has zero App Store reviews, Johnni 19 Google
  reviews, none publishes scale. Every one is a demo-request form, not a self-serve app.
- ✅ **CPI A$1.50** stands (own measured AU data: CPM A$7.03, CPC A$0.47). Plan blended A$2–3.
- ✅ Trial→paid **30%** (ChartMogul GOOD band 25–35%). Churn **5%/mo**.
- ❌ Deposits on the booking link — AU customers resist on sub-A$1,500 service calls. ACL
  requires *disclosure* only.

---

# GATES

## Gate 0 — Ground truth ✅ COMPLETE

- [x] **0.1** Merge `voice-front-door` → `main`, deploy to Fly. *Prod was 61 commits behind and
      still running the seven-question intake that made ad leads hang up at 17s.* Now v287.
- [x] **0.1a** *(found)* `HEAD` could not boot — `server.js` and `toolRegistry.js` required
      `routes/sendblueInbound` and `services/imessageTransport`, neither ever committed. Fly
      deploys from the working tree so the running image had them; a CI deploy would have
      taken the backend down.
- [x] **0.1b** *(found)* `reminderScheduler` lazy-required `./twilioService`, which was never
      written — every scheduled reminder threw, burned its retries and landed as `failed`.
- [x] **0.1c** *(found)* Test suite was 18 failures / 3 red files: jest was applying the RN
      app's `babel-preset-expo` to the Node backend, which left `process.env` undefined inside
      `server.js`. Now **50/50 green**, up from 13.
- [x] **0.2** Delete the ungated number-purchase endpoints. Four in `server.js`, then a
      **second copy in `secureApiRoutes.js`** found by probing prod — including
      `DELETE /api/twilio/release-number`, which took a SID from the request body with **no
      ownership check**, letting any authenticated user disconnect any other tenant's
      receptionist. All 404 in prod.
- [x] **0.3** Kill the price contradiction. Funnel agent told every ad caller *"$79/mo after a
      7 day free trial"* while StoreKit shipped $29/$79/$179 on 14-day trials. Now one source
      of truth in `services/pricing.js`.
- [x] **0.4** Schema drift — baselined `users`, `plans`, `subscriptions`, `ai_call_usage`
      (all created out of band; a clean `db reset` produced a broken database). Verified as
      exact no-ops against prod by schema fingerprint.
- [x] **0.4a** 🔴 *(found)* **Unauthenticated database takeover.** `public.execute_sql(text)`
      was `SECURITY DEFINER`, owned by `postgres`, and granted to **`anon`** — the key that
      ships in the iOS bundle and the landing page JS. A sweep found **12 more** open the same
      way, including `merge_user_into` (account takeover) and `get_upcoming_events` /
      `get_user_stats` (any tenant's data, RLS bypassed). All 13 now service_role only.
- [x] **0.5** CI/CD: GitHub Action runs tests **and a clean-checkout boot check** on every push
      and PR, deploys to Fly only when `main` is green, then polls `/health` and fails the run
      if prod doesn't come back. Deploys now go through CI (v288, v289 landed this way).
      ⏸️ *Staging deliberately not stood up:* it would need its own Supabase project. Pointing
      `flynnai-telephony-staging` at prod would write test data into real tenants — worse than
      no staging.
- [x] **0.6** Dead Telnyx secrets purged from Fly. Deleted 77KB: `realtimeHandler.js` (59KB),
      `cartesiaTTS.js`, `quoteLinkHandler.js`, `usageGuard.js`.
- [x] **0.7** `CARTESIA_VOICE_AU_MALE` is set-but-**empty**, and `buildSpeakConfig` read that as
      "no Cartesia voice" and fell through to Deepgram's `aura-2-theia-en` — **an American voice
      answering the phone for an Australian tradie**, silently. Now falls back to the other AU
      voice and warns. ⏳ *Still needs a real male AU voice UUID from Cartesia's library.*

> **Deferred deliberately:** the `draft_picks` keyboard-sources migration. It exists only to
> let the keyboard write `'rewrite'`/`'chip'`, and Gate 5.1 deletes the keyboard — so the
> constraint gets dropped with it rather than widened for dead code.

## Gate 1 — Instrumentation ✅ (code complete; 3 dashboard actions left)

- [x] **1.1** PostHog iOS SDK (`Core/Analytics.swift`), identify on sign-in, reset on sign-out.
      Autocapture deliberately OFF so the named funnel steps aren't buried.
- [x] **1.2** PostHog Node SDK (`services/analytics.js`). **Verified live in prod:**
      `[Analytics] PostHog enabled` in the Fly logs on v289.
- [x] **1.3** Landing page already had a live project key — same project, so web/app/server
      land together. *(Web→app identity cannot join through PostHog; nothing survives the App
      Store handoff. That join is Meta CAPI + the phone bridge.)*
- [x] **1.4** Canonical event schema shipped in both, with a shared `distinctId` = Supabase
      user id so client and server events describe one person.
- [x] **1.5** Mobile session replay ON, text inputs masked.
- [x] **1.7** Meta CAPI now fires **StartTrial** and **Subscribe** server-side from the Apple
      webhook, carrying the click bridge. `AppDelegate` claimed these were logged from the
      views; they never were, so Meta had nothing downstream of the install to learn from.
- [x] **1.6** Enabled in PostHog (Settings → Error tracking → **Enable exception autocapture**,
      confirmed toggled on, project `Flannel` / 550834). ⏳ **Symbolication still open**: created a
      personal API key scoped to `error_tracking:write` on this project only
      (`flynn-ios-dsym-upload`), stored in the existing gitignored
      `ios-native/FlynnAI/Config/Secrets.local.xcconfig` pattern (never committed) — but I could not
      verify from here that `posthog-cli` actually supports iOS dSYM upload today (network access
      to check its docs/releases failed in this environment). Don't trust a build phase wiring this
      up unattended until that's confirmed; for now, crashes will report but may show unsymbolicated
      stack traces until dSYMs are uploaded some other way.
- [ ] **1.8** Build the funnel dashboard in the PostHog UI.
- [x] **1.9** Published. Google Auth Platform → Audience now shows **"In production"** for
      project `gen-lang-client-0768465473` (was Testing — the confirmed cause of the dead refresh
      token, silent since June 9: Testing mode expires refresh tokens after 7 days). Still pending:
      **reconnect Google Calendar once in the app** to mint a token that won't expire, and full
      verification (privacy-policy URL + calendar-scope justification) before the 100-user cap /
      "unverified app" screen go away — neither blocks the ad test. Code side already handles the
      interim: `invalid_grant` flips the connection to `reauth_required` instead of showing green
      forever, and booking availability fails open to bookings-only when calendars are unreachable.

> Verified: the project key accepts events (`{"status":"Ok"}`), iOS builds clean against
> PostHog 3.69.5, and the backend logs confirm initialisation in production.

```
app_installed · signup_started · signup_completed
onboard_trade_selected · onboard_services_entered · onboard_calendar_connected
demo_call_requested · demo_call_answered · demo_call_completed · demo_transcript_viewed
paywall_viewed · paywall_dismissed · trial_started · subscription_purchased
number_assigned · forwarding_code_dialled · forwarding_verified
call_answered · job_booked · booking_link_sent · booking_link_opened · booking_made
invoice_sent · invoice_paid · chase_sent
```

## Gate 2 — The onboarding funnel

*(Correction 2026-08-13: the note below claiming "there is no onboarding wizard" is stale.
`OnboardingWizard.swift`/`OnboardingWizardSteps.swift` exist and are real — welcome → trade →
business → calendar → demoCall → paywall → forwarding → done. Audited item-by-item against the
actual code before touching anything; see the precise PARTIAL/DONE status on each line below.)*

- [x] **2.1** Phone-OTP signup as the default. Fix `LoginView.swift:483` silently discarding
      the business name the form collects.
      Phone-OTP was already the default/primary CTA (`LoginView.swift:102-106`) — only the email
      fallback path had the discard bug. `AuthStore.signUp` now takes an optional `businessName`
      and, once a real session exists (not the email-confirmation-pending branch), PATCHes
      `/api/business-profile` with it — the same endpoint and shape the wizard's own
      `saveBusiness()` uses, so a name from either path lands the same way. Best-effort: never
      blocks or fails signup if the save fails. `xcodebuild` `BUILD SUCCEEDED`.
- [ ] **2.2** Trade picker → services + rough pricing, voice or type
      (reuse `POST /api/business-profile/parse`).
      **PARTIAL** — trade/services/pricing fields are real and PATCH `/api/business-profile`
      (`OnboardingWizard.swift:194-222`, `server.js:2619-2647`). "Voice or type" isn't built:
      `BusinessStep` is text-fields-only, never calls the `parse` endpoint, and doesn't reuse
      the existing `Features/Brain/BrainVoiceFill.swift` component.
- [ ] **2.3** Calendar connect, skippable.
      **PARTIAL** — skip is real (no forced wall, `OnboardingWizardSteps.swift:230-234`). Both
      Google/Apple rows are stubs that just fire analytics and advance
      (`OnboardingWizardSteps.swift:217-226`, literally commented `// BACKEND: real Google OAuth
      connect`) — no OAuth actually runs, despite `Core/GoogleCalendarConnect.swift` existing
      and working elsewhere in the app.
- [x] **2.4** **The demo call** — Flynn rings their verified number from a shared pool, seeded
      with what they just entered. Auth + OTP gated, rate-limited (the old `/api/call-me-back`
      would dial arbitrary strings — a toll-fraud vector on a billable endpoint). See detail below.
- [ ] **2.5** Post-call payoff: transcript, extracted job, booking-link preview.
      **PARTIAL** — transcript + extracted job are real and shown
      (`OnboardingWizardSteps.swift:341-371`, sourced from `GET
      /api/voice-onboarding/demo-call/:id`). No booking-link preview exists anywhere in the
      payoff card — "booking" only appears in the paywall's marketing copy.
- [x] **2.6** `SubscriptionView` no longer sells the deleted keyboard product — header rewritten
      to the locked positioning, `PlanDTO.features` now returns real per-plan bullets instead of
      hardcoded `[]`, CTA says "7-day" not "14-day". Visual/motion redesign is a separate pass
      (see Roadmap → UI/UX overhaul); this fixed the copy that actively lied.
- [x] **2.7** Rebuilt `FlynnAI.storekit`: two products, `com.flynnai.receptionist.monthly` A$69 /
      `com.flynnai.link.monthly` A$29, 7-day (`P1W`) free intro offers, matching `services/pricing.js`.
      `plans` table repurposed in place (starter→link, growth→receptionist, pro retired via
      `is_active=false`) and the change captured in migration `20260813020000_two_tier_plans.sql`
      so `supabase db reset` seeds the same two rows — `plans` was never seeded by a migration
      before this, so a fresh reset booted with an empty catalog. Stale `google_product_id`
      values (pointed at the old starter/growth ids) nulled out; Android is parked so nothing
      reads them today. **App Store Connect side done too**: created `Flynn Receptionist Monthly`
      ($69.99 AUD, level 1) and `Flynn Link Monthly` ($29.99 AUD, level 2) in the `Flynn
      Subscription` group — availability all 175 territories, English (U.S.) localization, 7-day
      free intro offer on both, matching product IDs. Deleted the 3 old draft tiers
      (starter/growth/pro — never submitted, no real customers). Both new subscriptions are
      "Prepare for Submission"; they go live with the next app version submission.
      *(found while here)* the 3.0.3 rejection (Guideline 2.1.0, "app didn't respond when tapped
      on start free trial") lines up exactly with this — the old subscriptions were still in
      draft/never-submitted state when that build was reviewed, so `Product.products(for:)` had
      nothing real to resolve. Should be moot once this version ships with real products behind it.
- [x] **2.8** Number provisioning after payment; real retry on `pool_empty`.
      `OnboardingModel` now tracks `poolEmpty` distinctly from the brief `working` flag.
      `ForwardingStep` shows an honest "we're out of numbers right this second" card instead of
      silently jumping to `.done`, with a real **Try again** (re-calls `assignNumber()`) and an
      honest "I'll finish this later" (no longer implies a text is coming — nothing sends one).
      Closed the same dead end in Settings: `CallForwardingView`'s `noNumberCard` used to just
      say "once your receptionist is set up you'll get your own number" with no way to act on
      it — now has a real **Get my number** button (`CallForwardingStore.getMyNumber()`, same
      `VoiceOnboardingClient.assignNumber()` call) so anyone who skipped past `pool_empty` during
      onboarding can retry from Settings later, distinguishing pool-empty / subscription-required
      / other-error states. Home's forwarding banner (2.10) now also fires on **no number at
      all**, not just unverified — a `pool_empty` skip used to be invisible there too.
      `xcodebuild` `BUILD SUCCEEDED`, `npx jest` 63/63.
- [x] **2.9** **Server-verified forwarding** — Flynn test-calls their mobile; if the divert took,
      it lands on their Flynn number and fires `forwarding_verified`. Carrier-specific help for
      Telstra/Optus/Vodafone. Nobody finishes onboarding unverified.
- [x] **2.10** Persist `users.forwarding_verified_at`, show state on Home and Settings.
      `DashboardStore` now loads `twilio_phone_number`/`forwarding_verified_at` alongside the
      rest of the profile and exposes a `receptionistStatus` (`.ok`/`.noNumber`/`.unverified` —
      widened while fixing 2.8 below, since a `pool_empty` skip needed its own banner state too).
      Home shows a quiet banner — only when it needs attention, nothing shown when verified,
      matching the "one hero, everything else quiet" design thesis — linking straight into
      Settings → Divert your calls via `deepLink.pending`. That screen now has a real
      status card (verified/not, with a timestamp) and a **"Check it's working"** button that
      calls the same `startForwardingVerify`/poll flow the onboarding wizard uses, so anyone who
      skipped it — or changed carriers since — can re-verify without redoing onboarding.
      `xcodebuild` `BUILD SUCCEEDED`.
- [x] **2.11** Every step instrumented and resumable.
      **Timing fix**: `advance(to:)` no longer auto-fires an event for the step being entered —
      that was firing `onboard_calendar_connected`/`onboard_trade_selected`/
      `onboard_services_entered`/`forwarding_code_dialled` the instant a screen *appeared*, then
      again (correctly) on the real action, double-counting the funnel. Each event now fires only
      at its true completion point: trade pick's Continue button, `saveThenNext()` after the
      business PATCH actually succeeds, the calendar step's real connect taps (unchanged), and
      `dialForwarding()`'s real dial (unchanged). `paywall_viewed` moved from a button-tap fire to
      a real `.onAppear` on `PaywallStep`, since "viewed" should mean seen, not tapped.
      `signup_completed` also used to re-fire on every resume — now gated to a genuinely fresh
      start (`step == .welcome`).
      **Resumability**: `OnboardingModel` persists a small `Codable` snapshot (step, trade,
      business fields, `forwardingDialled`) to `UserDefaults` on every `advance(to:)`, restored in
      `init()` — an app kill mid-flow now resumes where it left off instead of restarting from
      `.welcome` and silently losing everything typed. Deliberately excludes ephemeral
      server-owned state (the assigned number): resuming at `.forwarding`/`.done` calls
      `rehydrateIfResumed()` to re-fetch `twilio_phone_number` from the account row instead,
      since numbers/entitlements can genuinely change between launches and the account is the
      source of truth, not a stale local cache. Cleared on `markComplete()` (both real finish and
      skip, which already routes through it).
      `xcodebuild` `BUILD SUCCEEDED`, `npx jest` 63/63.

## Gate 3 — The branded booking link

> **Found on entry:** worse than the audit thought. Prod had **130 business profiles with
> `booking_link_enabled = true` and exactly zero `booking_link_url`s** — so the receptionist wasn't
> just failing to send the link, there was no link in existence to send. The one tenant with a live
> Flynn number had no booking page; the one booking page that existed belonged to an org with no
> number.

- [x] **3.1** Hosted page at `/b/:slug`, server-rendered by the telephony app beside
      `routes/invoicePage.js` (same pattern: one origin, inline CSS, no external requests, OG tags).
      Confirmed the audit's instinct was right and then some — `booking-pages/` isn't merely
      suspended, its `next.config.js` rewrites `/api/*` to `http://localhost:3000`, which cannot
      resolve from its own Fly machine, so it could never have loaded a slot in production.
- [x] **3.2** Availability now honours the page's **timezone** (it used `setHours()`, i.e. the
      *server's* zone — a Sydney 9-5 came out 10-11h off on a UTC Fly machine), plus
      `booking_notice_hours` and `max_days_advance`, both configured on every page and applied by
      nothing. Regression tests cover AEST, AEDT, non-DST Perth, NZ and month/year boundaries.
      ~~⚠️ Google Calendar free/busy is still **not** consulted~~ **Closed**: availability and the
      book-time re-check now consult the tradie's real calendars — Google via the org's
      `integration_connections` (token refresh included), Apple via the SMS agent's stored
      credentials — merged with the page's own bookings, failing open to bookings-only when a
      calendar errors. The dead `../src/services/CalendarIntegrationService` require (a React
      Native `.ts` file Node can't load) is gone. **Gated on 1.9**: the only Google connection in
      prod has a refresh token dead since June (Testing-mode OAuth), so free/busy has no live data
      until the consent screen is published and the calendar reconnected.
- [x] **3.2a** *(found)* `POST /api/booking/:slug/book` returned **409 "no longer available" for
      every booking after the first one a page ever took** — the overlap test was an `.or()` of the
      two halves of an interval comparison, so a booking next month matched `end_time > new.start`.
      Chained filters are ANDed; fixed.
- [x] **3.3** Auto-provisioned at number assignment via `services/bookingPage.js`, idempotent, and
      mirrored onto `business_profiles.booking_link_url` keyed on **org_id** (all 130 profiles carry
      an org; only 27 carry a user, so keying on user would have skipped most tenants). Backfilled
      the one live tenant through the real code path.
- [x] **3.4** Price disclosure — call-out fee and pricing notes render *above* the form, per ACL.
- [x] **3.5** The post-call confirmation SMS now carries the link and fires `booking_link_sent`.
- [x] **3.6** Missed-call fallback. A call that connected but booked nothing used to end in
      silence — caller hung up mid-flow, agent never got a service type, or the Deepgram session
      dropped and they heard nothing; `sendBookingConfirmationSms` returned early in all of those
      and sent no text at all. Now the confirmation reports whether it sent, and when it didn't the
      caller gets the booking page prefixed with *"Sorry we just missed you"* — the `fallbackApology`
      option that had sat unused since it was written. Routed through `smsLinkSender` so it inherits
      the per-tenant template, the transient-error retry and the `sms_sent` `call_events` row.
- [x] **3.7** Flynn-branded, "Get this for your business" footer; `booking_link_sent` →
      `booking_link_opened` → `booking_made` all firing.
- [x] **3.7a** **Page rebuilt to the Flynn design system** — cream ground / warm-brown dark mode,
      ink 3px outline on exactly one hero card (the time picker), Space Grotesk over Inter, single
      orange chunky offset-shadow pill CTA. Day chips (closed days pre-skipped), slot skeletons,
      client-side day cache with stale-response guard, CTA restating the chosen time, 409 explains
      itself and refreshes slots in place, success screen with Add to Google/iPhone calendar,
      honeypot, 16px inputs (no iOS zoom), focus-visible rings, reduced-motion respected. Plus
      `/b/:slug/og.png` — a sharp-rendered branded unfurl card so the link previews as the
      business's booking card in iMessage (302 static fallback so previews never break).
- [x] **3.8** A confirmed booking now writes back a Google/Apple calendar event (ids stored on
      the `bookings` row) and mirrors into **`jobs`** (source `booking_page`, scheduled date/time
      in the business's zone) so online bookings appear in the app next to call-booked work —
      `bookings` is a table the app never reads. Customer/business notifications were already
      firing. `POST /book` also gained a honeypot, per-IP rate limit, phone/time-range validation,
      and server-derived `duration_minutes`.
- [x] **3.9** No deposit; the page is structured so an opt-in deposit slots in later.

## Gate 4 — Bugs + Design rollout (6 passes, all committed, building clean on iOS 26 SDK)

- [x] **4.1** Keyboard dismissal — shared `dismissKeyboardOnTap()` applied at the tab-stack root
      + all 9 input sheets.
- [x] **4.2** Mic tap-starts-a-recording → 160ms hold-guard; a tap now shows "hold the mic to talk".
- [x] **4.3** Third haptic added; mic bigger (60pt), filled orange, glowing.
- [x] **4.3a** *(found — your simulator report)* **The mic latched on after the first-run permission
      grant.** Reproduced on a clean install every time: hold the mic, the Speech Recognition alert
      takes the touch, accept, and the bar sticks on "listening..." forever with the meter running
      and nobody holding the button. `startListening()` spans two permission round-trips, but every
      stop path gated on `isListening`, so a release landing mid-start no-op'd and the awaited start
      then opened the recogniser with no finger down. Fixed with a `stopRequested` flag re-checked
      after each `await`, plus unconditional stops on release/cancel/background/disappear.
      Two more defects fixed in the same pass, both found by inspection rather than reproduced:
      teardown called `endAudio()` *before* stopping the engine and removing the tap, leaving a
      ~21ms window where the realtime audio thread could `append` to an ended request — an ObjC
      exception Swift can't catch, i.e. a hard crash, and the likely explanation for it being
      intermittent; and Home/Brain/the contextual bar each own a `VoiceCaptureManager`, so two
      engines could run on the one shared `AVAudioSession` with whichever stopped first
      deactivating it under the other. ⏳ *Final visual re-verification pending — the Mac screen
      locked mid-test. Build is clean and the latch-on logic is fixed; worth one more clean-install
      hold to confirm before ads.*
- [x] **4.4** Home "Recent activity" tappable (opens full message); "Waiting on your OK" gets real
      Confirm/Cancel routed to the agent.
- [x] **4.5** Calls tab undefined-state fixed — real `Route.callsList` pushes `CallsListView`.
- [x] **4.6** Real `SupportView` / `LegalView` (Terms) screens; Account routes to `AccountView`.
- [x] **4.7** Notification labels corrected (`new_call` → "Calls answered", `usage_warning` →
      "Usage warning"; trial "3 days" claim dropped).
- [ ] **4.8** 23 fixed-size SF Symbols + `minimumScaleFactor`. *Dynamic Type is otherwise fine.*
      **Deferred** — mostly icons, low impact.
- [x] **4.9** Dead "Referrals are coming soon" drawer row removed.
- [x] **4.10** "Play recording" is now a real button that opens the recording.
- [x] **4.11** Delete dead-but-compiled UI (UsageBarCard, CalendarConnectCard, CallModeSelectorView,
      IVRScriptEditorView). Already gone — confirmed zero remaining references anywhere in
      `ios-native/` (done as part of the Design rollout's "Dead UI deleted" pass below; this
      checkbox was just stale).

### Design rollout (beyond the bug list)

- [x] **Design thesis** — kept the mid-century identity; killed the uniform brutalism. One hero
      per screen, everything else quiet. Real iOS 26 Liquid Glass on the floating bars.
- [x] **Home** rebuilt — money hero, quiet everything-else, floating glass agent bar, unified tabs.
- [x] **Agent bar + ContextualVoiceBar** — both the same floating Liquid Glass capsule + big mic,
      on Home and every detail screen.
- [x] **All 5 tabs** — unified filled icon set (multicolour brain → sparkle), branded empty
      states, pressable rows.
- [x] **All detail screens** (client/invoice/quote/event/call) — graduated hierarchy.
- [x] **Settings** rebuilt off the stock inset-List onto Flynn's grouped quiet cards.
- [x] **CLAUDE.md design system** rewritten to the real Swift tokens.
- [x] **Money segmented control** — calmed to a raised thumb with orange text.
- [x] **Dead UI deleted** (UsageBarCard, CalendarConnectCard, CallModeSelectorView,
      IVRScriptEditorView, PlaceholderTabView).
- [x] **Onboarding wizard built** — welcome → trade → business → calendar → demo call →
      paywall → number → forwarding → done, to the new bar, PostHog on every step, wired to
      the real endpoints (business save, gated number assign, StoreKit paywall). Two backend
      seams left, marked `BACKEND` and degrading gracefully:
      - [x] **Gate 2.4** — the live demo call is **built and deployed** (v296): rings the user's
        own verified mobile, connects them to their receptionist (seeded from what they entered),
        captures the transcript + extracted job into `demo_calls`, and the wizard polls for the
        payoff. Dials only the user's OTP-verified number, rate-limited, tenant call path
        untouched. ⏳ *Needs a real-device pass before ads.*
      - [x] **Gate 2.9** — server-side forwarding verification is **built and deployed, flag-gated
        OFF** (`FLYNN_FORWARDING_VERIFY`). Places a test call to the user's mobile; the forwarded
        call reaching their Flynn number is the proof (writes `users.forwarding_verified_at`).
        Touches the live inbound path, so it's a strict no-op until the flag is on. ⏳ **Turn on
        only after validating on a real AU phone + a diverted Flynn number** — the `**61*`
        no-answer forward is carrier-specific. iOS forwarding step wired with an honest
        verify/retry path; falls back to user confirmation when off.

> **Validation runbook for 2.4 + 2.9** (needs a real AU phone):
> 1. Sign up in TestFlight with a real mobile, run onboarding to the demo-call step, tap "Call me
>    now" — Flynn should ring you, talk as your receptionist, and the payoff should show your real
>    transcript + extracted job. Check `demo_calls` and that no job/SMS hit your real account.
> 2. Assign a number, dial the divert code, `fly secrets set FLYNN_FORWARDING_VERIFY=1`, tap
>    "Check it's working", let the test call ring out — it should verify and stamp
>    `forwarding_verified_at`. Repeat on a second carrier before trusting it.
- [x] **Both themes verified** (light cream + dark warm brown).

## Gate 5 — Surface cuts

- [x] **5.1** Remove `FlynnKeyboard` target, app/App Store/landing references, backend
      `api/keyboard/*`. Drop `draft_picks` with it.
  > Deleted the `FlynnKeyboard` app-extension target from `project.yml`, all
  > `ios-native/FlynnKeyboard/` and keyboard-only `Shared/` sources (`KeyboardDraftClient`,
  > `DraftModels`, `SharedStore`, `SavedMessage`, `PendingCalendarEvent`, `SharedSecureStore`,
  > `SharedConstants`), and every app-side call site (`KeyboardBridge`, `KeyboardSetupFlow`,
  > the onboarding keyboard tour, `SavedMessagesView`, `PendingCalendarStore`/
  > `PendingEventConfirmView`, Settings/Integrations/Dashboard rows). Dropped the App Group +
  > shared-keychain entitlements now nothing reads them. Regenerated the Xcode project via
  > `xcodegen generate` and confirmed a clean `xcodebuild` (`BUILD SUCCEEDED`).
  > Backend: deleted the `api/keyboard/*` route block in `server.js` (provision-token,
  > draft-replies, quick-context, compose, accept-draft, add-calendar-event), keeping the
  > helpers still shared with live endpoints (`computeGoogleSlots`/`DEFAULT_BUSINESS_HOURS` for
  > `/api/calendar/propose-slots`, `isUserEntitled`/`draftsUsedToday`/`FREE_DRAFTS_PER_DAY` for
  > `/api/quote-style`). Removed `composeFromShorthand`/`buildComposePrompt`/
  > `DEFAULT_COMPOSE_COUNT` from `services/draftReplies.js` (kept `generateDrafts`/
  > `parseBooking`, still used by the live SMS agent path). New migration
  > `20260813030000_drop_draft_picks.sql` drops the table rather than editing history.
  > Rewrote keyboard mentions on the landing page (`Footer.tsx`, `Features.tsx`,
  > `LandingPage.tsx`) to the free-invoicing/payments-first framing, and flagged
  > `app-store-metadata-v3.md`/`play-store-screenshots/README.md` as superseded rather than
  > word-patching docs that get a full rewrite in Gate 6.2. `npx jest` 63/63, boot check green.
  > **Not touched:** `android-native/`'s parallel keyboard/IME — Android is already a parked
  > non-goal, so it was deliberately left alone rather than pulled into this gate.
- [x] **5.2** Delete the Team Flynn crew-number surface.
- [x] **5.3** Delete the BlueBubbles relay and `routes/iMessageInbound.js`.
  > Deleted `routes/iMessageInbound.js`, `routes/sendblueInbound.js`, `services/blueBubbles.js`,
  > `services/sendblue.js`, `services/imessageTransport.js`, and all of `services/groupAgent/`
  > (the group-chat note-taker — cut alongside iMessage per the locked answer earlier this
  > session, since it depended entirely on the BlueBubbles relay). Removed the two webhook
  > mounts and the group-digest scheduler tick in `server.js`, and replaced the BlueBubbles-first
  > send in `/api/auth/app-link`'s fallback with SMS-only (it was already the fallback, now
  > it's the only path). `services/flynnOutbound.js` lost its iMessage branch/retry/typing-
  > indicator logic entirely — `resolveChannel` now always returns `'sms'` (kept as a no-op for
  > callers that still branch on it) — and gained a `sendAttachment` (MMS via Twilio) so
  > `services/reengagementScheduler.js` and `services/agent/toolRegistry.js` (which used to pull
  > it from the now-deleted `imessageTransport`) keep working unchanged. `routes/webSignup.js`'s
  > contact vCard now always serves the Twilio SMS number — it used to resolve a separate
  > `FLYNN_IMESSAGE_NUMBER`, which was the "dead inbox" risk flagged in the plan. Rewrote the
  > landing page's `PhoneSignupChat.tsx`/`MessageFlynnCTA.tsx` to drop iMessage-specific
  > copy/icon naming (SMS `sms:` links were already in use under the hood, so this was framing
  > only) — safe per the locked answer that no Meta ads are currently live against that CTA.
  > Fixed stale `iMessageInbound.js` references in `services/agent/agentLoop.js`'s system
  > prompt and doc comment, `routes/trackingRoutes.js`, and `routes/dashboard.js` to point at
  > `routes/smsInbound.js`/describe SMS instead. New migration
  > `20260813040000_drop_group_chats.sql` drops `group_action_items`/`group_messages`/
  > `group_members`/`group_chats` (child-to-parent FK order) rather than editing history.
  > Flagged `.claude/commands/flynn-imessage-replay.md` (a personal demo-recording tool, not
  > product code) as broken now that `services/blueBubbles.js` is gone, rather than silently
  > leaving a slash command that fails on first use. `npx jest` 63/63, boot check green.
  > **Note:** this gate was first attempted by a background agent that stalled mid-edit
  > (`services/agent/toolRegistry.js`); its completed partial work was reviewed file-by-file
  > and found correct before finishing the rest directly.
- [x] **5.4** Rewrite `CLAUDE.md` to the locked positioning.
  > Full rewrite: "What Flynn Is" now leads with the AI receptionist as the acquisition hook
  > (positioning: "Never miss a job. Never chase a payment.") with the A$29/A$69 StoreKit tiers,
  > instead of the old keyboard-era framing. Un-retired telephony in the Reconciliation Notes
  > table (it previously said "IVR, telephony, voicemail pipeline — Retired", which was flatly
  > wrong given Gates 0-4 this session). Removed the Team Flynn surface section and the keyboard
  > extension surface entirely; Non-Goals now explicitly lists all three Gate 5 cuts as physically
  > deleted, not just demoted. Fixed the Design System's "Known inconsistencies" list (it named
  > three files — `PracticeStepView`/`KeyboardTourStepView`/`OnboardingSteps` — that Gate 5.1
  > deleted) and the dev-rules line claiming a `FlynnKeyboard` Xcode target still exists. Softened
  > the onboarding-sequence claim in Surfaces to point at `a.md` Gate 2 rather than imply the
  > funnel is fully wired (it isn't — 2.1/2.2/2.3/2.5/2.8/2.10/2.11 are still open). Added a
  > v5.0.0 Version History entry. Verified every pricing/product-id claim against the actual
  > `2.7` entry above before writing it down.

## Gate 6 — Launch

- [ ] **6.1** Full funnel on a real device, real card, real carrier divert; every event verified.
- [ ] **6.2** App Store submission with new tiers and matching screenshots.
- [ ] **6.3** Landing page aligned: two tiers, 7-day trial, no keyboard.
- [ ] **6.4** Meta app-install campaign live, A$40/day, 5 creatives.
- [ ] **6.5** **Kill gate, 7 Sept 2026** (~A$840 spend, ~300–450 installs):
      **<5 paying** → kill or hard-pivot the wedge · **10–20** → fix the largest leak ·
      **>20** → raise spend. Target **10 paying** = A$690 MRR, CAC ≈ A$84.

---

## Roadmap beyond the gate

- [ ] **UI/UX overhaul** — dedicated session. The token system is good; the gap is composition
      and motion, not tokens.
- [ ] **AU telco compliance** — **IPND** filing within one business day of number activation
      (real penalties for a reseller). Call-recording disclosure: all-party consent nationwide
      is the safe design. AI self-identification (ACL s18).
- [ ] **Payments rail** — Stripe Connect + flat-fee PayID. The compounding layer.
- [ ] **Auto-chase** — the retention mechanic; fires only when payment clears on Flynn's rail.
- [ ] **Retention instrumentation** — week-4 retention as the north star.
- [ ] **Organic distribution** — `tiktok-slides` skill, founder content, SEO off the booking link.
- [ ] **Opt-in deposits**, per job type, default off.
- [ ] **AI ad creative** via Hicksfield MCP once PostHog shows in-ad drop-off.
- [ ] **Onboarding A/B tests** on PostHog feature flags — paywall placement first.
- [ ] **Structured backend logging** (pino + Fly log drain).
- [ ] **Retire `execute_sql`** once `supabaseMcpClient` stops issuing raw SQL.
- [ ] Rate-limit `send-sms` / `extract-job` / `lookup-carrier` in `secureApiRoutes.js` —
      billable and unthrottled, though not cross-tenant.
- [ ] *(found during 2.7)* `telephony/scheduled/usageWatcher.js` queries a view `v_current_usage`
      that **does not exist** in the database (not in any migration — created out-of-band like
      `plans`/`users` were, per 0.4, except this one was never reconstructed). The hourly cron
      has been silently failing and returning `{checked:0, sent:0}` since whenever it was written
      — the 80%/100% AI-minutes usage-warning push has never fired. Needs the view's intended
      join (plans + subscriptions + `ai_call_usage`) designed and migrated; out of scope for 2.7.
- [ ] *(found during 2.7)* `server.js:5076-5212` (`POST /voice/profiles/:id/clone`) is a live,
      ElevenLabs-backed voice-cloning endpoint gated only by auth + ownership — no plan check,
      no feature flag. Voice cloning is an explicit CLAUDE.md Non-Goal. Currently orphaned (no
      caller in `ios-native/`, only the retired Expo app used it) but reachable by any
      authenticated user today. Worth deleting outright rather than leaving a Non-Goal live.

## Risks

1. **This is a re-commitment.** The 7 Sept gate exists so the next call is made on numbers.
   Honour it in both directions, including "raise spend".
2. **The demo call is the single point of failure.** Test on three AU carriers before spend.
   There is currently **no mid-call fallback** — if Deepgram fails after TwiML returns, the
   caller gets silence and a dropped call.
3. **Carrier divert happens outside the app.** Most likely place the funnel dies; 2.9 is why.
4. **ServiceM8 can bundle you out** at A$79. The answer is the money tail and a price under it.
5. **Session cache is in-process** — the call WebSocket must land on the same Fly machine as
   the webhook. Holds at `min_machines_running = 1`; breaks on scale-out.
