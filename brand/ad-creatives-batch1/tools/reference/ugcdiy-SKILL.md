---
name: fal-ugc-video
description: >-
  Generates AI UGC (user-generated content) selfie-style marketing videos via the fal.ai queue API.
  Two-step pipeline: (1) Nano Banana edit creates a photoreal selfie still combining an AI character +
  product + style refs; (2) Veo 3 Fast (image-to-video) animates the approved still with dialog.
  Optional silent variant via Kling 2.5 Turbo. Reads FAL_KEY from .env. Use when the user wants UGC
  ads, AI influencer videos, product testimonial reels, or selfie-style marketing creative.
---

# fal.ai UGC Video

The shortest reliable path to a UGC ad is **two steps**:

1. **Still:** Nano Banana edit composes a selfie of an AI character holding/using the product.
2. **Video:** Veo 3 Fast image-to-video animates the still and generates the spoken dialog.

Everything else (Kling for silent B-roll, Sora 2 if available) is optional.

## Configuration

- **Base URL:** `https://queue.fal.run` (override with `FAL_QUEUE_URL`).
- **Auth:** `Authorization: Key $FAL_KEY` header. Load from `.env` — never paste the key in chat.
- **If 401/403 or `FAL_KEY` missing:** Tell the user to run `./scripts/setup.sh`. Never ask them to paste the key into chat.

## Read order (every session)

1. **`MASTER_CONTEXT.md`** at repo root — brand voice, default character, learnings, pricing.
2. **[reference.md](reference.md)** — exact endpoints, request bodies, polling.
3. The right prompt-library file for what the user asked for:
   - **[prompting/ugc-selfie-still.md](prompting/ugc-selfie-still.md)** — Nano Banana edit prompt formula for the selfie still.
   - **[prompting/ugc-video-i2v.md](prompting/ugc-video-i2v.md)** — Veo 3 Fast prompt formula for the animated video with dialog.
   - **[prompting/character-sheet.md](prompting/character-sheet.md)** — generate a new AI influencer (10-image character sheet) when the user wants a fresh face.

## Decision tree

| User goal | Models | Prompt library |
|-----------|--------|----------------|
| **Standard UGC ad** (selfie still → talking video) | Nano Banana edit → Veo 3 Fast i2v | `ugc-selfie-still.md` + `ugc-video-i2v.md` |
| **Cheaper silent B-roll** (no dialog) | Nano Banana edit → Kling 2.5 Turbo i2v | `ugc-selfie-still.md` + note in `ugc-video-i2v.md` |
| **Higher-quality talking video** (premium budget) | Nano Banana edit → Veo 3.1 i2v | same as standard, swap model |
| **New AI influencer** (10-image character sheet) | Nano Banana edit (text-to-image, then 9 angles with hero as ref) | `character-sheet.md` |
| **Direct still without character/product** | Nano Banana text-to-image (`fal-ai/nano-banana`) | `ugc-selfie-still.md` |

Default: **Veo 3 Fast** for talking UGC. Only switch if the user explicitly asks for cheaper silent (Kling) or premium (Veo 3.1).

## Cost estimation (MANDATORY — show before generating)

Before firing **any** generation call, present an estimate to the user and **wait for confirmation**.

> **Always label totals as estimates. fal.ai bills against the prepaid balance shown at https://fal.ai/dashboard. The exact charge appears in the dashboard after each call.**

### Default rates (USD, as of 2026-05)

| Model | Endpoint | Rate | 8s talking video | Notes |
|-------|----------|------|------------------|-------|
| Nano Banana edit | `fal-ai/nano-banana/edit` | ~$0.04 / image | — | 1 generation = 1 image |
| Veo 3 Fast i2v | `fal-ai/veo3/fast/image-to-video` | ~$0.25 / sec | ~$2.00 | speech in prompt |
| Veo 3.1 i2v | `fal-ai/veo3.1/image-to-video` | ~$0.40 / sec | ~$3.20 | speech in prompt, premium |
| Kling 2.5 Turbo i2v | `fal-ai/kling-video/v2.5-turbo/standard/image-to-video` | ~$0.07 / sec | ~$0.56 | **silent**, 5s or 10s |

**Always update from `MASTER_CONTEXT.md` if the user has overridden these.** After each generation, append the actual charge (from `logs/fal-api.jsonl` or the user's dashboard) so future estimates get more accurate.

### Cost-data priority

1. **`logs/fal-api.jsonl`** — historical actuals from previous calls. Grep first.
2. **`MASTER_CONTEXT.md` → Pricing** — user overrides.
3. **The default table above** — fallback.

### Example to user

```
Estimated cost:
  Nano Banana edit (1 still)                 ~$0.04
  Veo 3 Fast (8s talking video)              ~$2.00
  ──────────────────────────────────────
  Estimated total                            ~$2.04

⚠️  Estimate only. Confirm exact charge in https://fal.ai/dashboard.
Proceed? (yes/no)
```

Wait for explicit `yes`. **Exception — image QA retries:** auto-regenerating a defective still (see [Image QA](#generated-image-qa-mandatory)) does not need a second confirmation, but each retry is billed.

## Variations

Before any generation, **ask the user how many variations** they want for the same prompt. Default 1. When N > 1, fire **N separate POSTs** (fal has no batch parameter) in parallel, then poll all `request_id`s concurrently. Present the results as a numbered list.

## Two-step UGC pipeline (the main workflow)

### Step 1 — Selfie still (Nano Banana edit)

1. **Pick a character.** Check `references/influencers/` for existing characters; default to whichever `MASTER_CONTEXT.md` lists as the default character. If none, ask. Use the hero image (`01-hero-front.jpg`) as the primary reference.
2. **Pick the product.** Check `references/products/` or ask.
3. **Pick style refs.** Use 1–3 images from `references/aesthetics/ugc-selfie/` for the iPhone-selfie aesthetic.
4. **Compose the prompt** per [prompting/ugc-selfie-still.md](prompting/ugc-selfie-still.md). Always include:
   - Camera-imperfection block (motion blur, slight overexposure, grain, off-center framing).
   - Skin-realism block (visible pores, slight unevenness, undereye shadows, natural oils — never use "acne/pimples/blemishes").
   - Negative phrasing: no captions, no text overlays, no subtitles.
5. **Upload local images** to fal.ai storage (`POST https://rest.alpha.fal.ai/storage/upload/initiate` per [reference.md](reference.md)) OR pass public HTTPS URLs in `image_urls`. Order: character hero → product → style refs.
6. `POST https://queue.fal.run/fal-ai/nano-banana/edit` with `prompt` + `image_urls` (array of 2–5 URLs). See [reference.md](reference.md).
7. **Poll** `GET .../requests/{request_id}/status` every ~3s until `COMPLETED`, then `GET .../requests/{request_id}` for the result.
8. **Log** to `logs/fal-api.jsonl` (see [logs/README.md](../../logs/README.md) for schema).
9. **QA** the output — see [Image QA](#generated-image-qa-mandatory).
10. **Show the still and wait for user approval before Step 2.** Stills are cheap to iterate, video is not.

### Step 2 — Video (Veo 3 Fast image-to-video)

After the user approves the still:

1. **Get the script.** Ask the user for the exact words the AI person should say. Run the [Dialogue confirmation gate](#dialogue-confirmation-gate-mandatory) before generation.
2. **Compose the video prompt** per [prompting/ugc-video-i2v.md](prompting/ugc-video-i2v.md). Embed the dialog in a `She/He says: "..."` pattern. Add 3–4 motion cues (eye contact break, head tilt, weight shift, grip adjustment). Append the no-captions clause.
3. **Pick duration** based on script length (~2.5 words/sec). Veo 3 Fast supports `4s`, `6s`, `8s`. Round up.
4. `POST https://queue.fal.run/fal-ai/veo3/fast/image-to-video` with `prompt`, `image_url` (the approved still URL from step 1.7), `duration`. See [reference.md](reference.md).
5. **Poll** until `COMPLETED` (Veo 3 Fast typically takes 60–120s).
6. **Log** to `logs/fal-api.jsonl`.
7. **Save** the video to `outputs/<YYYY-MM-DD>/<character>-<product>-v<N>.mp4` and `open` the folder so the user can review.

## Dialogue confirmation gate (MANDATORY)

Before generating **any** video that contains spoken dialog, the agent MUST:

1. **Extract the dialog** from the drafted prompt and present it separately from the visual description.
2. **Show as a numbered list** with beat labels (HOOK / SHOW / DEMO / VERDICT or similar). Mark silent beats `(silent beat — no dialog)`.
3. **Time it.** Count words, divide by ~2.5 words/sec, compare against target duration. Flag if too long.
4. **Ask for explicit approval.** Never assume approval from earlier confirmations (cost, character pick).

**Format:**

```
📝 Dialog script (please confirm before I generate)

  1. [HOOK]    "Bro. BRO. Look what just showed up."
  2. [SHOW]    "The PAID SOCIAL stripe? Insane. Who greenlit this?"
  3. [DEMO]    (silent beat — thumb brushing the suede, small nod)
  4. [VERDICT] "I'm wearing these to the gym tomorrow. You guys have to see these in person."

Total spoken words: ~28  |  Target duration: 8s  |  Fits at natural pace: ⚠️ tight (over by ~3s)

Approve, edit, or rewrite?
```

Only after the user types `yes` (or equivalent) may you proceed to cost confirmation, then generation.

## Script length → video duration (auto-select)

Pace: **~2.5 words/sec** (~150 WPM). Round **up**.

### Veo 3 Fast i2v — duration: `4s`, `6s`, `8s`

| Script length | Duration |
|---------------|----------|
| 1–8 words | 4s |
| 9–14 words | 6s |
| 15–20 words | 8s |
| **21+ words** | **Too long for one Veo 3 Fast clip** — split into segments or switch to Veo 3.1 (also 4–8s) — both have the same max. Offer to chain two i2v calls (the second starts from the last frame of the first). |

### Veo 3.1 i2v — same as above (4s, 6s, 8s)

### Kling 2.5 Turbo i2v — duration: `5s`, `10s` (silent only)

For silent UGC. Default 5s; use 10s if the user wants more time on screen.

## Generated image QA (MANDATORY)

Applies to **stills from Nano Banana edit**. After each image reaches `COMPLETED`, **visually inspect** the output (the result includes a public image URL — read it).

**Look for:** extra/missing fingers; wrong limb count; merged or duplicated faces; melted/fused objects; impossible anatomy; obvious texture artifacts; garbled text if text was requested.

**If defective:** Regenerate with a **revised prompt** that explicitly corrects the issue ("exactly two hands, five fingers each", "single face, no duplicates"). Do not resend the identical payload.

**Retry cap:** Up to **2 regenerations per requested image** (3 attempts total). After the cap, stop, show the user the best attempt + URLs of all attempts, and ask how to proceed.

**Each retry is billed** — note the extra cost when summarizing.

## File upload to fal.ai

For local reference images, upload them to fal.ai's storage and use the returned URL.

```bash
# Step 1: get presigned URL
curl -X POST https://rest.alpha.fal.ai/storage/upload/initiate \
  -H "Authorization: Key $FAL_KEY" \
  -H "Content-Type: application/json" \
  -d '{"file_name": "hero.jpg", "content_type": "image/jpeg"}'
# Response: { "upload_url": "...", "file_url": "https://v3.fal.media/files/..." }

# Step 2: PUT the file
curl -X PUT "$upload_url" \
  -H "Content-Type: image/jpeg" \
  --data-binary @references/influencers/sofia/01-hero-front.jpg

# Step 3: use file_url in image_urls / image_url
```

See [reference.md](reference.md) for the full upload spec.

**Image-size note:** If a reference image's longest side is below **1024 px**, upscale to **1080 px** (Lanczos) and re-encode as RGB JPEG quality 90–95 before upload. Keeps requests reliable.

## Output organization

Save generated assets to:

```
outputs/<YYYY-MM-DD>/
  ├── <character>-<product>-still-v1.png     # approved still
  ├── <character>-<product>-still-v1-attempt-2.png   # QA retries
  ├── <character>-<product>-video-v1.mp4
  └── <character>-<product>-video-v2.mp4     # extra variations
```

**Always `open outputs/<YYYY-MM-DD>/`** (macOS) after the generation batch completes so the user can review immediately.

## Errors

| Code | Meaning | Action |
|------|---------|--------|
| 401 / 403 | Bad or missing key | Re-run `./scripts/setup.sh` |
| 404 (on status poll) | Wrong `request_id` or wrong model path | Re-check the URL components |
| 422 | Validation / moderation block | Tighten prompt, remove disallowed content |
| 429 | Rate limited | Back off (wait 5–10s, retry once) |
| 500 / 502 / 503 | fal-side outage | Wait and retry once; if persistent, stop and report |

## Execution checklist (agent)

1. **`MASTER_CONTEXT.md`** — read it.
2. **Character + product + style refs** — pick from `references/` or ask.
3. **Compose still prompt** per `ugc-selfie-still.md`. Upload local images.
4. **Show cost estimate for still + planned video** → wait for confirmation.
5. **POST Nano Banana edit** N times (one per requested still variation).
6. **Log** every POST to `logs/fal-api.jsonl`.
7. **Poll** all `request_id`s concurrently; update log entries with final status + URL.
8. **Image QA** loop (max 2 retries per image).
9. **Show stills, wait for approval.**
10. **Get dialog script** from the user.
11. **Dialogue confirmation gate** → wait for `yes`.
12. **Compose video prompt** per `ugc-video-i2v.md`. Pick duration from word count.
13. **POST Veo 3 Fast i2v** N times (one per requested video variation, each using the approved still URL).
14. **Log** every POST.
15. **Poll** all video `request_id`s concurrently.
16. **Save** to `outputs/<date>/`, `open` the folder.
17. **Append a Changelog entry** to `MASTER_CONTEXT.md` if the session produced a new approved character / new pricing data / new prompt formula.

## Supporting files

- [reference.md](reference.md) — exact endpoints, request/response shapes, polling, file upload.
- [prompting/ugc-selfie-still.md](prompting/ugc-selfie-still.md) — Nano Banana edit prompt formula.
- [prompting/ugc-video-i2v.md](prompting/ugc-video-i2v.md) — Veo 3 Fast i2v prompt formula.
- [prompting/character-sheet.md](prompting/character-sheet.md) — generate a fresh AI influencer (10 images).
