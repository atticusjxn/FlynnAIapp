# Flynn Re-engagement Loop

## Goal
Convert signed-up users who haven't finished onboarding into active users — via proactive SMS, not nag copy.

## Trigger Conditions

A user qualifies for re-engagement if ALL of:
- `onboarding_step = 'brain_pending'` (never completed brain setup)
- `created_at` > 2 hours ago
- Zero inbound `sms_messages` rows (never replied to Flynn at all)
- Not already sent a re-engagement message (need `last_reengagement_at` column)

## Message Sequence

### Message 1 — 2 hours after signup (no reply)
> "Hey it's Flynn — what kind of work do you do? Once I know your business I can start helping straight away — invoices, bookings, replies."

Value-first. No mention of "setup" or "finishing" anything. Just Flynn asking the natural first question.

### Message 2 — 24 hours after signup (still no reply)
> "Still here when you're ready. Most tradies get their first draft reply within a minute of telling me what they do."

Social proof nudge. Short. No pressure.

### Message 3 — 72 hours (final, then stop)
> "Last one from me — if you want to try Flynn later just reply anytime. I'll be here."

Graceful exit. Leaves the door open.

**Stop after message 3. Never message again unless they reply.**

## Implementation

### Supabase changes
```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS reengagement_sent_count INT DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_reengagement_at TIMESTAMPTZ;
```

### Cron job
- Runs every 30 minutes via `node services/reengagementScheduler.js`
- Or: Fly.io cron machine (separate process, same repo)
- Query: users matching trigger conditions above
- Sends via BlueBubbles (iMessage) or Twilio (SMS fallback)
- Updates `reengagement_sent_count` and `last_reengagement_at` after each send

### Message timing
- Count 0 → send M1 if `created_at` < now - 2h
- Count 1 → send M2 if `last_reengagement_at` < now - 22h (total ~24h from signup)
- Count 2 → send M3 if `last_reengagement_at` < now - 48h (total ~72h from signup)
- Count 3+ → never send again

### On reply
Any inbound message from the user resets the flow — `processMessage` in `flynnSMS.js` handles it normally. Re-engagement stops naturally because the user now has inbound messages.

## Voice & Tone Rules

Flynn should read like a real person texting, not a product. Reference: how Poke (the app) writes notifications — casual, lowercase starts, no punctuation theatre.

### Rules for ALL Flynn-generated messages (re-engagement + replies)

1. **Start uncapitalised where natural** — "hey", "still here", "got it" not "Hey", "Still here", "Got it". Signals a human typed it, not software.

2. **No em dashes** — never use `—`. Use a comma, a line break, or just end the sentence. Em dashes are the single biggest AI tell in text messages.

3. **No bullet points or lists in SMS** — prose only. Lists feel like an app, not a person.

4. **Short sentences** — if it wouldn't fit in one breath, split it. Two short messages feel more human than one long one.

5. **No exclamation marks unless genuinely excited** — one max per conversation, never in onboarding/re-engagement.

6. **Contractions always** — "I'll", "you've", "can't", never "I will", "you have", "cannot".

7. **No filler affirmations** — never start with "Great!", "Sure!", "Absolutely!", "Of course!". Just answer.

8. **Numbers and specifics beat vague** — "invoice for $340 inc GST" not "an invoice for the amount discussed".

### Revised message copy (applying rules)

**M1:**
> "hey, what kind of work do you do? tell me and i can start helping straight away"

**M2:**
> "still here when you're ready. most tradies i work with get their first draft reply within a minute of filling me in"

**M3:**
> "last one from me. reply anytime and i'll pick up where we left off"

### System prompt addition for flynnSMS.js
Add to the Claude system prompt:
```
Tone rules — non-negotiable:
- Start messages in lowercase where it reads naturally (hey, got it, done, on it)
- Never use em dashes (—). Use commas or short sentences instead.
- No bullet points. Prose only.
- No filler openers: never "Great!", "Sure!", "Absolutely!"
- Contractions always: I'll, you've, can't
- Short sentences. Two short ones beat one long one.
- Sound like a sharp mate who knows your business, not a chatbot
```

### Hard post-processing in flynnSMS.js

Don't rely on the prompt alone — sanitise every outbound message before sending:

```js
function sanitiseReply(text) {
  return text
    .replace(/—/g, ',')          // em dash → comma
    .replace(/\.\.\./g, '..')    // ellipsis → two dots (less dramatic)
    .replace(/!{2,}/g, '!')      // multiple exclamation marks → one
    .trim();
}
```

Call `sanitiseReply(result.reply)` in both `smsInbound.js` and `iMessageInbound.js` before sending. Keeps the fix in one place and survives model swaps.

## Open Questions
- Does message copy need to vary by industry? (probably not at this stage)
- Should M2/M3 include a specific example relevant to their area code / region?
- What's the unsub path? "Stop" keyword → set a `reengagement_opted_out` flag
- Analytics: track which message converted (correlate `last_reengagement_at` with first inbound)
