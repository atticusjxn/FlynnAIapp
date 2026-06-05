# Flynn — Product Brief

> **Purpose of this document:** This is the source-of-truth product specification for a major repositioning of the existing **Flynn** app. It describes **what the product is and the end goal in full detail**. It deliberately does **not** prescribe the implementation (invocation mechanism, AI architecture, specific libraries). Those decisions are delegated to the engineering agent, which should research the optimal approach (see "Research Directives" at the end). Native app layers are Swift (iOS) and Kotlin (Android); everything else is open to research.

---

## 1. One-line definition

**Flynn is an on-device AI co-pilot that helps anyone who runs on their phone reply to customer and client messages in their own voice — and books the resulting jobs and appointments straight into their calendar.**

It lives where the relationship already is: the user's normal texting (iMessage / SMS). The user stays in control and taps to send; Flynn does the writing and the scheduling.

---

## 2. Background and strategic context (the "why")

The existing Flynn app was positioned as an **autonomous AI phone receptionist for tradies** — it answered missed calls on a separate number and booked jobs without the user. That positioning created too much friction: handing a machine your phone line is a high-trust ask, and many operators were not comfortable with it. It never properly launched.

The repositioning fixes this by making Flynn **assistive instead of autonomous**, and by moving from voice to text:

- **Most service enquiries now arrive as texts.** People text a business's number to ask for a quote or to book. That inbound-text moment is unserved by good tooling.
- **Assistive = low trust.** The user always reviews and taps send. Flynn never sends on its own. This removes the single biggest adoption blocker the receptionist version hit.
- **The opportunity is broad, not just trades.** Anyone who fields repetitive inbound messages and books time benefits: tradies, removalists, cleaners, personal trainers, salons, photographers, tutors — and equally real estate agents, freelancers, agencies, and busy professionals.

**Market validation:** The pattern of "tone-matched draft replies + calendar-aware booking" is already a proven, paid, flagship feature — but only for **email** (e.g. Superhuman: three ready-to-send drafts in your voice, pulling from your calendar to propose meeting times). Meeting tools (e.g. Granola) and scheduling links (e.g. Calendly) cover their slices. **No one has built this for the personal texting / iMessage layer**, where a large share of service operators and professionals actually transact. That gap is the product.

---

## 3. Target user

**Primary:** Solo operators and small service businesses who run their business out of their personal phone's messages — tradies, removalists, cleaners, personal trainers, hairdressers/salons, photographers, mobile detailers, tutors.

**Equally important secondary:** Real estate agents, freelancers, small agencies, and business professionals who field inbound texts (and increasingly want bookings/appointments handled) on their phone.

**Defining trait, not industry:** *They operate out of their texts and they book time or jobs.* The product is vertical-agnostic; the verticals above are go-to-market lenses, not hard boundaries.

---

## 4. Core value proposition

When a customer messages the user, Flynn:

1. **Understands the full conversation** — including messages that arrive in fragments.
2. **Drafts a reply that sounds like the user**, informed by the user's business context (services, pricing, FAQs, hours) and, where relevant, their **real calendar availability**.
3. **Proposes real, open time slots** when the customer hasn't named a time (see §6.2 — this is the killer behavior).
4. **Surfaces 2–3 ready-to-send drafts**; the user taps one and sends.
5. **Adds the booking to the calendar** in one tap once a time is agreed.

The magic moment, end to end: *receive a messy real customer text → invoke Flynn → get a send-ready reply in your voice that offers your actual free times → send in one tap → tap once more to put the job in your calendar — in a few seconds.*

---

## 5. What makes this defensible (and not "just ChatGPT" or Apple Intelligence)

The agent must understand this so it builds the *right* thing. The draft text is the demo; the moat is the layer underneath.

- **Calendar-aware proposal & booking.** Reading the user's real availability, proposing slots, and writing the event is something generic assistants and the OS's built-in suggested replies cannot do.
- **Tone-as-you.** Drafts must sound like the specific user — casual, on-brand, human. A stiff "corporate" reply is worse than nothing for this audience and will cause abandonment. Tone-matching is load-bearing, not cosmetic.
- **Business + relationship context.** Flynn knows the user's services, prices, and FAQs (the "Business Brain"), and over time the recurring relationships ("this is a repeat customer; last job was X"). This compounds and raises switching cost.
- **Lives where the relationship already is.** Competing tools force a channel change (a new number, a booking link, a separate inbox). Flynn meets the user inside their existing texts.

> **Apple Intelligence note:** iOS now offers generic suggested replies in Messages. Treat that as the commoditized baseline. Flynn must **never lead on "AI drafts a reply"** — it leads on the calendar/booking and the sounds-like-you, i.e. the things the OS cannot do.

---

## 6. The core experience (described as outcomes, not implementation)

### 6.1 The daily loop

1. A customer message arrives in the user's normal texting app.
2. The user **invokes Flynn** (the precise mechanism — custom keyboard, share action, system shortcut, or a combination — is to be decided by research; see Research Directives).
3. Flynn understands the conversation context, references the Business Brain and (if relevant) the calendar, and **presents 2–3 ready-to-send drafts in the user's voice**.
4. The user taps a draft; it is placed into the message field; the user sends.
5. If a time/job is agreed, the user taps **"Add to calendar"** and the event is created.

**Requirements for this loop:**
- It must feel **close to one tap** and **near-instant**. Latency on every message is the primary experience risk; the agent should plan for it (e.g. pre-generation / caching strategies — approach is the agent's call).
- The user is **always in control**. Flynn never sends or books without an explicit tap. No silent/autonomous actions.

### 6.2 The "propose a time, don't just extract one" behavior (critical)

Real enquiries rarely contain a clean time. A customer typically says *"next week sometime"* or *"whenever you're free."* Flynn's distinctive behavior is to **read the user's actual calendar, find genuinely open slots, and offer them** in the drafted reply (e.g. *"Could do Tues arvo or Thurs morning — want me to lock one in?"*), then create the event when the customer confirms. This — not time-extraction — is the standout capability and must be a first-class feature.

### 6.3 Conversation context across fragmented messages (critical)

Texts arrive in pieces. Example: *"need couch moved"* … then later *"10am Friday"* … then a photo … then *"it's just foam."* No single message contains the job. Flynn must **maintain conversational context** so a reply (and any calendar event) reflects the whole exchange, not just the latest fragment. The mechanism for holding context within platform constraints is the agent's to design; the **requirement** is that fragmented, multi-message enquiries are handled coherently.

### 6.4 Onboarding (sequence matters — value before the big ask)

The onboarding must **prove value before requesting any high-friction permission** (e.g. installing a keyboard / granting access). Target sequence:

1. **Download** the app (Flynn — already live on the App Store and Google Play).
2. **Build the Business Brain** through an engaging, low-effort flow. **Auto-ingest wherever possible** (e.g. from a website URL, Google Business Profile) rather than making the user fill long forms. Capture services, pricing, FAQs, hours, and a sense of the user's tone.
3. **Connect the calendar** (OAuth).
4. **Personalized demo** — show the user a realistic, send-ready draft reply *to a real-style customer message, using their own business data and a real open slot from their calendar.* This is the "aha" moment and the conversion lever.
5. **Only now**, install the invocation mechanism as a one-off, because the user has already seen the value.
6. Daily loop begins.

---

## 7. Hard requirements and explicit non-goals

### Must
- **Assistive, not autonomous.** Always user-reviewed, tap-to-send. No auto-sending, no auto-booking.
- **Tone-matched drafts** in the user's voice.
- **Calendar read (availability) + write (event creation).** Google Calendar via OAuth at minimum; Apple Calendar support where feasible.
- **Business Brain** with low-effort, ideally auto-ingested setup.
- **Coherent handling of fragmented, multi-message conversations.**
- **Near-instant, near-one-tap** invocation and draft insertion.
- **Privacy-respecting.** Message content is sensitive. Minimize what is stored/transmitted, be transparent with the user, and design with App Store / Play review and user trust in mind.

### Must NOT
- **Do not build on hosted iMessage relay / Mac-mini farms that hold users' Apple ID credentials.** This violates Apple's terms, risks Apple ID bans whose blast radius includes the user's entire iCloud, and creates a credential-custody liability. Out of scope.
- **Do not require the user to adopt a new phone number, inbox, or booking link** in the core flow. The wedge is staying inside the user's existing texts.
- **Do not lead the UX or marketing on "AI."** Lead on the outcome (a great reply + a booked job).

---

## 8. Platform notes (constraints to validate, not instructions)

- **Native layers:** Swift (iOS) and Kotlin (Android). The existing app and onboarding are native; keep them native.
- **iOS invocation:** A custom keyboard can work but requires "Full Access" for networking and is subject to App Review scrutiny; the agent should validate current iOS behavior and weigh it against alternatives (share extension, App Intents / Shortcuts, Action Button, or a combination). Note Apple's documented clipboard behavior: a **direct** programmatic pasteboard read triggers a permission prompt, whereas reads via the **Paste menu, keyboard shortcut, or UIPasteControl (user-initiated)** do not — favor user-initiated patterns. **Validate against the current iOS version; Apple changes this.**
- **Android** is generally more permissive for keyboard/clipboard/overlay mechanisms; platform-specific approaches are acceptable.
- **Calendar writes:** Note that iOS keyboard extensions are sandboxed and cannot cleanly write to the system calendar; calendar writes should happen in the main app or server-side (e.g. via the Google Calendar API the user has connected). Confirm during research.

---

## 9. Success criteria

**Product (qualitative):** A user can take a real, messy customer text, invoke Flynn, receive a send-ready reply in their own voice that proposes a real open slot from their calendar, send it in one tap, and add the booking with one more tap — fast enough to feel like magic and obviously beyond the OS's built-in suggestions.

**Business (early north-star):** Users invoke Flynn **daily** and **retain** — week-4 retention is the key early signal. The product is designed to be used every day by people who text all day.

---

## 10. Research Directives (for the engineering agent)

Before proposing any architecture or writing any code, **do focused web research** to determine the optimal current approach to the following. Treat the product requirements above as fixed and the methods below as open questions to be answered with up-to-date sources:

1. **Invocation mechanism on iOS** (current OS version): the best low-friction way to get the customer's message into Flynn and the chosen draft back into the conversation. Compare custom keyboard (with Full Access), share extension, App Intents / Shortcuts, Action Button, and combinations. Include current clipboard-permission behavior and App Review risk for keyboards.
2. **Invocation mechanism on Android**: the equivalent best approach given Android's permission model.
3. **Maintaining conversation context** within each platform's sandbox, given that messages arrive in fragments and the assistant may only see what the user provides.
4. **AI drafting architecture**: model selection, on-device vs server-side, and **latency mitigation** (e.g. pre-generation/caching) so drafts feel instant; plus tone-matching approaches.
5. **Calendar integration**: OAuth and APIs for Google Calendar and Apple Calendar; reading availability to propose slots; creating events; where the write should occur (client vs server).
6. **Business Brain auto-ingestion**: pulling structured business info from a website URL and/or Google Business Profile with minimal user effort.
7. **How comparable products solve the drafting + calendar-proposal experience** (e.g. Superhuman for email) and what transfers to a texting context.
8. **Privacy and store-review implications** of handling message content and any Full Access permission.

Cite sources and summarize the recommended approach with tradeoffs before proposing a build plan.
