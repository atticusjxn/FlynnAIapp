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
- [ ] **0.5** CI/CD: GitHub Action test → deploy on merge to `main`. Stand up
      `flynnai-telephony-staging`.
- [ ] **0.6** Purge dead Telnyx secrets from Fly. Delete `telephony/realtimeHandler.js` (59KB),
      `cartesiaTTS.js`, `quoteLinkHandler.js`, `usageGuard.js`.
- [ ] **0.7** Set `CARTESIA_VOICE_AU_MALE` (absent — male voice falls through to a US default).

> **Deferred deliberately:** the `draft_picks` keyboard-sources migration. It exists only to
> let the keyboard write `'rewrite'`/`'chip'`, and Gate 5.1 deletes the keyboard — so the
> constraint gets dropped with it rather than widened for dead code.

## Gate 1 — Instrumentation

- [ ] **1.1** PostHog iOS SDK; identify on auth, alias the pre-auth anonymous id.
- [ ] **1.2** PostHog Node SDK in `server.js`, same distinct ids.
- [ ] **1.3** PostHog on the landing page; pass `fbclid`/UTM through to install attribution.
- [ ] **1.4** Ship the canonical event schema (below).
- [ ] **1.5** Mobile session replay ON (2,500/mo free) — watch people fail onboarding.
- [ ] **1.6** Error tracking + dSYM upload. A production crash is currently invisible.
- [ ] **1.7** Fix Meta CAPI: fire real server-side `StartTrial` / `CompletedRegistration`.
      `AppDelegate.swift:17` claims these exist; only `logPurchase` does.
- [ ] **1.8** Build the funnel dashboard.

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
- [ ] **2.4** **The demo call** — Flynn rings their verified number from a shared pool, seeded
      with what they just entered. Auth + OTP gated, rate-limited (the old `/api/call-me-back`
      would dial arbitrary strings — a toll-fraud vector on a billable endpoint).
- [ ] **2.5** Post-call payoff: transcript, extracted job, booking-link preview.
- [ ] **2.6** Rewrite `SubscriptionView` — it sells the deleted keyboard product and renders no
      features on any plan (`PlanDTO.features` is hardcoded `[]`).
- [ ] **2.7** Rebuild `FlynnAI.storekit`: two products, A$29 / A$69, 7-day (`P1W`) trials.
      Update `plans.apple_product_id`.
- [ ] **2.8** Number provisioning after payment; real retry on `pool_empty`.
- [ ] **2.9** **Server-verified forwarding** — Flynn test-calls their mobile; if the divert took,
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

## Gate 4 — Bugs

- [ ] **4.1** Keyboard dismissal — **12 screens have none** (whole Money form stack). Repo-wide
      there are 3 `onTapGesture` calls and none dismiss a keyboard.
- [ ] **4.2** Mic: a *tap* starts and aborts a recording, surfacing "Didn't catch that."
      (`VoiceHoldButton.swift:73-96`, `DragGesture(minimumDistance: 0)`, no hold guard).
- [ ] **4.3** Missing third haptic (documented at `:188`, doesn't exist); larger base size.
      *Amplitude reactivity is already real — don't rebuild it.*
- [ ] **4.4** Home "Recent activity" / "Waiting on your OK" not tappable — and the models carry
      **no id**, so there is nothing to navigate to. Add ids, then `NavigationLink`s.
- [ ] **4.5** The Calls tab doesn't exist, but "See all" and the deep-link router both select
      it — undefined shell state.
- [ ] **4.6** Real Terms / Support / Account screens (currently `PlaceholderDetailView`,
      reachable by deep link — App Store review exposure).
- [ ] **4.7** Notification labels describe the wrong keys.
- [ ] **4.8** 23 fixed-size SF Symbols + `minimumScaleFactor`. *Dynamic Type is otherwise fine.*
- [ ] **4.9** Remove the dead "Referrals are coming soon" (top drawer item).
- [ ] **4.10** "Play recording" is an empty action with hit-testing disabled.
- [ ] **4.11** Delete dead-but-compiled UI.

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
