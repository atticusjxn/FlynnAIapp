# End-to-End Telephony Test (iPhone + live server logs)

Hand this file to a fresh Claude Code chat. It has everything needed to drive a
real end-to-end test of the telephony changes on PR
[#8](https://github.com/atticusjxn/FlynnAIapp/pull/8) while watching the live
Fly.io server logs.

**Branch:** `flux-turn-detection-and-telnyx-to-twilio`
**Fly app:** `flynnai-telephony` (region `syd`)
**Public URL:** `https://flynnai-telephony.fly.dev`

## What changed (what we're verifying)
1. **AI receptionist turn-taking** — Deepgram Voice Agent now uses Flux
   (`flux-general-en`) so it stops cutting callers off.
2. **Telnyx → Twilio** — Twilio is the sole provider (provisioning, SMS, IVR).
3. **Mode A SMS-link IVR** — booking/quote DTMF menu rebuilt as Twilio TwiML.

---

## 0. Pre-flight (Claude runs these)

```bash
# Confirm flyctl is authed (the human must have run `flyctl auth login`).
flyctl auth whoami

# Confirm the Fly secrets the new code depends on are set (values are hidden).
flyctl secrets list -a flynnai-telephony
```

Required secrets — flag any that are **missing**:
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`
- `TWILIO_FROM_NUMBER` (AU Mobile sender for OTP + SMS links, e.g. `+61480891471`)
- `TWILIO_AU_BUNDLE_SID`, `TWILIO_AU_ADDRESS_SID` (AU regulatory bundle — **required for provisioning**)
- `DEEPGRAM_API_KEY`, `GEMINI_API_KEY` (AI receptionist)
- `SERVER_PUBLIC_URL=https://flynnai-telephony.fly.dev`

If `TWILIO_AU_BUNDLE_SID` / `TWILIO_AU_ADDRESS_SID` are missing, provisioning
returns `twilio_au_compliance_missing` — get those SIDs from the Twilio console
(Trust Hub → Regulatory Bundles / Addresses) and set them before Test A.

---

## 1. Deploy the branch

```bash
# From repo root, on branch flux-turn-detection-and-telnyx-to-twilio
git branch --show-current   # expect: flux-turn-detection-and-telnyx-to-twilio
flyctl deploy -a flynnai-telephony
```

Wait for `✓ ... deployed successfully`, then confirm it's live:

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://flynnai-telephony.fly.dev/health || true
```

---

## 2. Tail the logs (Claude keeps this running during the test)

```bash
flyctl logs -a flynnai-telephony
```

Useful greps while the human is on a call:
- Provisioning: `[Provision]`
- Inbound routing: `[Telephony]`, `call_routed_`
- AI receptionist (Flux): `[DeepgramAgent]`, `SettingsApplied`, `UserStartedSpeaking`, `AgentStartedSpeaking`
- IVR: `[IVR]`, `[TwilioIVR]`, `[SMS]`

---

## TEST A — Phone number provisioning (do this ONCE; don't burn budget)

**Goal:** confirm a real Twilio AU number gets purchased + assigned exactly once.

### Why you won't get charged 20 times
The endpoint `POST /api/telnyx/provision-number` (Twilio-only internally now) is
**idempotent per user**: if `users.twilio_phone_number` is already set, it returns
that number and does **not** buy another. So once your test account has a number,
re-running onboarding is free.

### Before testing — check current state
Use the Supabase MCP (project `Flynnai` = `zvfeafmmtfplzpnocyjw`, region
ap-southeast-2) to check your test account:

```sql
select id, email, twilio_phone_number, twilio_number_sid, has_provisioned_phone
from users where email = 'atticusjxn@gmail.com';
```

- If `twilio_phone_number` is **already set** → provisioning already worked; you do
  NOT need to buy again. Skip to Test B (or just confirm idempotency by running
  onboarding and watching for `[Provision]` returning the existing number).
- If it's **null** → proceed; the next run will buy ONE number (~A$6/mo + usage).

### Run it (one real purchase)
1. On the iPhone, complete onboarding through the paywall step (native app calls
   `provisionPhoneNumber()` → `/api/telnyx/provision-number`).
2. In the logs, expect exactly one:
   ```
   [Provision] Twilio AU Mobile number provisioned { userId, phoneNumber, phoneNumberSid }
   ```
3. Confirm in Supabase that `twilio_phone_number` is now set.

### Repeat onboarding tests WITHOUT buying again (pick one)
- **Easiest:** leave the number on the account. Idempotency means every later run
  returns the same number, zero charge.
- **Full reset loop without charges:** set dev-mode shared number so test accounts
  are assigned a fixed number instead of purchasing. Set these Fly secrets to the
  number you just bought, then redeploy:
  ```bash
  flyctl secrets set -a flynnai-telephony \
    TELNYX_DEV_MODE=true \
    TELNYX_DEV_SHARED_NUMBER='+61XXXXXXXXX' \
    TELNYX_DEV_SHARED_SID='PNxxxxxxxx' \
    DEV_TEST_EMAILS='atticusjxn@gmail.com'
  ```
  (The `TELNYX_DEV_*` names are legacy env keys — provisioning itself is Twilio.)
  Now you can null out `users.twilio_phone_number` and re-run onboarding as many
  times as you like; it assigns the shared number, never buys.

> ⚠️ Only null out `twilio_phone_number` with dev-mode ON. With dev-mode OFF, a
> null number + onboarding = a real purchase.

---

## TEST B — AI receptionist turn-taking (Flux)
**Setup:** test account `users.call_handling_mode = 'ai_receptionist'`.

1. Forward/call your provisioned Flynn number from a second phone.
2. **First thing to confirm in logs:** `[DeepgramAgent] ... Settings applied successfully`.
   - ✅ `SettingsApplied` → Flux config (incl. `eot_threshold`/`eot_timeout_ms`) accepted.
   - ❌ an `Error` event right after configure → the two `eot_*` fields need to move
     out of `listen.provider`. Tell Claude — it's a 2-line fix; the `flux-general-en`
     model swap still works without them.
3. **Interruption test:** while the agent is talking, start talking over it. It should
   stop and listen — NOT plough through, and NOT cut you off mid-sentence when you
   pause briefly. Watch `UserStartedSpeaking` / `AgentStartedSpeaking` interleaving.
4. Note any glitches, false cut-offs, or long silences for Claude.

---

## TEST C — SMS-link IVR (Mode A)
**Setup:** test account `users.call_handling_mode = 'sms_links'`, and in
`business_profiles` set `booking_link_enabled=true` + `booking_link_url`, and/or
`quote_link_enabled=true` + `quote_link_url`.

1. Call the Flynn number. You should hear the AU-voice menu:
   "Press 1 … booking link. Press 2 … quote form. Press 3 … voicemail."
2. **Press 1** → expect a booking-link SMS within a few seconds + log lines:
   `[IVR] DTMF input received: { digits: '1' ... }` and `[SMS] Sending booking_link ...`.
3. **Press 2** → quote-link SMS.
4. **Press 3** → "leave a message" → record a short voicemail → it should flow
   through `/telephony/recording-complete` (same as voicemail mode).
5. **Press nothing** → after ~6s the menu times out → voicemail fallback.
6. Confirm the SMS `from` is your Twilio number and includes "Reply STOP".

---

## TEST D — Voicemail-only mode (quick)
**Setup:** `call_handling_mode = 'voicemail_only'`. Call, leave a message, confirm
it transcribes and a job/lead is created (logs: `[Telephony] ... voicemail`).

---

## What to paste back to Claude
- The relevant `flyctl logs` lines for each test (esp. `SettingsApplied`,
  `[Provision]`, `[IVR]`, `[SMS]`).
- Whether each SMS arrived, and how the back-and-forth felt on the AI call
  (any cut-offs / glitches).
- Any error events, so Claude can fix and redeploy.
