# Flynn AI — Daily GTM Ops Automation

Goal: open laptop in the morning, get a single email at 7:30am AEST listing today's outbound queue. Cold emails fire automatically; FB groups + IG DMs need 30 min of human time with prefilled scripts.

Target: 100 paying customers by 30 June 2026. Daily reach goal: ~100 net-new business eyeballs.

## What this system does (per day)

| Channel | Target | Mode | Where |
|---|---|---|---|
| Cold email | 30 sends | Fully automated | Instantly.ai (existing "Flynn" campaign) |
| Cold email leads added | 30 new contacts | Fully automated | Apify → Instantly via webhook |
| Facebook trade groups | 5 posts/comments | Manual, prefilled | Email links + scripts |
| Instagram DM partnerships | 15-20 DMs | Manual, prefilled | Email links + scripts |
| Metrics | Yesterday's results | Fully automated | Email |

## Architecture

```
                        ┌──────────────────────────┐
                        │   Cron @ 7:30am AEST     │
                        │   (GitHub Actions or VPS)│
                        └──────────┬───────────────┘
                                   │
            ┌──────────────────────┼──────────────────────┐
            ▼                      ▼                      ▼
    ┌──────────────┐      ┌──────────────┐      ┌──────────────┐
    │ Apify        │      │ Airtable     │      │ Supabase     │
    │ Google Maps  │      │ FB groups +  │      │ users +      │
    │ scraper      │      │ IG targets + │      │ subscriptions│
    │              │      │ post log     │      │              │
    └──────┬───────┘      └──────┬───────┘      └──────┬───────┘
           │                     │                      │
           ▼                     ▼                      ▼
    ┌──────────────────────────────────────────────────────────┐
    │              morning-brief.ts                            │
    │  - filter unposted FB groups (>7 days)                   │
    │  - rotate IG targets (avoid duplicates)                  │
    │  - upload new leads to Instantly campaign                │
    │  - read yesterday's RevenueCat / Supabase events         │
    │  - render daily brief HTML email                         │
    └──────────────────────────┬───────────────────────────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │ Resend / Postmark    │
                    │ → atticusjxn@gmail   │
                    └──────────────────────┘
```

## What you need to provision (one-time, ~2 hours)

| Service | Purpose | Cost | Required keys |
|---|---|---|---|
| **Instantly.ai** (already have it) | Cold email sequencing + sending | Existing | `INSTANTLY_API_KEY`, campaign ID for "Flynn" |
| **Apify** | Google Maps scraper for AU tradies | $49/mo starter plan | `APIFY_TOKEN` |
| **Airtable** | Source-of-truth for FB groups, IG targets, daily log | Free tier | `AIRTABLE_API_KEY`, `AIRTABLE_BASE_ID` |
| **Resend** | Send the morning brief email | Free tier (3k emails/mo) | `RESEND_API_KEY` |
| **GitHub Actions** | Free cron host | Free | none — uses repo secrets |
| **Supabase** (already have it) | Read yesterday's trial/paid events | Existing | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| **RevenueCat** (already have it) | Read paid conversion events | Existing | `REVENUECAT_API_KEY` (REST API v2) |

Total monthly cost: ~$50–80 (Apify only paid line item).

## Setup steps

1. **Provision external accounts** — sign up for Apify + Resend if you haven't. Confirm Instantly + Airtable.
2. **Build the Airtable base** — see `airtable-schema.md`. Two main tables: `FBGroups`, `IGTargets`. Plus `DailyLog` for metrics history.
3. **Seed the FB groups + IG targets** — initial list provided in `templates/seed-data/`. ~20 AU trade FB groups + ~50 starter IG accounts.
4. **Wire Apify Google Maps scraper** — the actor `compass/crawler-google-places` configured to rotate AU city × trade combos daily. Config in `scripts/apify-task-config.json`.
5. **Run `npm install`** in `gtm-automation/` to install the morning-brief deps.
6. **Set env vars** — copy `.env.example` to `.env` and fill in keys.
7. **Test once locally** — `npm run brief` should send a test email to your inbox.
8. **Deploy cron** — push to a private GitHub repo with Actions enabled, or run `npm run cron` on a $5 Hetzner box.

## Daily workflow (your end)

Morning email arrives at 7:30am AEST with sections:

```
GOOD MORNING ATTICUS — Today's Flynn GTM brief
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 YESTERDAY (7 May)
  Trial starts:        4   ← cold email: 2, IG DM: 1, organic: 1
  Paid conversions:    1   ← $29 starter, AU
  Running total:      14 / 100   ← 14% to goal
  CAC blended:       $32
  Top-performing:    Cold email (3 trial starts this week)

📧 COLD EMAIL — 30 sent automatically (9am, 11am, 2pm AEST)
  Today's batch: Plumbers — Brisbane (rotation day 1 of 7)
  Sequence: Email 1 of 4 (Mates Rates intro)
  Hot replies overnight: 2 — open Instantly: [link]

📱 INSTAGRAM DMs — 18 prefilled (target: 15-20)
  1. @sparky_sister_au       12k followers · electrician AU      script: REV_SHARE
  2. @melb_plumber_dave       8k followers · plumber Melbourne    script: FREE_MONTH
  3. @hairsalon_owners_au    21k followers · salon AU             script: REV_SHARE
  ...
  [Open IG with prefilled DMs: link]

👥 FACEBOOK GROUPS — 5 to engage
  1. Plumbers Australia (28k members) — last posted: never
     Suggested post: VALUE_QUESTION_1 — preview: [link]
  2. Electricians Australia (19k) — last posted: 11 days ago
     Suggested post: CASE_STUDY_2 — preview: [link]
  ...
  [Open all 5 in tabs: link]

⚠️ NEEDS YOUR ATTENTION
  - Instantly campaign warming buffer at 91% — consider adding inbox 4
  - Apple Search Ads CPI rose to $4.20 (from $2.80) — review keyword bids
  - 3 trial users hit day 12 today — manual nudge?

💡 PROMPTS FOR FOUNDER CONTENT (reach goal: 3 posts/week)
  - Twitter thread: "How a Brisbane plumber saved 2 hours/day with an AI receptionist"
  - LinkedIn post: "Why I built Flynn AI for AU tradies"
  - Instagram reel: Voice clip of Flynn answering a real call
```

## Files

```
gtm-automation/
├── README.md                     ← this file
├── airtable-schema.md            ← copy-paste base schema
├── package.json                  ← morning-brief deps
├── tsconfig.json
├── .env.example
├── morning-brief.ts              ← the daily script (entry point)
├── lib/
│   ├── airtable.ts               ← Airtable client + queries
│   ├── instantly.ts              ← Instantly campaign helpers
│   ├── apify.ts                  ← Apify scraper helpers
│   ├── supabase.ts               ← yesterday's events
│   ├── revenuecat.ts             ← paid conversions
│   └── email.ts                  ← Resend brief renderer
├── templates/
│   ├── cold-email/               ← rewritten for $29 pricing
│   │   ├── 01-day1-intro.md
│   │   ├── 02-day3-social-proof.md
│   │   ├── 03-day7-urgency.md
│   │   └── 04-day10-breakup.md
│   ├── instagram-dm/             ← 3 scripts (REV_SHARE, FREE_MONTH, FEEDBACK)
│   │   ├── REV_SHARE.md
│   │   ├── FREE_MONTH.md
│   │   └── FEEDBACK.md
│   ├── facebook-groups/          ← post scripts by intent
│   │   ├── VALUE_QUESTION.md
│   │   ├── CASE_STUDY.md
│   │   └── GENUINE_HELP.md
│   └── seed-data/
│       ├── fb-groups-seed.csv    ← 20 AU trade FB groups
│       └── ig-targets-seed.csv   ← 50 starter IG accounts
├── scripts/
│   ├── apify-task-config.json    ← scraper config: AU cities × trades
│   ├── instantly-upload.ts       ← upload Apify CSV → Instantly
│   └── seed-airtable.ts          ← one-time seed import
└── n8n-workflows/                ← optional alternative to GitHub Actions
    └── README.md
```

## CAC kill criteria (from main GTM plan)

| Channel CAC | Action |
|---|---|
| < $30 | Triple budget |
| $30-50 | Double budget |
| $50-80 | Maintain, optimise |
| $80-120 | Narrow targeting, last-chance week |
| > $120 | Kill, redeploy |

For cold email: <1% reply rate after 1k sends → rewrite. <0.3% trial rate → narrow ICP.
For IG DMs: <8% reply rate → rewrite opener.

## What this system does NOT do

- It does NOT auto-send IG DMs or FB group posts. AU SPAM Act + IG/FB anti-bot defences make automation risky and bannable. You manually click + send with prefilled scripts.
- It does NOT replace your existing Instantly campaign — it feeds new AU leads into it daily.
- It does NOT manage paid ads (ASA, Meta, TikTok). That's separate work in their dashboards.
- It does NOT generate content. The "founder content prompts" section is suggestion-only.
