# Dashboard — Context-Driven Interface

## Vision
Flynn builds up rich context over time — jobs, clients, pricing, integrations, conversation history. The dashboard surfaces that context as a useful at-a-glance view, auto-generated and tailored to each user. Not a generic CRM. A view that knows you.

The unicorn version: the dashboard is automatically composed based on what matters most to this specific user right now. A plumber mid-project sees different cards to a PT booking classes for the week.

## Phase 1 — Foundation (build now)

A clean, on-brand web dashboard at `flynnai.app/dashboard`. Mobile-responsive. Available in iOS app as a tab.

### Always-present cards
- **Upcoming jobs** — pulled from connected calendar, next 7 days
- **Open quotes** — jobs Flynn has drafted quotes for, awaiting response
- **Brain summary** — what Flynn knows (pricing, vertical, area) + edit link
- **Integrations** — connected status, quick connect for missing ones

### Conditional cards (appear when data exists)
- **Overdue invoices** — from Xero/MYOB if connected
- **Unread leads** — flagged emails/messages that look like new job requests
- **Recent Flynn activity** — last 5 things Flynn did (sent invoice, booked job etc)

### Design
- On-brand: cream `#F4E6CE` background, orange `#FB5B1E` accents
- Card-based layout, clean whitespace
- No tables, no dense data grids — this isn't Xero
- Each card has one primary action button
- Mobile-first — most users will check on phone

## Phase 2 — Auto-generated dashboards

As context builds, Flynn starts generating personalised card layouts. 

Examples:
- User has 3 invoices >30 days overdue → "Chase these" card surfaces at top
- Calendar shows a gap next Thursday → "You've got a free day Thursday — want me to fill it?" 
- Instagram connected + 3 job photos uploaded → "Turn these into posts" card
- Slow week detected → "Here are 5 leads from last month you haven't followed up"

The layout algorithm ranks cards by:
1. Time-sensitivity (overdue > upcoming > general)
2. Revenue impact (invoice chase > lead follow-up > admin)
3. User engagement (cards they tap get promoted)

## Phase 3 — Vertical CRM (long-term)

Flynn becomes the source of truth for the business. Replaces Jobber, ServiceM8, even Xero for simpler operators.

- **Client profiles** — auto-built from conversation history (Jane Henderson → plumbing job Mar 2026, paid $680, repeat customer)
- **Quote history** — every draft Flynn made, accepted/rejected status
- **Expense tracking** — parts orders via Reece/Tradelink → logged automatically
- **Job photos → social posts** — one tap to turn a job photo into an Instagram caption
- **Tax-ready summaries** — income + expenses by quarter, exportable

**This is how Flynn becomes the Jobber/ServiceM8 killer** — not by building a traditional CRM, but by making the CRM emerge naturally from the conversation layer that's already happening.

## Tech stack
- Web: React (existing Cloudflare Worker setup), Supabase for data
- Charts: minimal — recharts or plain CSS bars, nothing heavy
- Auth: Supabase JWT, same as app
- iOS: SwiftUI dashboard tab in existing app
- Real-time: Supabase realtime subscriptions for live card updates

## What NOT to build yet
- Custom reports / export
- Team / multi-user (solo operators only for now)
- Mobile notifications from dashboard (SMS is the notification layer)
- Anything that requires the user to "manage" Flynn — it should just work
