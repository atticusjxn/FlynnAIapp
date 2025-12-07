# FlynnAI Sites Backend (Gemini 3 Pro)

## What this does
- POST `/api/sites/generate` (auth required) ingests an Instagram handle, runs Gemini for:
  - Business/brand insight (text only)
  - Image role tagging (vision)
  - Site spec generation (copy + palette + layout hints)
- Returns `{profile, insight, assets, rawAssets, siteSpec, warnings}`.

## Required env
- `GEMINI_API_KEY` (Google Generative AI key).
- `GEMINI_TEXT_MODEL` (optional, default `gemini-3.0-pro`).
- `GEMINI_VISION_MODEL` (optional, default same as text model).
- `INSTAGRAM_GRAPH_TOKEN` (long-lived IG Graph token for the connected business account).
- `INSTAGRAM_BUSINESS_ID` (IG business/user id for the token context).

## Usage notes
- Body: `{ "handle": "@username", "imageLimit": 12 }` (limit is clamped 1-25).
- If IG creds are missing, the route responds with `success: true` but empty `posts` and a warning; Gemini will still run but with sparse input.
- Image tagging downloads media URLs directly; ensure outbound network access and that media is public.
- All Gemini calls request JSON (`responseMimeType: application/json`) for deterministic downstream parsing.

## Next steps
- Persist outputs to Supabase tables/buckets once schema is ready (current flow is stateless).
- Add NSFW review gate + face blurring before hero/background usage.
- Swap IG fetch to a queue/worker if rate-limiting becomes an issue.
