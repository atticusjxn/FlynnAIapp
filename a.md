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
- [ ] **1.6** ⚠️ **Needs a toggle in PostHog** — posthog-ios gates crash capture on *remote
      config*, not client code. Turn on Project settings → Error tracking → autocapture
      exceptions. Symbolication additionally needs dSYM upload via posthog-cli.
- [ ] **1.8** Build the funnel dashboard in the PostHog UI.

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

*There is no onboarding wizard today — it was deleted. An email-signup user never sees a
paywall, never gets a number, never sets up forwarding, and lands on an empty Home.*

- [ ] **2.1** Phone-OTP signup as the default. Fix `LoginView.swift:483` silently discarding
      the business name the form collects.
- [ ] **2.2** Trade picker → services + rough pricing, voice or type
      (reuse `POST /api/business-profile/parse`).
- [ ] **2.3** Calendar connect, skippable.
- [x] **2.4** **The demo call** — Flynn rings their verified number from a shared pool, seeded
      with what they just entered. Auth + OTP gated, rate-limited (the old `/api/call-me-back`
      would dial arbitrary strings — a toll-fraud vector on a billable endpoint). See detail below.
- [ ] **2.5** Post-call payoff: transcript, extracted job, booking-link preview.
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
- [ ] **2.8** Number provisioning after payment; real retry on `pool_empty`.
- [x] **2.9** **Server-verified forwarding** — Flynn test-calls their mobile; if the divert took,
      it lands on their Flynn number and fires `forwarding_verified`. Carrier-specific help for
      Telstra/Optus/Vodafone. Nobody finishes onboarding unverified.
- [ ] **2.10** Persist `users.forwarding_verified_at`, show state on Home and Settings.
- [ ] **2.11** Every step instrumented and resumable.

## Gate 3 — The branded booking link

- [ ] **3.1** Hosted page beside `routes/invoicePage.js` (do NOT revive the suspended
      `flynnai-booking-pages` Fly app).
- [ ] **3.2** Real availability — reuse `GET /api/booking/:slug/availability`, which works and
      is connected to nothing. ⚠️ Its calendar integration is currently dead: `bookingRoutes.js`
      requires `../src/services/CalendarIntegrationService`, which only exists as `.ts`, so it
      logs *"calendar sync disabled"* on every boot.
- [ ] **3.3** Auto-provision a booking page per tenant at number assignment.
- [ ] **3.4** Price disclosure (ACL obligation, not a nice-to-have).
- [ ] **3.5** Wire `smsLinkSender` into the AI path. The agent prompt promises *"I'll send you a
      booking link by SMS right now"* and never sends one.
- [ ] **3.6** Missed-call fallback (uses the existing unused `fallbackApology`).
- [ ] **3.7** Flynn-branded, "get this for your business" footer, sent/opened/booked tracked.
- [ ] **3.8** Both sides confirmed by SMS; writes a calendar event and a `jobs` row.
- [ ] **3.9** No deposit; built so opt-in deposit slots in later.

## Gate 4 — Bugs + Design rollout (6 passes, all committed, building clean on iOS 26 SDK)

- [x] **4.1** Keyboard dismissal — shared `dismissKeyboardOnTap()` applied at the tab-stack root
      + all 9 input sheets.
- [x] **4.2** Mic tap-starts-a-recording → 160ms hold-guard; a tap now shows "hold the mic to talk".
- [x] **4.3** Third haptic added; mic bigger (60pt), filled orange, glowing.
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
- [ ] **4.11** Delete dead-but-compiled UI (UsageBarCard, CalendarConnectCard, CallModeSelectorView,
      IVRScriptEditorView). **Deferred** — harmless, some goes with Gate 5's keyboard cut.

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

- [ ] **5.1** Remove `FlynnKeyboard` target, app/App Store/landing references, backend
      `api/keyboard/*`. Drop `draft_picks` with it.
- [ ] **5.2** Delete the Team Flynn crew-number surface.
- [ ] **5.3** Delete the BlueBubbles relay and `routes/iMessageInbound.js`.
- [ ] **5.4** Rewrite `CLAUDE.md` to the locked positioning.

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
