# Agent instructions

This repository is set up for AI coding agents (Cursor, Claude Code, Copilot-style tools) to generate AI UGC marketing videos via the fal.ai queue API.

## First-time setup

If `.env` or `MASTER_CONTEXT.md` do not exist, tell the user to run `./scripts/setup.sh`.

## Every session

1. Read **[MASTER_CONTEXT.md](MASTER_CONTEXT.md)** for default character, default product, brand voice, pricing overrides, and accumulated learnings.
2. Follow the skill at `.cursor/skills/fal-ugc-video/SKILL.md` or `.claude/skills/fal-ugc-video/SKILL.md` (synced from `skills/fal-ugc-video/` via `scripts/sync-skill.sh`).
3. If `MASTER_CONTEXT.md` has empty fields (default character, default product, pricing), offer to populate them — ask the user and write the values back so future sessions have them.
4. After material changes, add a dated entry to **MASTER_CONTEXT.md** Changelog.

## This repo specifically

- **API:** fal.ai queue API (`https://queue.fal.run`).
- **Auth:** `Authorization: Key $FAL_KEY` header on every request. Key lives in `.env` (gitignored).
- **Models used:**
  - `fal-ai/nano-banana/edit` — UGC selfie still composition (character + product + style refs).
  - `fal-ai/nano-banana` — text-to-image for new character sheets.
  - `fal-ai/veo3/fast/image-to-video` — default for talking UGC video (~$2 / 8s).
  - `fal-ai/veo3.1/image-to-video` — premium talking video (~$3.20 / 8s).
  - `fal-ai/kling-video/v2.5-turbo/standard/image-to-video` — silent UGC variant (~$0.35 / 5s).
- **Setup check:** `./scripts/check-fal-env.sh`.
- **Logging:** every generation call gets one line in `logs/fal-api.jsonl` (request config + final cost + URL). See [logs/README.md](logs/README.md).
- **Two-step rule:** never generate a video without first generating + showing + getting approval on the Nano Banana selfie still. Stills are cheap, video is not.
- **Dialogue gate:** never generate a talking video without explicit user approval of the spoken script (presented as a numbered block, separate from cost confirmation).
