# Flynn — Full Product & System Context (Research Handoff)

> Single-source briefing for a research agent on another platform. Captures **what is shipped**, **how it's built**, and **what the public landing page presents** as of 2026-06-19.
>
> Repo root: `/Users/atticus/FlynnAIapp`

---

## 0. TL;DR — What Flynn Is

Flynn is a **text-based business agent** for solo service operators (tradies, freelancers, cleaners, salons, real estate, PTs). You text Flynn like a smart mate and it does the admin: drafts replies, books jobs, sends invoices (with job photos), chases late payments, orders parts, files receipts.

- **One promise (current positioning):** *"Your admin, done by text."* (the "money loop": quote → invoice → chase → get paid by bank)
- **Primary surface:** iMessage. Land on flynnai.app → tap **Message Flynn** → text `+61 495 023 092`. No app required to get value.
- **Secondary surfaces:** native iOS app (keyboard extension + screenshot capture), native Android app (IME + notification/screenshot capture), web dashboard.
- **Go-to-market beachhead:** AU/NZ tradies (vision is broad SMB).
- **Core architectural fact:** the iMessage agent is **phone-keyed** — one "business brain" per phone number (+61/+64/+44/+1 → AUD/NZD/GBP/USD).

### Tone rules (non-negotiable, enforced in code)
Flynn's SMS replies read like a real person: lowercase starts where natural, contractions always, short sentences, **no em dashes**, no bullet points, no filler openers ("Sure!", "Great!"). All outbound passes through `sanitiseReply()` (`services/flynnTone.js`) which strips AI tells; long replies split into ≤3 bubbles via `splitBubbles()`.

### Non-goals (do not build)
Voice cloning · always-on screen/clipboard harvesting · autonomous sending without confirmation · "AI"-led marketing · multi-user/team features · desktop app / browser extension.

---

## 1. System Architecture (end to end)

```
Landing page (flynnai.app, Cloudflare Worker)
  → "Message Flynn" CTA → sms:+61495023092
  → User texts Flynn → BlueBubbles relay on a Mac (iMessage, Private API)
  → BlueBubbles webhook → Flynn backend (Node/Express on Fly.io)
  → Agent tool-loop (Qwen 3.5-flash via DashScope) executes tools
  → Flynn replies via BlueBubbles (blue bubbles); Twilio SMS fallback

Native apps (iOS Swift / Android Kotlin) → same Fly.io backend + Supabase directly
Brain / data: Supabase (project zvfeafmmtfplzpnocyjw, ap-southeast-2 Sydney)
OAuth backbone: Nango (provider configs for Google/Xero/Outlook/etc)
```

| Layer | Tech | Where |
|---|---|---|
| Backend | Node.js / Express 5 | `server.js`, Fly.io app `flynnai-telephony` (syd region) |
| LLM | Qwen 3.5-flash via DashScope (OpenAI-compatible); OpenAI fallback | `llmClient.js` |
| Data | Supabase (Postgres, Auth, Realtime, Storage) | project `zvfeafmmtfplzpnocyjw` |
| iMessage relay | BlueBubbles HTTP API on a Mac | `services/blueBubbles.js` |
| SMS fallback | Twilio | `twilio` dep |
| OAuth | Nango Cloud | `services/nango.js` |
| Landing | React 19 + Vite, Cloudflare Worker | `flynn-ai-new-landingpage/` |
| iOS | Swift 6 / SwiftUI + UIKit, XcodeGen | `ios-native/` |
| Android | Kotlin / Jetpack Compose | `android-native/` |

---

## 2. The iMessage Agent (PRIMARY surface — most important)

### 2.1 Stack & deploy
- Entry: `server.js` (Express, port 8080, also hosts a 60s cron ticker).
- Deploy: `fly.toml` → Fly.io `flynnai-telephony`, Sydney, shared-cpu-1x / 256MB, ports 80/443.
- Key deps: `express@5`, `@supabase/supabase-js`, `twilio`, `ws`, `nodemailer` + `imapflow` (email), `stripe`, `resend`, `tsdav` (CalDAV for Apple Calendar).

### 2.2 Inbound/outbound message flow
- BlueBubbles webhook → `POST /webhooks/imessage/inbound` (`routes/iMessageInbound.js`).
- Payload: `{ type:"new-message", data:{ guid, text, handle:{address}, isFromMe, chats } }`.
- Dedup by message GUID (60s window). Read receipt + typing indicator fired immediately.
- **Group vs 1:1 routing:** group GUIDs (`iMessage;+;`) → `services/groupAgent/groupRouter.js`; 1:1 → the brain.
- Inbound logged to `sms_messages` (direction `in`, channel `imessage`).
- Outbound: `sendMessage(to, text)` → BlueBubbles `/api/v1/message/text`; `sanitiseReply()` + `splitBubbles()` applied; Twilio SMS if BlueBubbles down.

### 2.3 The agent tool-loop
- Orchestrator: `services/agent/agentLoop.js`, gated by `FLYNN_TOOL_LOOP=1`.
- Model: Qwen 3.5-flash (`SMS_LLM_MODEL`/`DRAFT_LLM_MODEL`, default `qwen3.5-flash`), `enable_thinking:false`.
- Loop: max 6 tool iterations/message (`MAX_TOOL_ITERATIONS`), 12-message history (`HISTORY_LIMIT`).
- `buildSystemPrompt()` injects: timezone + currency (from phone prefix), the user's `business_brain`, connection status (which tools are live vs need connecting), open group action items, tone rules.

**Gating model (3 gates):**
1. **Confirmation gate** — `confirm:true` tools park in `pending_actions` (awaiting_confirmation); user "yes" executes deterministically.
2. **Connection gate** — needs OAuth/login → parks awaiting_connection, texts a connect link; resumes on Nango webhook / saved login.
3. **Billing gate** — `FLYNN_PAYWALL=1` checks metered tools against plan quotas (Stripe).

### 2.4 Tool registry (`services/agent/toolRegistry.js`)

| Tool | Confirm | Metered | What it does |
|---|---|---|---|
| `calendar_check_availability` | – | – | Free/busy (Google or Apple/iCloud CalDAV) |
| `calendar_book_event` | – | ✓ | Book job into calendar |
| `find_emails` | – | – | Search Gmail/Outlook/IMAP |
| `send_email` | ✓ | ✓ | Send from user's mailbox |
| `sheets_log_expense` | – | ✓ | Receipt → Google Sheets |
| `log_timesheet` | – | ✓ | Worker hours → Sheets |
| `xero_send_invoice` | ✓ | ✓ | Create + email Xero invoice |
| `xero_log_expense` | – | ✓ | Draft bill in Xero |
| `xero_list_invoices` | – | – | Read outstanding invoices |
| `order_parts` | ✓ | ✓ | Order from supplier (Browserbase) |
| `draft_quote` | – | ✓ | Draft + record quote for chasing |
| `record_quote` | – | – | Record an already-given quote |
| `list_quotes` | – | – | List quotes by status |
| `update_quote` | – | – | Mark won/lost/expired |
| `create_photo_invoice` | ✓ | ✓ | Invoice with embedded job photos |
| `mark_invoice_paid` | – | – | Mark photo invoice paid |
| `remember` | – | – | Save facts to business brain |
| `connect_tools` | – | – | One secure multi-tool OAuth setup link |
| `save_login` | – | – | Save credential login (Xero/supplier/Apple Cal) |

Suppliers for `order_parts`: reece, bunnings, tradelink, nhp, middy, rsea, neco, amazon (via Browserbase, `services/browserbaseAgent.js`).

### 2.5 Integrations (live)
OAuth via **Nango** (`services/nango.js`, `routes/integrationsNango.js`). Connect links: `/c/<code>` (7-day expiry, `connect_links` table) mint a fresh Nango session at click; legacy `/connect/:provider?t=<jwt>` honoured.

| Provider | Auth | Use |
|---|---|---|
| Google Calendar | Nango OAuth | Book jobs |
| Google Mail | Nango OAuth | Send/search email |
| Google Sheets | Nango OAuth | Expenses/timesheets |
| Apple Calendar | Saved login (CalDAV/tsdav) | Book jobs (iCloud) |
| Outlook / M365 | Nango OAuth | Send/search email |
| IMAP/SMTP | Saved login (imapflow + nodemailer) | Bigpond/Telstra/iCloud/Yahoo/custom; host/port auto-derived |
| Xero | Nango OAuth (API) **or** Browserbase (UI) | Invoices + expenses |
| Trade suppliers | Browserbase saved login | Order parts |
| Stripe | Webhook | Payments + paywall (`routes/stripeRoutes.js`) |

Connection state in `user_connections` (one row per phone+provider; tokens live in Nango, Flynn stores only metadata).

### 2.6 Photo invoices (shipped, the flagship loop)
1. User texts job photos → Supabase `documents` bucket; buffered in `job_photo_buffer` (12h / 8-photo cap).
2. User texts e.g. `invoice dave for today, 2hrs + $120 parts` → `create_photo_invoice`.
3. Tool claims buffered photos, writes `agent_invoices` row, returns shareable link.
4. Hosted page `GET /i/<token>` (`routes/invoicePage.js`): token-gated, business header, embedded photos, line items, GST split, pay button. First-view timestamp recorded.
5. `mark_invoice_paid(client_name)` marks most recent unpaid invoice paid.

`agent_invoices` is **phone-keyed** (distinct from the org-based `public.invoices` telephony table): user_phone, client_name/email, line_items jsonb, subtotal/tax/total_cents, currency, photo_urls, public_token, status, xero_synced, paid_at.

### 2.7 Conversational onboarding / brain building
- `services/flynnSMS.js` → `handleBrainSetup()`. Qwen turns freetext ("what do you do?") into `brain_update` JSON (business_type, name, location, services, suppliers, pricing_notes, hourly_rate_cents, callout_fee_cents, invoicing_tool, needs, exclusions) + `brain_complete` + `suggested_integrations`.
- Stored in `users.business_brain` (jsonb). `remember` tool appends facts. Never re-asks; once complete, names 2-3 concrete things it'll do.

### 2.8 Cron jobs (60s ticker in `server.js`, each self-throttled)
| Scheduler | File | Cadence | Purpose |
|---|---|---|---|
| Reminders | `reminderScheduler.js` | 60s | Job confirmation / day-before reminders |
| Booking reminders | `bookingReminderScheduler.js` | 60s | Upcoming job alerts |
| Quote chase | `quoteChaseScheduler.js` | ~15m | Cold quote follow-ups (max 3, then expire) |
| Weekly digest | `weeklyDigestScheduler.js` | ~20m | Money/admin summary, weekly at digest hour |
| Group digest | `groupAgent/digestScheduler.js` | ~3m | Extract action items, DM boss daily |
| Re-engagement | `reengagementScheduler.js` | ~10m | Nudge stalled (brain_pending) signups |

Flags: `FLYNN_TOOL_LOOP`, `FLYNN_PAYWALL`, `FLYNN_WEEKLY_DIGEST`, `FLYNN_PROACTIVE_CHASE`, `FLYNN_DIGEST_HOUR` (17), `FLYNN_DIGEST_DOW` (0=Sun).

### 2.9 Supabase tables (agent-relevant)
`users` (incl. `business_brain` jsonb, `push_token`), `sms_messages`, `user_connections`, `user_integrations` (legacy encrypted creds), `pending_actions`, `agent_quotes`, `agent_invoices`, `job_photo_buffer`, `group_chats`, `group_messages`, `group_action_items`, `organizations` (telephony-era), plus app tables `business_profiles`, `tone_samples`, `jobs`.

### 2.10 Ads tracking — Meta CAPI (`services/metaCapi.js`)
- Web pixel/dataset **2580731252385574** ("Flynn Web"), separate from app dataset 885850801136212.
- Events: **MessagedFlynn** (browser Pixel + server CAPI, shared event_id dedup), **Activated** (first value action in iMessage, business_messaging source), **Lead**.
- Match: fbp/fbc raw, IP + UA, SHA-256 hashed phone. Config via `META_CAPI_PIXEL_ID`/`META_CAPI_ACCESS_TOKEN`(/`_TEST_EVENT_CODE`).

---

## 3. iOS Native App (`ios-native/`)

- **Stack:** Swift 6 (strict concurrency), SwiftUI + UIKit (keyboard), XcodeGen (`project.yml`), iOS 18.0 min.
- **Version:** 3.0.1 (build 113). Bundles: app `com.flynnai.app`, keyboard `com.flynnai.app.keyboard`, App Group `group.com.flynnai.app`. Team `69T5H7R46N`.
- **Deps:** supabase-swift 2+, facebook-ios-sdk 17+; frameworks: Vision (OCR), EventKit, AppIntents, AdServices, StoreKit 2, AppTrackingTransparency.
- **Note:** legacy Expo iOS lives in `ios/`; `ios-native/` is the canonical native build.

### Surfaces
- **4 tabs:** Dashboard (Home), Brain, Events (Bookings), Connected (Integrations).
- **Keyboard extension** (`KeyboardViewController`, UIKit ~760 lines): clipboard→draft on appear, swipeable draft cards, post-insert "Add to Google Calendar", fallback UI without Full Access.
- **Screenshot/OCR capture:** `ScreenshotDraftIntent` (AppIntents, no app launch) → on-device Vision OCR (`ScreenshotOCR`, `VNRecognizeTextRequest`) → drafts staged to App Group for the keyboard.
- **URL scheme** `flynnai://`: `dashboard`, `events/<uuid>`, `clients/<uuid>`, `calls/<uuid>`, `money/quotes|invoices/<uuid>`, `settings/<section>`, `auth/callback` (`DeepLinkRouter`).
- **Onboarding (frictionless):** landing → "Message Flynn to get started" primary; sign-in via SMS magic link / email OTP / email+password / signup. Keyboard setup is **optional power-user flow** (`KeyboardSetupFlow`), not a gate. Brain setup happens over text.

### Key classes
`FlynnAIApp`/`RootView`/`MainTabView`; `AuthStore` (Supabase auth); `KeyboardDraftClient` (in `Shared/`: `fetchDrafts`, `ocrScreenshot`, `addCalendarEvent`, `recordAccepted`); `SharedStore` (App Group UserDefaults handoff), `SharedSecureStore` (Keychain JWT), `StagedScreenshotDraft`/`PendingCalendarEvent` (Codable handoffs); repositories (`BusinessProfileRepository`, `EventsRepository`, `MemoryRepository`, `SubscriptionsRepository`, `UsageRepository`…); `AppleCalendarService` (EventKit), `GoogleCalendarConnect` (OAuth); design system `Mascot` (8 poses), `FlynnButton/TextField/Card/Badge`, `FlynnColor` (orange #FB5B1E), Space Grotesk + Inter.

---

## 4. Android Native App (`android-native/`)

- **Stack:** Kotlin, Jetpack Compose + Material 3 (no XML), single-activity. Gradle KTS, JVM 17.
- **Package** `com.flynnai.app`, versionCode 103 / versionName **2.1.0**, compile/target SDK 35, min SDK 26.
- **Deps:** Compose BOM 2024.12.01, Navigation Compose, supabase-kt 3.1.4, Ktor 3 + OkHttp 4, Play Billing 7.1.1, **ML Kit Text Recognition 19.0.1** (on-device OCR), Coil 3, kotlinx serialization/coroutines, AndroidX Security Crypto (EncryptedSharedPreferences).
- **Note:** legacy Expo Android in `android/` (v2.0.x, EAS-built); `android-native/` is canonical. Shared upload keystore.

### Surfaces
- **4 tabs:** Home, Voice, Brain, Bookings + drawer (Settings/Account/Capture Setup).
- **Keyboard (IME):** `FlynnImeService` (full Compose-in-IME): "Replying to [sender]", swipe draft cards, redraft from clipboard, insert + fire learning signal.
- **Two capture paths** (both **read-only**, never send):
  1. **Notification listener** (`FlynnNotificationListener`, primary): inspects inbound message notifications via `MessagingStyleExtractor`, accumulates by conversation, 1200ms debounce → backend draft → `CaptureStagingStore`. Allowlisted apps: WhatsApp, Google Messages, Messenger, Signal, Instagram.
  2. **Quick Settings tile + screenshot:** `FlynnCaptureTileService` → MediaProjection consent → `ScreenCaptureService` → `OcrTextExtractor` (ML Kit, on-device).
- **Billing:** `BillingManager` (products `pro_monthly`, `pro_annual`), `PaywallScreen`.
- **Calendar:** `DeviceCalendarService` (CalendarContract: create/delete/busySlots).
- **Onboarding (9 steps):** Welcome → What You Do → Confirm Brain → Capture Voice → Sounds Like You → Connect Calendar → Paywall → Practice → Install Keyboard.

### Backend endpoints used (all `https://flynnai-telephony.fly.dev`, Bearer)
`/api/keyboard/provision-token`, `/api/keyboard/draft-replies` (source: clipboard|notification|screenshot), `/api/keyboard/accept-draft` (learning signal), `/api/onboarding/understand`, `/api/business-profile` (PATCH), `/api/scrape-website`.

### Key classes
`FlynnApp` (lazy Supabase), `FlynnNavHost`, `FlynnImeService`, `KeyboardTokenStore` (encrypted), `CaptureStagingStore` (JSON file handoff), `KeyboardBridge`/`FlynnApi`, `SupabaseClient`, ViewModels per screen (`AuthViewModel` email+phone OTP, `OnboardingViewModel`, `HomeViewModel`, `VoiceViewModel`, `BrainViewModel`, `BookingsViewModel`).

---

## 5. Landing Page (`flynn-ai-new-landingpage/`, flynnai.app)

- **Stack:** React 19 + TypeScript, Vite 6, Tailwind (CDN), React Router 7, Framer Motion, Lucide. Fonts Space Grotesk + Inter.
- **Deploy:** Cloudflare Worker via `npm run cf:deploy` (`vite build && wrangler deploy`), pattern `flynnai.app/*`, SPA mode. (Per repo memory: needs `NODE_OPTIONS=--dns-result-order=ipv4first`.)
- **Structure:** `index.tsx` → `App.tsx` (routes `/`, `/pricing`, `/blog`, `/dashboard`, `/trial`). Main page is one big `components/LandingPage.tsx`; sub: `PhoneSignupChat.tsx` (Message-Flynn CTA + iMessage mockup), `StoreButtons.tsx`, `Footer.tsx`. Mascots in `public/mascots/`, real job `before.jpg`/`after.jpg`.

### Positioning & copy (current — "money loop")
- **Title:** "Flynn · Your admin, done by text."
- **Hero:** *"Your admin, done by text."* Sub: *"Flynn runs the money side of your business from one text thread — quotes, invoices, chasing late payments, receipts, and getting you paid. No app. No data entry. You just text it like a mate."* · "Free to start · You confirm before anything moves · AU & NZ"
- **Primary CTA:** **Message Flynn** → `sms:+61495023092&body=Hi Flynn` (Flynn number **+61 495 023 092**).
- **Trust strip:** Tradies · Freelancers · Salons · Real estate · Side hustles · Anyone who texts.
- **How it works:** (1) Text your number → Flynn texts back a contact card; (2) Text what you need in plain English; (3) Flynn handles it, you confirm before anything moves.
- **Features:** "Invoices with the photos on them" · "Gets you paid by bank" (tap Pay → pays from bank, no card fees) · "Chases the late ones."
- **Calendar section:** "Text Flynn to book a job. It's done." (Apple + Google Calendar).
- **Get-paid section:** "Send the invoice. Get paid by bank." with real before/after photos and a `flynnai.app/i/<token>` link + "Henderson paid you $640 · Paid by bank."
- **Keyboard mention:** keyboard extension drafts replies in iMessage/WhatsApp/email, tap to insert, nothing sends on its own.
- **Pricing:** Free ($0: few actions/day, reply drafts, one calendar) vs **Pro** ("Unlimited", photo invoices + pay by bank + auto-chase + supplier ordering + accounting sync + voice tuning; 14-day trial).
- **FAQ (7):** how it works, what you can ask, how clients pay (bank, no card fees), "Does Flynn send on its own? Never", setup (few minutes of business basics), cost, data safety ("only knows what you tell it; no scanning contacts/messages").
- **Final CTA:** "Your business runs from your phone. Flynn makes it work for you."

### Landing tracking (`services/tracking.ts`)
GA4 `G-N12D97R2ZB`; Meta Pixel `2580731252385574` (matches server CAPI for dedup); TikTok pixel placeholder (disabled); PostHog `phc_BHXAEfwYDkbwoHQANDTMnDj9XwhFPFECLSeA4cs4r94C`. "Message Flynn" fires MessagedFlynn+Lead (Meta), Contact (TikTok), message_flynn (GA4), message_flynn_tapped (PostHog), and a beacon to `/api/track/messaged` (ref, event_id, fbp/fbc/fbclid, UTMs) for CAPI bridging. UTMs persisted in sessionStorage `flynn_attribution`.

---

## 6. Important framing notes (from project memory)

- **Positioning is "your admin, done by text," NOT "get paid faster."** The moat is the channel (iMessage, no app) + the full money loop; the wedge is removing the *doing*, not a simpler tool. Beachhead = AU trades; vision = broad SMB.
- **Flynn is a general-purpose iMessage text agent** — *integrations ARE the product*, not a quotes/jobs tool. The dashboard adapts to the user's chats. Tradies are the ads beachhead only.
- **Retention thesis:** stickiness comes from recurring **proactive** jobs (speed-to-lead, reminders, payment/quote chasing, weekly digest), not reactive one-offs.
- **Photo invoices are live in prod** (since 2026-06-18) and positioned as the default/built-in.
- **Pay-by-bank (PayTo) is forward-looking** on the landing page — a build plan exists at `plans/payments-payto-build-plan.md` (currently open in the IDE). Treat "pay by bank" as positioned/partly aspirational rather than fully shipped.
- **Current prod users (~5) are family/testers**, not customers — don't draw retention conclusions from them.
- **Drafting model:** Qwen 3.5-flash via DashScope (cheap/fast/natural), `enable_thinking:false`, json_object schema. NOT qwen3.6.

---

## 7. Quick file map

```
server.js                         Express app + cron hub
llmClient.js                      LLM provider resolution
fly.toml                          Fly.io deploy
services/agent/agentLoop.js       tool-loop orchestrator (FLYNN_TOOL_LOOP)
services/agent/toolRegistry.js    19 tools + gating
services/blueBubbles.js           iMessage relay
services/nango.js                 OAuth backbone
services/flynnSMS.js              brain setup / onboarding
services/flynnTone.js             sanitiseReply(), splitBubbles()
services/photoInvoice.js          photo invoice render + buffer
services/imapEmail.js             IMAP/SMTP email
services/metaCapi.js              Meta CAPI events
services/groupAgent/*             group chat note-taker + digest
services/*Scheduler.js            crons (reminders, chase, digest, re-engage)
routes/iMessageInbound.js         POST /webhooks/imessage/inbound
routes/invoicePage.js             GET /i/:token
supabase/migrations/*             schema (agent_invoices, user_connections, group_chats…)
ios-native/                       Swift app (v3.0.1) — keyboard + screenshot OCR
android-native/                   Kotlin app (v2.1.0) — IME + notification/screenshot capture
flynn-ai-new-landingpage/         React/Vite landing (flynnai.app, Cloudflare Worker)
```
