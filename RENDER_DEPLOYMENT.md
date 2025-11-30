# Flynn AI – Render Deployment Guide

This guide migrates the AI receptionist backend from Railway to Render. Render supports inbound webhooks and long‑lived WebSocket connections needed for Twilio Media Streams and your realtime receptionist.

---

## What you’ll deploy

- Web service: Node/Express (`server.js`) with:
  - Twilio voice webhook: `/telephony/inbound-voice`
  - Recording callback: `/telephony/recording-complete`
  - WebSockets for realtime: `/realtime/twilio` (attached via `attachRealtimeServer`)
  - Health check: `/health`

---

## Option A: One‑click via Blueprint (`render.yaml`)

1. Commit the included `render.yaml` (already added at repo root).
2. In Render Dashboard → Blueprints → New Blueprint → Connect this repo.
3. On creation, Render will prompt for the `sync: false` env vars.
4. Deploy. Render will build with `npm ci --omit=dev` and start `node server.js`.

Notes
- `healthCheckPath` is set to `/health`.
- `NODE_VERSION` pinned to 20 for compatibility.
- You can change plan/region in `render.yaml` (`plan: starter`, `region: ohio`).

---

## Option B: Manual Web Service setup

1. Render Dashboard → New → Web Service → Connect repo.
2. Runtime: Node.
3. Build Command: `npm ci --omit=dev` (or `npm install --omit=dev`).
4. Start Command: `node server.js`.
5. Health Check Path: `/health`.
6. Create the service and add environment variables (below), then redeploy.

---

## Required environment variables

Provide these in Render → Service → Environment. Do not commit secrets.

- Core
  - `NODE_ENV=production`
  - `SERVER_PUBLIC_URL` → Set after first deploy to the Render URL (see below)
- Supabase
  - `SUPABASE_URL` (or `EXPO_PUBLIC_SUPABASE_URL`)
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `SUPABASE_JWT_SECRET` (or `SUPABASE_ANON_JWT_SECRET` for JWT auth in `authenticateJwt`)
- Twilio
  - `TWILIO_ACCOUNT_SID`
  - `TWILIO_AUTH_TOKEN`
  - `TWILIO_FROM_NUMBER` (or `TWILIO_SMS_FROM_NUMBER`)
  - `TWILIO_MESSAGING_SERVICE_SID` (optional if using Messaging Service)
- AI Providers
  - `OPENAI_API_KEY`
  - `DEEPGRAM_API_KEY`
  - `ELEVENLABS_API_KEY`
  - `ELEVENLABS_MODEL_ID` (default set to `eleven_multilingual_v2`)
  - Optional voice presets: `ELEVENLABS_VOICE_FLYNN_WARM_ID`, `ELEVENLABS_VOICE_FLYNN_EXPERT_ID`, `ELEVENLABS_VOICE_FLYNN_HYPE_ID`
- Receptionist behavior
  - `ENABLE_CONVERSATION_ORCHESTRATOR=true`
  - `MAX_QUESTIONS_PER_TURN=1`
  - `MIN_ACK_VARIETY=3`
- Storage and retention
  - `VOICE_PROFILE_BUCKET=voice-profiles`
  - `VOICEMAIL_STORAGE_BUCKET=voicemails`
  - `VOICEMAIL_SIGNED_URL_TTL_SECONDS=3600`
  - `VOICEMAIL_RETENTION_DAYS=30`

Render injects `PORT`; the server already uses it. Do not set `PORT` manually.

---

## After first deploy

1. Find your URL in Render → Service → URL, e.g. `https://flynnai-telephony.onrender.com`.
2. Set `SERVER_PUBLIC_URL` to that value and redeploy. This ensures:
   - Twilio Media Stream websocket URL generation uses `wss://.../realtime/twilio`.
   - Recording callback construction targets the public base URL.

---

## Update Twilio webhooks

In Twilio Console → Phone Numbers → Active Numbers → your number → Voice Configuration:
- A Call Comes In: `https://<your-render-url>/telephony/inbound-voice` (POST)
- Recording Status Callback (if used): `https://<your-render-url>/telephony/recording-complete` (POST)

Signature validation:
- Enabled by default. Set `TWILIO_VALIDATE_SIGNATURE=false` temporarily for debugging only.

---

## WebSockets on Render

WebSockets are supported on Render web services by default.
- Your server attaches a WS server to the HTTP server (`attachRealtimeServer`).
- Twilio connects to `wss://<your-render-url>/realtime/twilio` per the TwiML stream configuration.

---

## Custom domains and HTTPS

Render issues free TLS certs. To add a custom domain:
- Render → Service → Settings → Custom Domains → Add domain
- Once active, update `SERVER_PUBLIC_URL` to `https://<your-domain>` and redeploy.
- Update Twilio webhooks to the new domain.

---

## Zero‑downtime deploys and health checks

- Health check path: `/health` (already in `server.js`).
- Render waits for healthy status before switching traffic.

---

## Troubleshooting

- 403 from Twilio webhooks:
  - Ensure `TWILIO_AUTH_TOKEN` is correct (signature validation needs it).
  - If behind a proxy, `app.set('trust proxy', true)` is already enabled.
- Missing audio uploads:
  - Verify Supabase credentials and buckets (`voicemails`, `voice-profiles`).
- Realtime not engaging:
  - Confirm `ENABLE_CONVERSATION_ORCHESTRATOR=true`.
  - Check logs for Deepgram/OpenAI credentials.
- Signed URL errors:
  - Ensure `SUPABASE_SERVICE_ROLE_KEY` is set and valid.

---

## Manual test checklist

1. GET `/<health>` returns 200.
2. POST `/telephony/inbound-voice` via Twilio webhook → receptionist engages or routes per mode.
3. Recording callback POST `/telephony/recording-complete` stores audio to Supabase and persists metadata.
4. Realtime: watch logs while placing a call to confirm WS connection established.

