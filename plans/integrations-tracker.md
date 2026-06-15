# Flynn integrations build-out tracker

Backbone: Nango Cloud free tier  ·  Callback URI: `https://api.nango.dev/oauth/callback`  ·  Secrets store: Nango dashboard + server .env / Fly secrets

Status legend: not-started · in-progress · in-review(<date>) · live · no-api · blocked(<reason>)

| Provider | Vertical | Status | Client ID | Scopes | Review state | Notes |
|---|---|---|---|---|---|---|
| google_calendar | tradie | live | see Nango dashboard | calendar.readonly, calendar.events | n/a — production-unverified | Google Cloud project `flynn-integrations`; Nango key `google-calendar` |
| gmail | tradie | in-progress | same Google client | gmail.modify | CASA review pending | Nango key `google-mail` configured; `available: false` until CASA clears |
| google_sheets | expenses | live | same Google client | spreadsheets, drive.file | n/a | Nango key `google-sheet`; powers receipt→Sheets flow; no dashboard card |
| xero | tradie | live | 893F4D14DB2D4DCD916AA06CBC4F1875 | offline_access, openid, profile, email, accounting.invoices, accounting.contacts | n/a (uncertified, 5-org free) | App "Flynn AI" (dev portal app id aad525cf-3916-48c2-bdff-a2fcbdb50d75), Web app, redirect https://connect.flynnai.app/oauth/callback, privacy https://flynnai.app/privacy, AI-data=No. Nango 'xero' config id 3 LIVE (client_id+secret set, missing_fields []). Client secret stored encrypted in Nango only. NOTE 2026-06-15: rotated NANGO_DASHBOARD_PASSWORD on flynn-nango (old one wasn't saved) to use the config API — new dashpass in /tmp/nango_dashpass.txt locally. |
| stripe | tradie | not-started | | | | Stripe Connect OAuth |
| jobber | tradie | not-started | | | | `available: true` in catalogue — needs Nango integration + OAuth app |
| servicem8 | tradie | not-started | | | | partner approval likely; submit early |
| instagram | real-estate | not-started | | | | Meta App Review + biz verification; submit early |
| dropbox | real-estate | not-started | | | | straightforward OAuth |
| google_drive | real-estate | not-started | same Google client | drive.file | n/a | add to existing Google Cloud project + Nango |
| quickbooks | cleaners | not-started | | | | sandbox instant; prod review for go-live |
| myob | cross | not-started | | | | AU dev approval can be slow; submit early |
| reece | tradie | no-api | — | — | — | Browserbase/credentials at runtime; `authType: credentials` in catalogue |
| tradelink | tradie | no-api | — | — | — | Browserbase/credentials at runtime; `authType: credentials` in catalogue |
| apple_calendar | tradie | no-api | — | — | — | iOS EventKit only; no OAuth app; `Connect from iOS app` note in catalogue |

---

## Remove the "Google hasn't verified this app" warning (decided 2026-06-10)

The warning is Google's unverified-app gate; only Google App verification removes it.
Decisions: **verify Calendar + Sheets first** (sensitive scopes → App verification only,
no CASA, ~<1wk); **self-host Nango free** on a `flynnai.app` subdomain so we own the
callback domain Google checks. Gmail (restricted → CASA) deferred to a later round.

**Code rework — DONE (this session).** Free self-hosted Nango has NO webhooks, so
connect-completion no longer depends on `/webhooks/nango`. `agentLoop.recordNangoConnection`
+ `reconcileNangoConnection` poll Nango (`getToken`, connection_id = users.id) to confirm a
connection and resume the parked action. Fires from two host-agnostic places: the inbound
poll-reconcile in `iMessageInbound.js` (gated on an `awaiting_connection` row — reliable
backbone) and `GET /connected?c=<code>` (instant success page). The webhook stays as a
Cloud backup. Tests in `tests/agentLoop.test.js`.

**PROGRESS 2026-06-10 (self-hosted Nango on Fly — DONE except provider configs + repoint):**
- `flynn-nango` Fly app live in syd, image `nangohq/nango-server:hosted` v0.70.6, `listening on 3003`, `OAuth callback https://connect.flynnai.app/oauth/callback`. HTTP 200 on `/health`.
- DB: isolated `nango` schema + `nango_app` login role in Flynn's Supabase (`zvfeafmmtfplzpnocyjw`). Connection via `sslmode=no-verify` (Supabase cert chain). Fixed at boot: GRANT CREATE ON DATABASE; `nango.uuid_generate_v4()` SECURITY DEFINER wrapper (Nango uses uuid-ossp, Supabase keeps it in `extensions`).
- Fly secrets set: `NANGO_ENCRYPTION_KEY`, `NANGO_DATABASE_URL`, `NANGO_DASHBOARD_USERNAME=flynn` + `NANGO_DASHBOARD_PASSWORD` (in /tmp/nango_dashpass.txt locally).
- Cloudflare DNS: `connect.flynnai.app A 66.241.124.60` DNS-only (grey). Fly cert validating (recheck `fly certs check connect.flynnai.app -a flynn-nango`).
- Google Cloud (flynn-integrations): added redirect URI `https://connect.flynnai.app/oauth/callback` to the "Flynn Nango" OAuth client (kept api.nango.dev as backup). Client ID `137579587336-iet7mf2ivj5ejncg3met4imqhvrign9r.apps.googleusercontent.com`.
- **Gotcha for future config:** the self-hosted dashboard UI needs WorkOS (managed auth) which we don't run → `/signin` renders blank, UI unusable. Configure via the **API** instead: basic auth (`-u flynn:<dashpass>`) authorizes the management API (e.g. `GET /api/v1/integrations?env=prod` works). Runtime/SDK endpoints use the **environment secret key** (Bearer). Secret keys are stored PLAINTEXT in `nango._nango_environments.secret_key` (prod row, is_production=true) — read from DB, don't try the dashboard.

**DONE 2026-06-11 (provider configs + repoint + connect flow):**
- Google Cloud: deleted the unused `Awb0` client secret, minted a fresh one (`Kez1`) for self-host (cNvN still serves Nango Cloud). Downloaded secret used to configure Nango, then shredded.
- Created both provider configs on self-hosted Nango (prod env) via API `POST /integrations` with `credentials.type=OAUTH2`: `google-calendar` (calendar.readonly + calendar.events) and `google-sheet` (spreadsheets + drive.file). Verified via `GET /integrations`.
- `connect.flynnai.app` cert ISSUED (needed the AAAA record `2a09:8280:1::125:8c07:0` DNS-only — Fly's shared IPv4 can't prove ownership alone).
- Repointed `flynnai-telephony`: `NANGO_HOST=https://connect.flynnai.app`, `NANGO_SECRET_KEY=<prod key>`, deployed (also shipped the session's code changes: short links, conversation-first, vCard, tone, reconcile).
- **Connect UI two-port problem solved without a reverse proxy:** Nango's hosted Connect UI runs on internal port 3009 (not exposed; the connect_link `connect.flynnai.app/?session_token` 302s to a blank `/signin`). Instead Flynn redirects to the server's DIRECT OAuth-initiate endpoint on 3003: `GET /oauth/connect/:provider?connect_session_token=<token>` → verified 302 straight to Google consent with `redirect_uri=https://connect.flynnai.app/oauth/callback`. `services/nango.js createConnectSession` now builds that URL.
- Connect-session flow auto-generates the connection_id (NOT users.id), so `reconcileNangoConnection` now resolves it via `nango.findConnectionId(provider, users.id)` (GET `/connection?endUserId=`) before getToken. Tests updated (15/15).

**STILL TO VERIFY (needs a real text round-trip — only the user can):** text Flynn → tap short link → approve Google consent on connect.flynnai.app (the "unverified app" warning is EXPECTED until verification) → confirm the booking auto-resumes (watch `fly logs -a flynnai-telephony` for poll-reconcile). Then submit Calendar+Sheets for Google verification to clear the warning.

**(historical) REMAINING (mechanical, ~30 min):**
1. Generate a Google client secret in the "Flynn Nango" client (existing ones are unviewable) — capture once.
2. Create 2 provider configs on self-hosted Nango (env=prod) via API: `google-calendar` (scopes calendar.readonly, calendar.events) and `google-sheet` (spreadsheets, drive.file), each with the client_id + new secret. (Confirm Nango's POST config route + provider template names against v0.70.)
3. Set Fly secrets on `flynnai-telephony`: `NANGO_HOST=https://connect.flynnai.app`, `NANGO_SECRET_KEY=<prod secret key from DB>`. Deploy. (Do this AFTER configs exist, else connect links hit a Nango with no Google configs.)
4. Smoke test: text Flynn "book a job thursday 2pm" → short connect link → consent on connect.flynnai.app → booking resumes via poll-reconcile.
5. Then Google verification submission (Calendar+Sheets) per section above.

**Earlier human-gated steps (now mostly done above):**

A. Stand up free self-hosted Nango (Auth+Proxy is all we need)
   - Pick a host (Fly — consistent with flynnai-telephony — or Render which auto-provisions Postgres). Need: Nango docker image + external Postgres + Redis.
   - DNS on Cloudflare: `connect.flynnai.app` → the host (TLS at host).
   - Nango env: `NANGO_SERVER_URL=https://connect.flynnai.app`, `NANGO_ENCRYPTION_KEY=$(openssl rand -base64 32)`, `FLAG_SERVE_CONNECT_UI=true`, `NANGO_PUBLIC_CONNECT_URL=https://connect.flynnai.app`, DB vars, dashboard basic-auth. Callback = `https://connect.flynnai.app/oauth/callback`.
   - In the self-hosted dashboard recreate provider configs `google-calendar` + `google-sheet` (NOT gmail yet) on the same Google client; grab the new `NANGO_SECRET_KEY`.

B. Point Flynn at it (no downtime — Cloud keeps working until cutover)
   - Fly secrets on flynnai-telephony: `NANGO_HOST=https://connect.flynnai.app`, `NANGO_SECRET_KEY=<self-hosted>`. Deploy. (`NANGO_WEBHOOK_SECRET` now unused; webhook route stays harmless.)
   - Confirm the Connect UI's post-consent redirect field against the live instance and point it at `https://flynnai-telephony.fly.dev/connected?c=<code>` (wire into `nango.createConnectSession`). If unsupported, the inbound poll-reconcile already covers completion.

C. Google Cloud + verification (Calendar + Sheets only)
   - OAuth client: set Authorized redirect URI to `https://connect.flynnai.app/oauth/callback` (replaces api.nango.dev). Data Access scopes = calendar.readonly, calendar.events, spreadsheets, drive.file. Remove gmail.modify for now.
   - Verify `connect.flynnai.app` + `flynnai.app` in Google Search Console (Cloudflare TXT); add as authorized domains on the consent screen.
   - Privacy policy (`flynnai.app/privacy`): add Google "Limited Use" disclosure (no training generalized models on Google data). Homepage must describe the product + link the policy.
   - Set a monitored contact email on the consent screen (not a personal address).
   - Record demo video: full OAuth flow showing the real consent screen w/ the exact scopes, then the feature using each scope (book into calendar; log a receipt into the sheet).
   - Write one scope justification per scope (feature + why narrower won't work).
   - Publish app → Verification Center → Submit (scroll to the bottom — the Submit button sits below the per-error Proceed buttons). Reply to Google within 24-48h; sensitive-only usually clears in <1 week.
