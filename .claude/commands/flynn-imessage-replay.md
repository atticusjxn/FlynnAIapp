---
description: Replay a timed Flynn conversation onto a real iMessage thread via BlueBubbles, so the user can screen-record it lined up with a video.
---

# /flynn-imessage-replay — play a scripted iMessage convo through BlueBubbles for screen-recording

Replay a timed Flynn conversation onto a real iPhone iMessage thread so the user can screen-record it, lined up with a video. The timing comes from the voice demo's **"copy transcript"** button — a JSON array of `{ "at": <seconds from first message>, "from": "me"|"flynn", "text": "..." }`.

## What you're given (ASK for anything missing before doing ANYTHING)
- The **transcript JSON** (pasted in the message, or a file path the user gives).
- The **recording phone number** — the user's personal handset being filmed — in E.164.
- **Flynn's number** (the eSIM, default `+61495023092`) — the other party in the thread.
- Optional: a **speed factor** (e.g. `0.8` = 20% faster, since voice-demo gaps feel slow for text) and a lead-in countdown.

## How the two sides get sent (this is the crux — read it)
A screen recording of the user's phone shows two kinds of bubbles:
- **flynn** lines = INCOMING on the user's phone. Sent FROM Flynn's account via the repo's BlueBubbles server (`services/blueBubbles.js`, env `BLUEBUBBLES_URL`/`BLUEBUBBLES_PASSWORD`) TO the **recording number**.
- **me** lines = OUTGOING (the user's own blue bubbles). These can ONLY come from the user's own iMessage account. In preference order:
  1. A **second BlueBubbles** signed into the user's account → send "me" lines from there TO Flynn's number. Ask for its URL + password if it exists.
  2. No second server → print a timed `>>> SEND NOW (you): <text>` cue for each "me" line so the user taps send (have them pre-typed). You still fire all the **flynn** lines automatically, on time.

**Safety:** only ever send to the user's OWN test handset. Sending iMessages is an outward action — print the full schedule and get an explicit "go" before sending anything. Never message a real customer/number the user didn't give you.

## Steps
1. Parse the transcript, apply the speed factor to every `at`, and print the schedule (mm:ss offset · sender · text). Get a yes.
2. Confirm the BlueBubbles config(s) and both numbers. Decide per side: auto-send (server available) vs manual cue.
3. On the user's **"go"** (offer a 3-2-1 countdown so they start their video in sync), record `t0 = now` and run the loop, sending each message when `now >= t0 + at`. Fire the typing indicator just before each flynn send for realism.
4. Stop on completion or if they say stop.

## Ready-to-adapt runner
Write and run a small node script (don't hand-send one-by-one — timing must be tight). Skeleton:

```js
// flynn-replay.js — node flynn-replay.js   (run from repo root)
const bb = require('./services/blueBubbles'); // Flynn's BlueBubbles (BLUEBUBBLES_URL/PASSWORD)
const transcript = require('./transcript.json'); // paste the demo JSON into this file
const RECORDING = '+61497779071';  // the user's filmed phone (CONFIRM)
const FLYNN = '+61495023092';      // eSIM
const SPEED = 1.0;                 // 0.8 = 20% faster
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  console.log('Starting in 3...'); await sleep(1000);
  console.log('2...'); await sleep(1000); console.log('1...'); await sleep(1000);
  const start = Date.now();
  for (const m of transcript) {
    const due = start + (m.at / SPEED) * 1000;
    await sleep(Math.max(0, due - Date.now()));
    if (m.from === 'flynn') {
      await bb.setTyping(RECORDING, true).catch(() => {});
      await bb.sendMessage(RECORDING, m.text);
      await bb.setTyping(RECORDING, false).catch(() => {});
    } else {
      // 'me' line: send via a 2nd (user-account) BlueBubbles if available, else cue:
      console.log('>>> SEND NOW (you):', m.text);
    }
  }
  console.log('done');
})();
```

Adapt `RECORDING`/`FLYNN`/`SPEED` and the me-side (cue vs second-server send) to the actual run.

## Notes
- The captured offsets include the voice demo's think-beat + speech pacing, so for text-only iMessage they can feel slow — offer `SPEED ~0.7-0.8` or let the user tweak the gaps in the JSON.
- Keep the BlueBubbles Mac awake and the iMessage thread already open on the phone before starting.
- If the user wants both sides fully automated, they need BlueBubbles on the user's account too (option 1) — confirm and wire its URL/password as a second client.
