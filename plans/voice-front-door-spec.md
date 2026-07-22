# Voice Front Door — Implementation Spec (handoff)

Context and Phase 0 decisions: `~/.claude/plans/flynn-build-mellow-valiant.md`.
This spec covers what remains after the backend funnel core (built 2026-07-22). It is written
for execution without further architectural decisions; anything genuinely ambiguous is marked
**HUMAN DECISION**.

## What is already built (do not rebuild)

| Piece | Where |
|---|---|
| Staging table `voice_onboarding_sessions` + `business_profiles.callout_fee_cents` | migration `202607221200_voice_onboarding_sessions.sql`, **applied to prod** |
| Funnel intake module: prompts, `save_business_profile` schema, staging upserts, post-call SMS, +24h/+72h re-engage sweep | `telephony/funnelIntake.js` |
| Voice Agent funnel mode (prompt/schema/greeting/function-handling/completion) | `telephony/deepgramVoiceAgent.js` (`session.mode === 'funnel'`) |
| Ad-number branch + TwiML | `server.js` `respondWithFunnelIntake`, branch at top of `handleInboundVoice` |
| Claim API: `GET /api/voice-onboarding/session`, `POST /api/voice-onboarding/claim` | `routes/voiceOnboarding.js` |
| Re-engage hooked into the 60s cron tick | `server.js` (`processFunnelReengage`) |
| Number pool table + `allocate_pool_number` RPC (FOR UPDATE SKIP LOCKED) | migration `202607221400_voice_number_pool.sql`, **applied to prod** |
| `POST /api/voice-onboarding/assign-number` (idempotent, rollback on failure, 503 `pool_empty`) | `routes/voiceOnboarding.js` |
| TTS provider env switch (`FLYNN_TTS_PROVIDER` = cartesia \| eleven_labs \| deepgram) with required `speak.endpoint` auth headers — the old Cartesia config silently omitted these and would fail | `telephony/deepgramVoiceAgent.js` `buildSpeakConfig` |
| iOS claim flow: `VoiceOnboardingClient`, `ReceptionistClaimFlow` (claim → code recovery → number → test call), RootView gate | `ios-native/FlynnAI/Networking/VoiceOnboardingClient.swift`, `Features/Onboarding/ReceptionistClaimFlow.swift`, `App/RootView.swift` — builds clean |

Sections 2 and 3 below are therefore DONE except: the pool has no numbers in it yet (ops), and
the forwarding screen ships as copy ("divert your missed calls… in Settings") rather than
tappable carrier codes — the HUMAN DECISION on forwarding-vs-direct framing still stands.

State machine (DB `voice_onboarding_sessions.state`):
`in_call → call_completed → sms_sent → claimed → receptionist_live` (+ `expired`).
`sms_sent` self-loops twice via re-engage. Second call from same phone: `saveFunnelConfig`
upserts and resumes (`RESUMING` prompt section). Expired rows are revived in place with a fresh
claim code. Different-number signup recovers via `POST /claim {code}`.

## Ops checklist (human, do first)

1. Buy a Twilio **AU local number** on the prod account (regulatory bundle: business address +
   ABN docs; allow days). Point its Voice webhook at
   `https://flynnai-telephony.fly.dev/telephony/inbound-voice` (POST).
2. `fly secrets set FLYNN_FUNNEL_NUMBERS=+61xxxxxxxxx` (comma-separated if several ad numbers).
3. Confirm `GEMINI_API_KEY`, `DEEPGRAM_API_KEY`, `CARTESIA_API_KEY`,
   `CARTESIA_VOICE_AU_FEMALE` are set on Fly (funnel routes to voicemail without the first two).
4. Buy 5–10 more AU numbers into the pool (step: Number pool below).
5. Register "FlynnAI" on the ACMA SMS Sender ID Register (ABN direct or via Twilio) — not
   blocking; onboarding SMS goes from the mobile long code `+61480891471`.
6. Meta: call-button ad creative pointing at the funnel number (existing ad account/pixel).

## 1. Barge-in acceptance test (gate before spending on ads)

Call the funnel number from a real mobile and run 20 scenarios; the agent must stop speaking
within ~300ms perceived and resume gracefully without repeating itself or losing extracted
state. Scenarios: interrupt mid-sentence ×5 (short "yeah", "nah mate", "hang on", long
correction, talk-over from word 1); background noise (ute cab, radio) ×3; slow hesitant answers
with "um… because…" pauses ×4 (agent must NOT barge in — Flux `eot_threshold: 0.85` is the
knob, raise toward 0.9 if it cuts people off); rapid-fire answers ×3; silence 5s+ ×2 (agent
should gently prompt, `eot_timeout_ms: 8000`); double-answer corrections ("Tuesdays… actually
Wednesdays") ×3 (config must hold the correction — verify row).
**If this fails after tuning `eot_threshold`/`eot_timeout_ms`: escalate to the LiveKit
contingency in the plan doc. Do not ship ads on a receptionist that interrupts.**

## 2. iOS first-run claim flow (`ios-native/`)

The magic link (`flynnai://auth/callback?token_hash=…`) already signs the user in
(`AuthStore.handleAuthCallback`) and the `on_auth_user_created` trigger creates the org. Build:

**a. `Networking/VoiceOnboardingRepository.swift`** — two calls against the backend
(`SERVER_PUBLIC_URL`, Bearer = Supabase access token, same pattern as existing repositories):
- `func stagedSession() async throws -> StagedSession?` → `GET /api/voice-onboarding/session`
  (`{found, state, business_config, call_count}`; `found:false` → nil)
- `func claim(code: String?) async throws -> ClaimResult` → `POST /api/voice-onboarding/claim`
  (`{claimed, business_config, business_name, receptionist_live}`; 404 with
  `code_required:true` → surface the code-entry screen)

**b. RootView gate** (`App/RootView.swift`): on `.signedIn`, if the user's org has no
configured receptionist yet, call `stagedSession()`. If found → present
`ReceptionistClaimView` before `MainTabView`. Never block the app on network failure — fall
through to MainTabView and retry next launch.

**c. `Features/Onboarding/ReceptionistClaimView.swift`**: one screen, one action. Shows what
Flynn learned on the call (trade, areas, hours, callout fee — read from `business_config`,
display only non-nil fields) with a single primary button "Bring her to life" → `claim(nil)`.
On 404/`code_required` → inline 6-char code field (alphabet has no 0/O/1/I/L; uppercase,
autocorrect off) → `claim(code)`. On success → number-assignment step (below), then MainTabView.
Design system: FlynnCard/FlynnButton per CLAUDE.md; mascot header (`Mascot` component).
Copy tone: "draft/insert" rules do not apply here; keep it plain and warm, no "AI" in headline.

**d. Deep-link cold-start caveat:** the https bounce (`/app/open`) falls back to the App Store;
after a fresh install the token in the original link is gone. First-run therefore must work
from a plain OTP sign-in too (it does — the gate is phone-keyed, not link-keyed). Show the code
field if `stagedSession()` finds nothing but the user says they called (button: "I have a code").

## 3. Number pool + go-live

**Table** (new migration `voice_number_pool`): `id, phone_number text unique, twilio_sid text,
status text check in ('available','assigned','quarantined') default 'available',
assigned_user_id uuid, assigned_org_id uuid, assigned_at timestamptz, created_at`.
RLS on, no policies (service-role only).

**Backend** `POST /api/voice-onboarding/assign-number` (authenticateJwt):
1. Claim-check: user must have a claimed session (state `claimed`).
2. Atomically allocate: `update voice_number_pool set status='assigned', assigned_user_id=…,
   assigned_org_id=…, assigned_at=now() where id = (select id from voice_number_pool where
   status='available' limit 1 for update skip locked) returning phone_number` (use an RPC —
   supabase-js can't express `for update skip locked`).
3. Write `users.twilio_phone_number = phone_number` (this is the key
   `getReceptionistProfileByNumber` routes inbound calls on — receptionist is live the moment
   this commits, reusing the existing tenant path).
4. Update session state → `receptionist_live`.
5. Return `{phone_number}`; the pool numbers' Twilio voice webhooks must already point at
   `/telephony/inbound-voice` (set when purchasing — reuse the existing purchase code at
   `server.js:~3446-3760` or set manually for the first batch).
6. If pool is empty: return 503 `{error:'pool_empty'}`, alert (console.error is enough for now),
   client shows "we're setting up your number, you'll get a text shortly" — **and a human tops
   up the pool**. Auto-purchase on empty is a later hardening task.

**iOS**: after claim success, call assign-number, then show the forwarding screen:
"divert your missed calls to your new number" with the AU conditional-forwarding codes
(`**61*<flynn-number>#` no-answer, `**67*<flynn-number>#` busy — render as tappable
`tel:` links with `%23` for `#`) and a "test it" button that just tells them to ring their own
mobile and not pick up. **HUMAN DECISION:** whether to also offer "or give out the Flynn number
directly" as the primary framing (skips carrier-code friction; weaker "on your number" story).

## 4. Trial paywall (StoreKit 2 + RevenueCat)

- Product: auto-renewable subscription `flynn_receptionist_monthly`, A$79/mo, **7-day free
  trial** (introductory offer), card required by construction on App Store.
- RevenueCat: entitlement `receptionist`; SDK already familiar — standard integration in
  `ios-native/` (App Store Connect product + RC dashboard config are human steps).
- **Gate placement:** paywall appears AFTER claim + number assignment + first test call
  ("make it permanent" moment), not before. The backend voicemail-gates unpaid orgs already
  (`handleInboundVoice` billing check: `organizations.billing_plan_id` / `subscription_status`
  must be `active|trialing`) — so on RC purchase/trial-start, a webhook or client call must set
  `organizations.subscription_status='trialing'`, `billing_plan_id='receptionist'`. **Check
  existing RC/StoreKit webhook handling in `telephony/webhooks/` first — App Store billing
  plumbing exists for the old plans; extend, don't duplicate.**
- Grace behaviour: trial lapses → receptionist reverts to voicemail (existing behaviour);
  send one SMS "your receptionist's paused, tap to bring her back" (reuse
  `funnelIntake` SMS pattern; add state or send from RC webhook handler).
- Usage cap for margin: log per-call minutes into `ai_call_usage` (already written by
  `handleRealtimeConversationComplete`); enforcement at 250 min/mo is a follow-up — build the
  counter query now, the block later. **HUMAN DECISION:** overage price vs $129 tier.

## 5. Cost telemetry

`handleRealtimeConversationComplete` currently logs a flat 40¢/call into `ai_call_usage`.
Replace with computed estimate: `duration_seconds/60 × (deepgram 0.0065 + gemini ~0.01 +
cartesia ~0.03 + twilio ~0.025) × 100` cents, and add a `funnel` boolean (funnel calls are CAC,
not COGS — exclude from tenant margin dashboards). Funnel calls don't hit that path today
(completion goes through `funnelIntake.completeFunnelCall`); add the same cost insert there
with `funnel: true` (needs an `ai_call_usage` column or a metadata jsonb — column preferred).

## 6. Ordered task list

1. Ops checklist items 1–3 (human) → funnel callable end-to-end in prod
2. Barge-in acceptance test; tune Flux thresholds; go/no-go
3. iOS: VoiceOnboardingRepository + RootView gate + ReceptionistClaimView
4. Number pool migration + RPC + assign-number endpoint + purchase/webhook setup for pool batch
5. iOS: number assignment + forwarding screen
6. RevenueCat product + entitlement + subscription-status sync into `organizations`
7. Paywall UI at the "make it permanent" moment
8. Cost telemetry upgrade + funnel flag
9. Full funnel dry-run with a stopwatch (<60s post-call user effort) before ads scale

## Verification (end-to-end)

Real mobile → call funnel number → conversational intake, barge-in clean → hang up → SMS
arrives <30s → tap link → TestFlight/App Store install → app opens signed-in (or OTP) →
claim screen shows the right config → number assigned → ring the assigned number: receptionist
answers with the captured business context → subscription row `trialing` after paywall.
Check `voice_onboarding_sessions` walks `in_call → call_completed → sms_sent → claimed →
receptionist_live`, and re-engage fires at +24h for an unclaimed test row (set `last_sms_at`
back manually to test).
