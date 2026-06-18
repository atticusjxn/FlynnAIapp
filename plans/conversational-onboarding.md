# Conversational Onboarding

## Goal
Replace cold-start brain setup with a natural SMS conversation that:
- Tells the user what Flynn can do (value-first, not form-first)
- Learns their business through dialogue, not a questionnaire
- Saves everything to the brain as it's mentioned — never asks twice
- Demonstrates magic value mid-conversation before setup is "complete"

## Flow

### Step 1 — Warm open (on first contact)
Flynn sends immediately after signup, before the user says anything:

> "hey, i'm flynn. i handle the stuff that piles up when you're on the tools — quotes, bookings, chasing invoices, replying to leads. what kind of work do you do?"

No feature list. One question. Gets them talking.

### Step 2 — Vertical detection + capability preview
User replies "plumber in sutherland shire" or "i do removals" etc.
Flynn responds with 2-3 things it can do specifically for that vertical, then asks the highest-leverage question:

> "nice — for plumbers i'm most useful for: drafting quote replies, booking jobs into your calendar, and chasing overdue invoices. do you quote by the hour or fixed price mostly?"

The AI generates this response dynamically based on vertical — no hardcoded templates.

### Step 3 — Progressive brain building
Each reply fills in the brain. Flynn saves:
- Vertical / trade type
- Location (infer AUD, NZD etc from number prefix + mentioned suburb)
- Pricing model (hourly / fixed / both)
- Hourly rate ("$80/hr" → saved as `hourly_rate: 8000` cents)
- Call-out fee, fuel levy, materials markup — asked naturally if relevant
- Service area
- Business name (ask once, casually)

**Never ask the same thing twice.** If they mentioned their rate in passing earlier, don't ask again — use it.

### Step 4 — Integration suggestions (ranked by leverage)
After 3-4 exchanges, Flynn proposes the highest-value integration for their vertical:

> "to book jobs for you i'll need your calendar. google or apple? i can send you a link to connect it now — takes 30 seconds"

If they say later:
> "no worries, i'll remind you. want to try something now instead — i can show you what a quote reply looks like for your pricing"

Rank integrations by vertical:
- Tradie: Calendar → Gmail/email → Xero → Reece/supplier
- PT/salon: Calendar → payment link → client CRM
- Removalist: Calendar → quote builder → Google Maps ETA
- Generic: Calendar → Gmail → anything else

### Step 5 — Live demo mid-onboarding
Don't wait for full setup. As soon as Flynn has enough context (vertical + rough pricing), offer a live demo:

> "want to see what i'd say to a lead right now? paste me a message you got recently and i'll draft a reply using your pricing"

This is the magic moment. Gets them hooked before they've "finished" anything.

### Step 6 — Ongoing passive learning
After onboarding, brain updates continuously:
- If they correct Flynn ("actually i charge $95/hr now") → update brain
- If they add detail in passing ("i don't do commercial, just residential") → save it
- Never surface "your profile was updated" — just silently get smarter

## Brain schema (Supabase JSONB)
```json
{
  "vertical": "plumber",
  "location": "Sutherland Shire, NSW",
  "currency": "AUD",
  "pricing_model": "hourly",
  "hourly_rate_cents": 9500,
  "callout_fee_cents": 8000,
  "fuel_levy": false,
  "materials_markup_pct": 15,
  "service_area": "Sydney south + Wollongong",
  "business_name": "Atticus Plumbing",
  "integrations_connected": ["google_calendar"],
  "integrations_deferred": ["xero", "gmail"],
  "onboarding_complete": true
}
```

## Rules
- Messages max ~2 sentences. Split into two texts if more is needed.
- If user replies to one specific thing, focus there — but file the rest
- Currency inferred from phone number prefix (+61 → AUD, +64 → NZD, +1 → USD/CAD)
- Location inferred from suburb mentions, not asked directly
- Never use the word "setup", "profile", "configure", or "onboarding"
