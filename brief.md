# Flynn — Keyboard v2 brief

Context handoff for a fresh Claude session. Written 2026-07-25.

---

## What Flynn is

A payments company with an AI skin, not a SaaS company with payments attached. Free, unlimited
invoicing for solo tradies and small crews; revenue is a capped fee on payments that clear through
Flynn's own rail, not a subscription seat. Beachhead is AU/NZ trades.

**Current go-to-market beachhead is the AI voice receptionist**, not the keyboard: a prospect calls a
number from a Meta ad, the AI receptionist *is* the demo, and its intake questions double as the
config interview. The keyboard described below is a **retention/expansion feature for operators
already onboarded through that funnel** — it cannot be top-of-funnel, because it needs the app
installed, Full Access granted, and a keyboard switch, which is three walls before first value.

Primary surface is the native Swift iOS app (`ios-native/`). Backend is Node/Express on Fly.io
(`flynnai-telephony.fly.dev`). Data is Supabase (`zvfeafmmtfplzpnocyjw`, ap-southeast-2). LLM is
Qwen3.5-flash via DashScope.

---

## What was just built

The keyboard extension was previously built around a capture chain: Action Button → Shortcut →
screenshot → base64 → server OCR → staged draft → open keyboard. **That is now deleted.** It was too
many steps, and a screenshot is thinner context than what the app already holds.

### The constraint that shapes everything

An iOS keyboard extension **can only read the text field the cursor is in** — via
`documentContextBeforeInput`, which iOS truncates for privacy. It cannot read conversation history,
cannot select text, and is capped near 30–60 MB. That limitation is *why* the screenshot hack
existed: it was the only way to see the customer's message.

So Flynn cannot infer a reply to a message it cannot see. **The operator's own typed shorthand is now
the brief.** This is a better trade: context comes from real invoices, pricing and calendar rather
than from pixels.

### Two modes

1. **Chips** (idle state, zero latency) — one-tap inserts of real data: next genuinely-free calendar
   slots, a pay link for an open invoice, their hourly rate / call-out fee. Painted **synchronously
   from an App Group cache** so they are on screen at first paint, then refreshed in the background.
   This matters because the extension is relaunched on nearly every keyboard switch and gets a fresh
   `URLSession` each time (no TLS resumption), so a network-first chips row would visibly pop in late
   every single time.

2. **Polish** — the operator types shorthand on the *system* keyboard ("quote 450 deck, free thurs"),
   switches to Flynn, taps Polish. Flynn returns 3 send-ready options in the existing card carousel.
   Tapping one replaces what they typed.

**Flynn never sends.** It inserts; the operator hits send in their own app (HiPages, WhatsApp,
iMessage). No QWERTY was built — typing stays on the system keyboard, and Flynn remains a picker
surface, which is what it already was.

---

## Deployment status — read this carefully

| Thing | Status |
|---|---|
| iOS app on App Store | **Live**, `MARKETING_VERSION 3.0.2`, build 114 |
| Keyboard v2 in that live build | **NO.** Not shipped. |
| Keyboard v2 code | Committed + pushed to branch `voice-front-door` (`e82bcb9`). Not merged to `main`. |
| New backend endpoints | **Not deployed** to Fly. Code is on the branch only. |
| `draft_picks` migration | **Not applied** to prod. See prerequisite below. |
| Voice funnel (the beachhead) | Substantially built on the same branch; still needs an AU ad number bought and TTS env vars set. Parked to do the keyboard; resume after. |

So: the App Store build is current, but it does **not** contain any of this. Nothing here is in front
of a user yet.

### Deploy prerequisite (blocking)

`supabase/migrations/20260725000000_draft_picks_keyboard_sources.sql` must be applied.

`draft_picks.source` in prod is still `CHECK (source IN ('clipboard','screenshot'))` — verified
directly against the database. The keyboard now records picks with `source` of `'rewrite'` or
`'chip'`. `recordAccepted` is fire-and-forget on the client, so nothing visibly breaks without the
migration, but **every keyboard pick is silently discarded** and the tone-learning loop trains on
nothing. This is a quiet failure, which is the dangerous kind.

---

## Architecture decisions worth knowing

**Compose deliberately does NOT use the agent tool-loop** (`POST /api/dashboard/agent-turn`), even
though that endpoint exists and would have been reachable with the keyboard's JWT. Four reasons:

1. `pending_actions` is upserted **one row per user**, keyed on `user_phone`. A keyboard turn would
   stomp an in-flight SMS confirmation, so a later "yep" over text fires the wrong tool.
2. `agent-turn` writes **both directions** into `sms_messages`, which the Home activity feed renders
   as "recent replies" — so every keyboard rewrite would pollute the operator's Flynn conversation
   with text that was never sent to anyone.
3. Latency: the 25-tool loop is multiple sequential LLM calls; the keyboard budget is ~2 s.
4. It has no free-tier metering, unlike `draft-replies` which 402s.

So `POST /api/keyboard/compose` is a **pure text transformation**: no tools, no `pending_actions`, no
`sms_messages`, and it reuses the existing `draft-replies` free-tier gate.

**Consequence:** invoice *creation* from the keyboard is deliberately deferred. Chips still insert
pay links for invoices that already exist, so the demo loses nothing.

**Endpoints live in `server.js`**, not a new route file, because the metering and calendar helpers
(`isUserEntitled`, `draftsUsedToday`, `FREE_DRAFTS_PER_DAY`, `computeGoogleSlots`) are module-local
closures there. Extracting four of them would have been a larger, riskier refactor for no benefit.

**Pricing reads `users.business_brain`, not `business_profiles`.** This was found by querying prod:
`business_profiles.services` is an empty array on **all 121 rows** and `pricing_notes` is null on
every one, while the brain carries `hourly_rate_cents` / `callout_fee_cents`. Reading the wrong table
would have made the rates chip dead on arrival and stripped every real price out of compose — which
would have gutted the entire premise. `brainToProfileRow` is exported from `services/flynnSMS.js`
rather than duplicated.

---

## Bugs found and fixed during the build

These are worth knowing because two of them were in code written during this same session, and one
was pre-existing.

1. **Text replacement would have eaten the operator's typing.** The multi-pass retry loop re-derived
   a delete count each pass, so if the field held text *before* the shorthand, pass two deleted that
   too. Now it tracks a running total capped at exactly what was read, verifies progress against the
   proxy between passes, and stops when a host drops deletes.

2. **Grapheme vs UTF-16.** `deleteBackward()` removes one *user-perceived* character per call, so the
   count must come from `String.count`, not `utf16.count`. Otherwise emoji and combining marks
   over-delete — and tradies use emoji.

3. **The model echoed the shorthand back** as candidate 1, reading "shortest version" as "the input,
   unchanged." A card that inserts raw shorthand looks broken.

4. **When that was fixed, the pay link vanished** — the model substituted "invoice attached", which
   is meaningless in a text message and leaves the customer with a bill they cannot pay.

   3 and 4 are now enforced **in code, not just the prompt**: candidates matching the shorthand are
   dropped, and when a pay link is supplied, candidates missing it are filtered out.

5. **Pre-existing latent bug** in `services/businessContextFormatter.js`: brain services are plain
   strings (`["decking","landscaping"]`) but the formatter did `s.name`, so the existing SMS demo path
   was rendering `- undefined` per service. Fixed; both shapes now handled.

---

## Verification actually performed

- `xcodebuild -scheme FlynnAI` → **BUILD SUCCEEDED** for both targets (app + `FlynnKeyboard`) under
  Swift 6 `SWIFT_STRICT_CONCURRENCY: complete`.
- **Live compose calls against Qwen**, 4 shorthand cases. Results: pay link present in 100% of
  invoice candidates, zero em dashes, zero echoes, correct lowercase tradie voice ("all good mate",
  "arvo"), and `"whens my next free slot, tell her"` correctly pulled the **real** calendar slot
  ("friday at 2pm") rather than inventing one.
- Column existence and types confirmed directly against prod Postgres for every field the chips query
  selects; the query was run against real rows and returns sensible invoices.
- Existing test suite: **unchanged**. The same 18 failures (all
  `EXPO_PUBLIC_JOBBER_CLIENT_ID`, unrelated to this work) occur on a clean stashed baseline.

### NOT yet verified — the main open risk

**The on-device text-replacement matrix has not been run.** This is the sharpest remaining risk. The
correctness danger concentrates in hosts whose compose field is WebView- or React-Native-backed,
where `documentContextBeforeInput` is commonly `nil` or partial and rapid `deleteBackward()` calls get
coalesced or dropped.

**Test HiPages first** — it is both the commercial use case and the likeliest to misbehave. Then
WhatsApp, iMessage, Facebook Messenger, Gmail, a Safari `<textarea>`, Notes. For each, try: empty
field / short text with cursor at end / text with cursor mid-string. Expected: case 2 replaces, case 3
inserts and the card label changes to say so, case 1 shows chips with Polish disabled.

The design bounds the worst case to "it inserted instead of replacing" — never "it ate my message."

---

## File map

**Backend**
- `server.js` — `GET /api/keyboard/quick-context` (~2857), `POST /api/keyboard/compose` (~2983),
  both beside the existing `draft-replies` / `accept-draft` keyboard routes
- `services/draftReplies.js` — `composeFromShorthand`, `buildComposePrompt`, plus the echo and
  pay-link guards
- `services/flynnSMS.js` — `brainToProfileRow` now exported
- `services/businessContextFormatter.js` — string-vs-object services fix
- `supabase/migrations/20260725000000_draft_picks_keyboard_sources.sql` — the blocking migration

**iOS** (`ios-native/`, XcodeGen — run `xcodegen generate` after adding files)
- `FlynnKeyboard/KeyboardViewController.swift` — chips row, Polish, `replaceTypedText`
- `Shared/KeyboardDraftClient.swift` — `quickContext()`, `compose()`, 401 → `.unauthorized`
- `Shared/DraftModels.swift` — `QuickContext`, `QuickInvoice`, `QuickRate`, compose wire models
- `Shared/SharedStore.swift` — quick-context App Group cache
- `FlynnAI/Features/Onboarding/KeyboardTourStepView.swift` — replaces `CaptureSetupStepView`

**Deleted:** `ScreenshotDraftIntent`, `StagedScreenshotDraft`, `ocr-screenshot`, `intent-ping`,
`CaptureSetupStepView`, `FlynnConfig` (its iCloud shortcut pointed at a now-deleted intent), and
Brain → "Screenshot captures" + `CaptureHistoryView` (which could only ever show an empty screen once
the sole writer was gone). `ScreenshotOCR` moved to `QuoteStyle/`, its only remaining consumer. The
`screenshots` table and `/api/brain/captures` were left alone so historical rows survive.

---

## Privacy / App Review posture

Improved by this change, not worsened:

- The "reads your screen" surface is **gone entirely**.
- **No pasteboard access remains**, so the "Pasting from Flynn" banner is gone.
- The text field is read **only on an explicit Polish tap**, never speculatively on appear. That is
  both the privacy story and the literal behaviour.
- Full Access justification reduces to one defensible sentence: network access so the keyboard can
  fetch the signed-in user's own business data and insert it into the message they are composing.
- `FlynnKeyboard/PrivacyInfo.xcprivacy` now declares `NSPrivacyCollectedDataTypeOtherUserContent`
  (linked, not tracking, App Functionality). It previously declared no collected data types while the
  extension sent text to a server.
- Polish is suppressed in `numberPad` / `phonePad` / `emailAddress` / `URL` / `decimalPad` fields.

**Before submitting:** if the App Store Connect privacy questionnaire currently claims no data
collection, it must be updated to match the manifest, or expect a 5.1.1(i) rejection.

---

## Suggested next steps

1. Apply the migration.
2. Run the on-device replacement matrix, HiPages first.
3. Deploy the backend to Fly, then confirm the pay-link host: `SERVER_PUBLIC_URL` **is** set as a
   deployed Fly secret, but its value was not readable — verify a chip renders `flynnai.app/i/<token>`
   and not `flynnai-telephony.fly.dev`. A fly.dev link in a tradie's quote to their customer is a
   trust problem.
4. Return to the voice funnel (the actual beachhead): buy the AU ad number, set the TTS env vars.
5. Consider the shared free-tier counter: `FREE_DRAFTS_PER_DAY` defaults to 10 and is now shared
   across `draft-replies`, `quote-style` and `compose`. A retention feature used 20× a day will 402 by
   mid-morning. That is a product call, not an engineering one.

## Note on the commit

`e82bcb9` necessarily carries pre-existing uncommitted work that lived in the same files and is
required for the tree to build: saved (canned) messages, the SMS onboarding no-repeat history in
`flynnSMS.js`, and ~136 lines of inbound-voice funnel work in `server.js`. That work was already in
the working tree and was not authored in this session. Brand assets, the landing page, `android-native`,
and `LoginView.swift` were left uncommitted and untouched.
