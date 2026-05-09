# Flynn GTM Morning Routine — Claude Code routine prompt

This is the prompt body for the scheduled Claude Code routine `flynn-gtm-morning`.
It runs on Anthropic's infrastructure against the Claude Max subscription — no API billing.

## Cron

`0 20 * * 1-5` UTC → 06:00 AEST (07:00 AEDT) Mon–Fri.

## Required secrets

Set these in the routine config before first run:

- `APIFY_TOKEN`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GMAIL_APP_PASSWORD`
- `GMAIL_FROM_EMAIL`
- `GMAIL_FROM_NAME`
- `BRIEF_TO_EMAIL` (used for test sends)
- `REVENUECAT_API_KEY`
- `REVENUECAT_PROJECT_ID`
- `GOAL_PAID_CUSTOMERS` (optional, default 100)
- `GOAL_DEADLINE` (optional, default 2026-08-31)
- `GOAL_START_DATE` (optional, default 2026-05-08)

## Routine prompt (copy verbatim into /schedule create)

```
You are running Flynn's morning GTM routine. The repo is FlynnAIapp; all GTM
scripts live under gtm-automation/. Today's job is to scrape leads, write
personalised outreach in-session (no API calls), send the cold-email batch,
build today's morning briefing, and stop. Be terse in your final summary.

Steps in order:

1. cd gtm-automation && npm ci  (use npm install if package-lock missing)

2. Run `npm run scrape`. This uses the Apify Google Maps actor to find AU
   tradies with <50 reviews, a phone in the listing, a website, and at least
   one recent review matching the missed-call regex. It populates
   gtm_cold_leads with review_snippet and review_keywords. Target: 20 new
   leads. If <20, the script auto-tries up to 4 trade × city combos.

3. Query Supabase for today's not-sent personalised candidates:
   SELECT id, email, first_name, company, trade, city, review_snippet
     FROM gtm_cold_leads
    WHERE personalized_body IS NULL
      AND sent_at IS NULL
      AND review_snippet IS NOT NULL
    ORDER BY scraped_at DESC
    LIMIT 20;

   For each row, write a personalised cold email and UPDATE the row with
   personalized_subject + personalized_body. Rules for the body:
     - 80–120 words, plain text only.
     - Open with a reference to the missed-call review snippet.
     - Mention Flynn captures missed calls and texts the caller back a
       booking link so they don't lose the job.
     - One soft CTA: offer to set them up free for a month.
     - Sign-off: "— Atticus" (no signature block).
     - Subject ≤ 50 chars, no spam triggers (no all-caps, no $$$, no exclamations).
     - No emojis. No 'Hi {{firstName}}' style placeholders — use the actual name
       (or 'mate' if first_name is null).

   Use a single SQL transaction per row via the Supabase REST API or
   `psql` (whichever is available in the sandbox). Connection details are in
   SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY env vars.

4. Run `npm run send:batch:personalized`. Sends up to 20 emails via Gmail
   SMTP, logs to gtm_email_outreach, marks gtm_cold_leads.sent_at.

5. Run `npm run scrape:ig-trades`. Discovers AU trade IG accounts with
   100–2000 followers; populates gtm_ig_trade_targets with ai_message NULL.

6. Query for today's IG candidates with ai_message NULL:
   SELECT id, handle, business_name, trade, city, follower_count, bio
     FROM gtm_ig_trade_targets
    WHERE ai_message IS NULL
    ORDER BY created_at DESC
    LIMIT 15;

   For each row, write a 50–100 word colloquial DM and UPDATE ai_message.
   Rules:
     - lowercase, conversational ("yo legend" / "saw your reel about…").
     - Reference something specific from bio.
     - Soft pitch: "wondering if you ever miss calls when you're on a job?"
     - Sent from MY personal IG, so tone matches a casual founder DM.
     - No emojis, no sign-off, no markdown.
     - Don't mention "Flynn" by name — say "an app I'm building".

7. Partnership discovery (Stream C). Use WebSearch + WebFetch.
   Today's rotation depends on the day of week:
     Mon → master builders / HIA state branches
     Tue → bookkeepers servicing tradies (search "bookkeeper for tradies <city>")
     Wed → accountants servicing tradies (search "accountant for tradies <city>")
     Thu → trade retailer loyalty managers (Sydney Tools, Total Tools, Reece)
     Fri → follow-up + LinkedIn searches for prior contacts

   For each, find 5 distinct contacts (org_name + likely contact_name +
   role + LinkedIn URL or email). Then for each, draft an 80–120 word
   pitch tailored to org_type:
     - association: member-benefit angle (discounted Flynn for members)
     - bookkeeper/accountant: rev-share affiliate angle
     - retailer: co-marketing / loyalty bundle angle

   INSERT into gtm_partnership_leads with status='new'. Skip duplicates
   (the (org_name, contact_name) unique index will reject them).

8. Run `npm run brief:build`. Writes today's gtm_morning_briefing row.

9. Final: print a one-line summary like:
   "✅ 20 emails sent, 15 IG DMs ready, 5 partnerships drafted, briefing built."

Do NOT push commits to the repo. The routine reads code; it doesn't ship code.
If any step fails, log the error and continue to the next step. The dashboard
will show whatever data was successfully generated.
```

## How to create the routine

Option A — via the `/schedule` slash command (recommended):

```
/schedule create flynn-gtm-morning "0 20 * * 1-5" "<paste prompt above>"
```

Option B — let Claude Code do it: tell Claude in this repo "set up the
flynn-gtm-morning routine using gtm-automation/ROUTINE.md".

## First-run verification

Before enabling the cron schedule, trigger a manual run:

```
/schedule run flynn-gtm-morning
```

Watch:
- Supabase: `gtm_cold_leads` populates with `review_snippet` + `personalized_body`
- Gmail Sent folder: 20 personalised emails
- Supabase: `gtm_morning_briefing` has today's date row
- Open `file:///Users/atticus/FlynnAIapp/gtm-automation/morning-dashboard/morning.html` — all 4 sections render

Once green, no further action — it'll fire daily at 06:00 AEST.
