# Claude Code — project instructions

This repo generates AI UGC (user-generated content) marketing videos via the fal.ai queue API. Pipeline: Nano Banana edit (selfie still) → Veo 3 Fast image-to-video (animated talking video).

## First-time setup

If `.env` does not exist, tell the user to run `./scripts/setup.sh` or walk them through:
1. Copy `.env.example` to `.env`.
2. Paste their fal.ai key into `.env` (line: `FAL_KEY=`). Get one at https://fal.ai/dashboard/keys.
3. Run `./scripts/check-fal-env.sh` to verify.

If `MASTER_CONTEXT.md` does not exist, copy `MASTER_CONTEXT.template.md` to `MASTER_CONTEXT.md`.

## Every session

1. Read **[MASTER_CONTEXT.md](MASTER_CONTEXT.md)** for default character, default product, brand voice, pricing overrides, and accumulated learnings.
2. Use the skill at `.claude/skills/fal-ugc-video/SKILL.md` for the API workflow, prompts, and polling.
3. If `MASTER_CONTEXT.md` has empty fields (default character, default product, pricing), offer to populate them — ask the user and **write the values back into `MASTER_CONTEXT.md`** so future sessions have them.

## After significant changes

Append a short dated note to **MASTER_CONTEXT.md** under Changelog (Decision / What changed / Why).

## Skill edits

Edit the canonical source under `skills/fal-ugc-video/`. Run `./scripts/sync-skill.sh` to copy changes to `.claude/skills/` and `.cursor/skills/`. The `SessionStart` hook in `.claude/settings.json` runs sync-skill.sh automatically when you open the project, so manual sync is only needed mid-session after edits.

## Repo-specific notes

- **API:** fal.ai queue API (`https://queue.fal.run`).
- **Auth:** `Authorization: Key $FAL_KEY` header. `FAL_KEY` is loaded from `.env` (gitignored).
- **Cost:** Always present generation costs as **estimates** before firing. Actuals appear in https://fal.ai/dashboard. Log every call to `logs/fal-api.jsonl` so future estimates get more accurate.
- **Two-step pipeline gate:** Never skip showing the still for user approval before generating the video. Stills are ~$0.04, videos are ~$2.
- **Dialogue gate:** Before any video with spoken dialog, present the script as a numbered block and wait for explicit approval (separate from cost confirmation).
