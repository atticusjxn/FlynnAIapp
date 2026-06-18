---
description: Dev-time build-out agent for Flynn's third-party OAuth integrations. Batches ~18 by vertical, researches each dev-portal signup with firecrawl, opens the exact links via claude-in-chrome, hands off the human steps (login/2FA/review), and works the runbook until it hits a wall or finishes.
---

# /integrations — Flynn integration build-out agent

You are setting up the **developer-side OAuth apps** for Flynn's integrations so they go live in the product. This is a DEV-TIME task in Atticus's own developer accounts — not runtime automation. Atticus is at the keyboard to do the human steps (sign up / log in / 2FA / submit review forms). You do everything else: research the current setup steps, open the exact pages, fill the forms, capture the credentials, wire them into the backbone, and flip each integration live.

**Mental model:** the slow part isn't code — it's the dev-portal grind (create app, consent screen, redirect URIs, scopes, copy client_id/secret). You grind it; Atticus only handles auth gates and anything requiring a human decision/identity.

Read these first for context: the strategy memory `flynn-integrations-strategy`, the product framing memory `flynn-product-framing`, and the catalogue at `flynn-ai-new-landingpage/data/integrations.tsx` (the single source of truth — flipping `available: true` there is how an integration goes live in the grid).

---

## Phase 0 — Prerequisites (confirm once at the start of every run)

Ask Atticus (or read from the tracker if already recorded):

1. **OAuth backbone + callback URL.** Per the strategy, the backbone is **self-hosted Nango** (it pre-registers most providers, so per-provider work collapses to: drop in client_id/secret + pick scopes). Confirm:
   - Is Nango deployed yet? If NOT → that's the first job; stop and set it up (or record `BACKBONE: not-ready` and ask whether to proceed with direct OAuth instead).
   - The **redirect/callback URI** every provider app must point at. For Nango cloud it's `https://api.nango.dev/oauth/callback`; for self-host it's `https://<your-nango-host>/oauth/callback`. For direct OAuth it's the Flynn server: `https://flynnai-telephony.fly.dev/api/integrations/<provider>/callback`. **Get the exact value and reuse it for every app.**
2. **Where secrets go.** Default: Nango dashboard (per integration) + a local `.env` for the Flynn server. Never anywhere else.
3. **Open the tracker** `plans/integrations-tracker.md`. If it doesn't exist, create it from the template at the bottom of this file. If it exists, **resume from it** — skip anything already `live`, continue anything `in-review` or `in-progress`.

---

## The integration set (~18, batched by vertical)

Provider slugs below match `data/integrations.tsx` exactly. Some appear in multiple verticals — set each up once.

> **Google efficiency:** `google_calendar`, `gmail`, and `google_drive` are ALL one Google Cloud project + one OAuth consent screen. Create the project ONCE, enable the three APIs, add all scopes together. Don't treat them as three separate setups.

### Batch 1 — Tradie (beachhead, do first)
| Provider | Auth | Console | Review-gated? |
|---|---|---|---|
| `google_calendar` | OAuth | Google Cloud Console | Sensitive scope (light review) |
| `xero` | OAuth | developer.xero.com | No (note: paid API tiers from 2026‑03‑02) |
| `stripe` | OAuth (Connect) | dashboard.stripe.com | No |
| `jobber` | OAuth | developer.getjobber.com | Possible partner approval |
| `servicem8` | OAuth | developer.servicem8.com | **Partner approval likely** |
| `gmail` | OAuth | Google Cloud Console | **Restricted scope — CASA review** |

### Batch 2 — Real estate
| Provider | Auth | Console | Review-gated? |
|---|---|---|---|
| `instagram` (Meta) | OAuth | developers.facebook.com | **App Review + business verification** |
| `dropbox` | OAuth | dropbox.com/developers | No |
| `google_drive` | OAuth | Google Cloud Console (same project) | Sensitive scope |
| (`gmail`, `google_calendar`, `stripe` — reuse Batch 1) | | | |

### Batch 3 — Cleaners / PTs / Salons
| Provider | Auth | Console | Review-gated? |
|---|---|---|---|
| `quickbooks` | OAuth | developer.intuit.com | Sandbox instant; prod review for go-live |
| (`stripe`, `instagram`, `google_calendar`, `gmail` — reuse) | | | |

### Batch 4 — Cross-vertical
| Provider | Auth | Console | Review-gated? |
|---|---|---|---|
| `myob` | OAuth | developer.myob.com | **Developer approval, can be slow (AU gap)** |
| (`quickbooks`, `dropbox`, `google_drive` — reuse) | | | |

### Out of scope for THIS flow (no dev-portal OAuth)
- `apple_calendar` — iOS EventKit, no OAuth app. Skip.
- `reece`, `tradelink` — **no public API**. Don't try to make an OAuth app. Record as `no-api`; they're handled at runtime via Browserbase session automation OR by piggybacking ServiceM8/Simpro's existing supplier link. Note in tracker, move on.

---

## Priority rule — start the review clocks first

Review-gated providers take days to weeks and you CAN'T shortcut them. So on every run, **front-load the gated submissions** (`gmail`, `instagram`/Meta, `servicem8`, `myob`, `quickbooks` prod) — get their apps created and review submitted EARLY, in parallel, so their clocks tick while you knock out the easy ones (`xero`, `stripe`, `dropbox`, `google_calendar`, `google_drive`, `jobber`). Don't let Gmail/Meta block the batch.

---

## The repeatable runbook (per provider)

For each provider not yet `live`:

1. **Research current steps.** Use firecrawl (`firecrawl_search` then `firecrawl_scrape` the official dev docs) for "create OAuth app {provider} redirect URI scopes 2026" — portals change, so get the CURRENT flow, the exact scope strings Flynn needs, and the redirect-URI field name. If Nango supports the provider, also check Nango's integration doc for that provider's required config.
2. **Open the exact page(s).** Use the **claude-in-chrome MCP** (load via ToolSearch; `tabs_context_mcp` first, then `tabs_create_mcp`). Open up to ~5 provider consoles at once for a batch so Atticus can log into them in one pass. (Plain computer-use grants browsers read-only — claude-in-chrome is the interactive path and is DOM-aware/faster.)
3. **Human gate → hand off.** When you reach login / signup / 2FA / a "verify your identity / business" step, STOP and tell Atticus exactly what to do on which tab. Wait for confirmation before continuing.
4. **Fill the form.** Create the app: name "Flynn", set the **redirect URI** to the backbone callback from Phase 0, select the researched scopes, set any required app domain / privacy-policy URL (`https://flynnai.app/privacy`), logo if asked.
5. **Capture credentials.** Read the client_id and client_secret. **Do NOT print the secret into the chat or any committed file.** Write them to the Nango dashboard for that integration and/or the Flynn server `.env`. Confirm storage, then treat the secret as handled.
6. **Submit review if gated.** Fill and submit the review/verification form as far as a human-identity step allows; when it needs Atticus's personal/business info or a screencast, hand off. Mark `in-review` with the date.
7. **Wire it live.** When the app is usable (creds stored, not blocked on review): in `flynn-ai-new-landingpage/data/integrations.tsx` flip that provider's `available: false` → `true`. If still blocked on review, leave `available: false` and record `in-review`.
8. **Update the tracker** row: status, app/client id (NOT the secret), scopes, review state + date, notes.

---

## Hitting a wall — notify protocol

A "wall" = anything you cannot do and Atticus must: login, signup, 2FA/OTP, captcha, identity/business verification, a payment/billing step, app-review forms needing personal info or a screencast, a genuinely ambiguous choice (e.g. which Stripe account, which scopes to request), or a portal that's down.

When you hit one:
- Stop that provider, clearly state **which tab, what's needed, and why** in one tight message.
- If Atticus may be away, send a phone heads-up with `PushNotification` (load via ToolSearch) summarising the wall.
- **Keep working other providers** in the batch that aren't blocked — don't idle waiting. Only fully stop when every remaining provider is blocked on a human.
- Record the wall in the tracker so a later run resumes cleanly.

## When the batch is done
Summarise: what went live (`available: true` flipped), what's `in-review` (and the clock-start date), what's blocked and on what. Remind Atticus to deploy the web so newly-live integrations show: `cd flynn-ai-new-landingpage && NODE_OPTIONS=--dns-result-order=ipv4first npm run cf:deploy`. Send a final `PushNotification` that the run is complete.

---

## Rules
- **Never** print a client secret / token into chat, the tracker, or any committed file. Secrets → Nango dashboard or `.env` only.
- App name is always **Flynn**; privacy policy `https://flynnai.app/privacy`; reuse the ONE backbone redirect URI everywhere.
- One Google Cloud project for all three Google scopes.
- Don't invent setup steps — firecrawl the current docs; portals drift.
- Resume, don't restart: always read the tracker first and skip `live` rows.
- `reece`/`tradelink` have no API — never try to create an OAuth app for them.

---

## Tracker template (`plans/integrations-tracker.md`, create on first run)

```markdown
# Flynn integrations build-out tracker

Backbone: <Nango self-host URL | Nango cloud | direct>  ·  Callback URI: <value>  ·  Secrets store: <Nango dashboard + server .env>

Status legend: not-started · in-progress · in-review(<date>) · live · no-api · blocked(<reason>)

| Provider | Vertical | Status | Client ID | Scopes | Review state | Notes |
|---|---|---|---|---|---|---|
| google_calendar | tradie | not-started | | | | shares Google project w/ gmail, drive |
| gmail | tradie | not-started | | | | RESTRICTED scope — CASA review, submit early |
| xero | tradie | not-started | | | | paid API tiers from 2026-03-02 |
| stripe | tradie | not-started | | | | |
| jobber | tradie | not-started | | | | |
| servicem8 | tradie | not-started | | | | partner approval likely |
| instagram | real-estate | not-started | | | | Meta App Review + biz verification, submit early |
| dropbox | real-estate | not-started | | | | |
| google_drive | real-estate | not-started | | | | same Google project |
| quickbooks | cleaners | not-started | | | | |
| myob | cross | not-started | | | | AU gap, dev approval can be slow |
| reece | tradie | no-api | — | — | — | Browserbase/ServiceM8 runtime, not OAuth |
| tradelink | tradie | no-api | — | — | — | Browserbase/Simpro runtime, not OAuth |
```
```
