// Cold email + IG DM + FB post copy. Surfaced via "copy template" buttons in dashboard.

export const COLD_EMAIL_TEMPLATES = {
  day1: {
    label: 'Day 1 — Intro',
    subject: "G'day {{firstName}} — never miss another $500 job",
    body: `G'day {{firstName}},

Quick question — how many calls do you miss when you're up on a roof or under a sink?

I'm Atticus. I built Flynn AI for {{trade}}s in {{city}} who can't answer every call but rely on inbound leads.

Here's what it does:
→ Forwards your missed calls to Flynn
→ AI receptionist answers in your business name, takes a message
→ Texts the caller a booking or quote link instantly
→ Pre-fills a job card in the app — name, phone, service, urgency

A Brisbane plumber told me last week: "Flynn booked me 8 jobs the first week. Already paid for 3 months."

Try it free for 2 weeks — no credit card.

After that it's $29/month for the Solo plan (50 mins of AI call time, ~25 calls). One booked job pays for the whole year.

Download Flynn AI on the App Store: https://apps.apple.com/au/app/flynnai/id6752254950

Or hit reply if you'd rather a quick 5-min walkthrough.

Cheers,
Atticus
Founder, Flynn AI

— Don't want emails from me? Just reply "remove" and I'll take you off the list.`,
  },
  day3: {
    label: 'Day 3 — Social proof',
    subject: '{{firstName}} — what 3 Sydney sparkies booked this week with Flynn',
    body: `Hey {{firstName}},

Following up on Flynn AI — the AI receptionist for {{trade}}s.

Just sharing what one of our users did last week:

Dave — Electrician, Sydney inner west
- 23 missed calls answered by Flynn while he was on site
- 7 of those booked themselves a job via the SMS link
- ~$4,200 in revenue Dave would have lost otherwise
- Setup time: 5 minutes

The thing that surprised him: callers don't even realise it's AI. They just get a text 30 seconds later with a booking link, and most click through.

Want to test it for 2 weeks free?
No credit card. If it doesn't book you a single job, you've lost nothing but 5 minutes setting up call forwarding.

App Store: https://apps.apple.com/au/app/flynnai/id6752254950

Cheers,
Atticus`,
  },
  day7: {
    label: 'Day 7 — Urgency',
    subject: '{{firstName}} — last few days at $29/mo (going up)',
    body: `{{firstName}},

Last reminder.

We're raising prices on the Solo plan from $29/mo → $39/mo at the end of this month, but tradies who sign up before then keep $29/mo for the life of their account.

Here's what you get:
✓ AI receptionist answers every missed call
✓ Texts callers a booking or quote link automatically
✓ Pre-fills job cards in the app
✓ 2 weeks free, no credit card
✓ $29/mo locked in forever (after the trial)

One booked job pays for the entire year.

Download Flynn AI: https://apps.apple.com/au/app/flynnai/id6752254950

Or reply "interested" and I'll grandfather you in even after the price rise.

Cheers,
Atticus`,
  },
  day10: {
    label: 'Day 10 — Breakup',
    subject: '{{firstName}} — should I close your file?',
    body: `Hey {{firstName}},

Haven't heard back, so I'm guessing one of three things:

1. You're slammed (great problem to have!)
2. You're skeptical about AI (fair)
3. My emails are going to spam (oops)

If it's #1 or #2, no worries — I'll leave you alone.

But if you ever want to see how Flynn books jobs while you're on tools, just reply "interested" and I'll personally walk you through setup.

Cheers,
Atticus

P.S. Reply "remove" and I'll take you off this list immediately.`,
  },
};

export const IG_DM_SCRIPTS = {
  REV_SHARE: {
    label: 'Rev Share (5k+ followers)',
    text: `Hey {{handle}}, atticus here — founder of Flynn AI (AI receptionist for AU tradies).

Loved your recent post — real-world content, no BS.

Quick ask — would you be open to a rev share? I give you a custom code (your followers get $20 off their first month, you get 30% recurring on every signup for 12 months).

Most tradies pay $29/mo, so each signup = ~$8.70/mo to you for a year. A handful of signups stacks up.

If you're keen, I'll send you the link + code today. No upfront, no contract.

Cheers,
Atticus`,
  },
  FREE_MONTH: {
    label: 'Free Month (1k-5k followers)',
    text: `Hey {{handle}} — atticus, founder of Flynn AI (AI receptionist for AU tradies).

Real-world content, no BS — that's the audience I'm trying to reach.

Want to try Flynn free for a month, on the house? I'll set you up with a code that skips the trial straight to a free month of the Solo plan ($29 value).

Only ask: if it books you a job, share a quick story or post about it. No script, just be honest.

Up for it?

— Atticus`,
  },
  FEEDBACK: {
    label: 'Feedback (<1k followers)',
    text: `Hey {{handle}} — atticus, founder of Flynn AI.

I'm building an AI receptionist specifically for AU tradies — answers missed calls, texts the caller a booking link.

Talking to as many tradies as I can to make sure we're solving the right problem. Could I send you a free 2-month account in exchange for 15 mins of feedback once you've tried it?

No pitch, just genuine input on what works and what's clunky.

— Atticus`,
  },
};

export const FB_GROUP_POSTS = {
  VALUE_QUESTION: {
    label: 'Value Question',
    text: `Quick poll for the group — how many of you are losing $$ to missed calls?

I'm seeing a lot of tradies on here say they miss 5-15 calls/week when they're on tools. Is that you too?

If yes — what do you currently do about it? Voicemail? Just lose the lead?

Genuinely curious. Trying to figure out if this is a $1k/wk problem or a $5k/wk problem for most of you.`,
  },
  CASE_STUDY: {
    label: 'Case Study',
    text: `Spoke to a sparky in Brisbane this week who'd been losing 6-8 jobs a week to missed calls.

Worked out to roughly $3-4k/week in lost revenue.

He set up an AI receptionist last month — basically answers every missed call, takes a message, texts the caller a booking link.

Last week's numbers from his dashboard:
- 31 missed calls answered
- 11 turned into booked jobs
- ~$4,800 in new work that would've gone to competitors

Genuinely surprised at how well it's working. Anyone else here doing something similar? Curious to compare notes.`,
  },
  GENUINE_HELP: {
    label: 'Genuine Help',
    text: `G'day all — I run a small AI/automation business and have been helping AU tradies set up systems for missed calls, follow-ups, and quotes.

Happy to spend 15 min on a call with anyone here who's:
- Losing leads to missed calls
- Drowning in admin between jobs
- Trying to figure out if AI tools are worth the hype

No pitch, no sale. Just a chat about what would actually move the needle for your business.

Comment "interested" or DM me — first 5 spots this week.`,
  },
};

/** Replace {{var}} placeholders with values. Missing values fall back to the placeholder text. */
export function fillTemplate(template: string, vars: Record<string, string | undefined | null>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const v = vars[key];
    return v ? v : `{{${key}}}`;
  });
}
