# Flynn TikTok demo — run sheet

A filming prop. Not wired to production. Runs entirely on your Mac, speaks Flynn's
replies out loud so the phone (on the holder, filming you) picks them up.

## Run it

```bash
node flynn-demo/server.js
```

Then open **http://localhost:5050** in **Google Chrome** (the speech-to-text uses
Chrome's Web Speech API). No install needed — it reuses the repo's `node_modules`
and `.env`.

On boot it pre-synthesises the four scripted lines so they play back instantly.

## How it works

- **Hold SPACE** (or hold the big orange button) to talk, release to send. Phone is
  never touched.
- Chrome transcribes your voice → the server matches one of the four scripted lines
  and plays a hand-crafted Flynn reply. Anything off-script falls back to live Qwen.
- A **think-beat slider** (default 1.5s) adds a natural pause + typing indicator
  before Flynn speaks, so it doesn't look fake-instant.
- **Voice dropdown:** default is Aussie male (Deepgram Arcas). A/B it against the
  Cartesia male voice and pick whichever sounds more casual. Changing voice re-warms
  the cache automatically.
- The left phone mock-up is an iMessage-style chat overlay — optional, screen-record
  it if you want the text on screen in the edit.

## Your four lines (say any of these)

1. "Flynn, chase up Greg's invoice will ya"
2. "Can you order some 90 mil PVC from Reece"
3. "Check how my Finlayson's order is going"
4. "Is my Bunnings order ready to grab"

Phrasing can vary — the matcher is keyword-based. Click a line in the panel to test
without talking.

## Car audio setup

- **Mac output → car Bluetooth** (System Settings → Sound → Output → your car). Flynn's
  voice comes out the car speakers; the phone mic records it.
- **Mac input → Built-in Microphone** (Sound → Input). Don't let it switch to the car's
  Bluetooth headset mic — that drops audio quality and can mute the speakers.
- Keep the Chrome tab focused (the spacebar hotkey needs focus). Full-screen it.
- Do one dry take to set car volume so the phone records cleanly without clipping.

## Hook options for the caption

1. **"POV: your Siri got on the tools 🔧"**
2. **"POV: your Siri's on gear"**
3. Cold-open with the parts order (most surprising) for a stronger 2-second hook.

## Tuning

- Reply wording: edit `flynn-demo/scenarios.js`.
- Flynn's off-script voice/persona: `flynn-demo/persona.js`.
- Port: `DEMO_PORT=5051 node flynn-demo/server.js`.
