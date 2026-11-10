# Batch 1 — Shoot & Edit Runbook

Tick everything off, drop finished exports in `exports/`, and tell Claude "exports are
in" — Meta campaign setup happens from there. Blockers for going live are at the bottom.

---

## 1. Film: your cut-in for the hero ad (~10-15s of usable talking)

**The moment:** the AI clip shows a tradie's ladder slipping and his phone hitting the
driveway. You enter ON the impact clack, as the voice of sanity.

**Script (Flynn voice: lowercase energy, no em dashes, short sentences, contractions).
Say each line 3-4 times, vary the delivery, we pick the best take:**

- [ ] HOOK LINE (pick one on the day, shoot both):
  - "mate. don't answer it. flynn's got it."
  - "that call? already answered."
- [ ] BODY (shoot as separate lines, not one long take):
  - "flynn picks up when you can't, sounds like a real person, and books the job
    straight into your calendar."
  - "the customer gets a booking text. you get the job. your phone stays in your
    pocket."
- [ ] OFFER LINE:
  - "seven day free trial. from twenty nine a month. it's on the app store."

**How to shoot:**
- [ ] 9:16 vertical, phone front or rear cam, 4K if available
- [ ] Location that matches the b-roll world: beside the ute, on a job site, driveway.
      NOT a desk, NOT a ring light setup
- [ ] Eye level or slightly below, head + shoulders, eyes to lens
- [ ] Outdoor natural light, overcast is perfect (matches the AI clips). Avoid harsh
      backlight
- [ ] Same energy as your two live founder vids, a notch more amused (you're reacting
      to the fail)
- [ ] Keep your face inside the middle 60% of frame (Reels UI eats top 14% / bottom 20%)
- [ ] Record 10s of room tone / ambient at the end (for the edit)

## 2. Record: the real receptionist call (the proof section's audio)

- [ ] Ring the demo number (or your live Flynn number) from a quiet spot
- [ ] Play the caller. Book THIS job so it matches the app captures:
      **blocked drain, 12 Oak Street, water backing up in the laundry, wants someone
      this arvo** (Flynn should land on ~2pm — the fixtures show 2:00pm)
- [ ] 2-3 takes. Keep the one where Flynn confirms a time naturally
- [ ] Capture: speakerphone next to a second phone running Voice Memos is fine.
      Cleaner: pull the Twilio recording afterwards (ask Claude)
- [ ] Save the audio file(s) to `call-audio/` in this folder
- [ ] *(This doubles as the a.md Gate 2.4 real-device validation — note any weirdness)*

## 3. Edit: Creative 3 — HERO (target ~28-30s, 1080×1920)

Timeline (assets in `broll/`, `raw/`; full detail in `03-hero/EDIT-SHEET.md`):

- [ ] 0-2.2s: `L1-c-take1.mp4` trimmed — **in at ~1.2s, out at ~3.4s** (opens
      mid-slide, keeps the flail + airborne phone). No caption needed, or one word:
      "oi." Let the fail read
- [ ] 2.2-3.1s: `L2-a.mp4` — **~0.9s**: fall, clack, one bounce. Do not shorten the
      impact below ~0.8s, it's the punchline
- [ ] 3.1s: CUT TO YOU on the clack. Hook line
- [ ] ~5-12s: your body lines. Optionally picture-in-picture the app over your shoulder
- [ ] 12-22s: proof — `raw/A-hero-home-call-job.mov` (call transcript screen, 6s→13s)
      with the REAL CALL AUDIO playing, transcript-style burned captions, two lines max
- [ ] 22-26s: app Home ("Flynn answered" card). Caption: "real call. real app."
- [ ] 26-30s: end card + your offer line. Caption: "$69/mo · 7-day free trial" + App
      Store badge
- [ ] Captions: designed, burned, middle band only (top 14% / bottom 20% clear)
- [ ] Audio: native clip audio for the fail (scrape + clack are generated), duck music
      under the call, no music over the call audio
- [ ] Export: 1080×1920, H.264, save as `exports/03-hero-v1.mp4`

## 4. Edit: Creative 4 — Money tail (~20-22s, 1080×1920)

No filming needed — app captures + one b-roll clip (detail in `04-money-tail/EDIT-SHEET.md`):

- [ ] 0-2.5s: `raw/B-money-invoice-paid-home.mov` 0-2.5s, punch in on the overdue card.
      Caption: "the $1,452 nobody's paid yet"
- [ ] 2.5-5s: `broll/S3-c.mp4` (knock-off, checks phone). Caption: "you know the one."
- [ ] 5-12s: B .mov 5-12s — Mark paid → payment sheet → "Paid in full" (real time)
- [ ] 12-16s: `raw/B2-home-after-paid.mov` — Home owed drops to $2,616. Caption:
      "watch the number drop"
- [ ] 16-19s: S3-c remainder or hold last Home frame. Caption: "quoting and invoicing
      included. not an add-on."
- [ ] 19-22s: end card. "from $29/mo · 7-day free trial" + App Store badge
- [ ] Optional VO A/B (AU male, dry): script in the edit sheet. Captions-only version
      ships first
- [ ] Export: `exports/04-money-tail-v1.mp4`

## 5. Already done (no action)

- Carousel cards 1-4 + statics at 1:1, 4:5, 9:16 → `brand/ad-creatives/output/`
- Your two live founder vids stay as creatives 1-2

## 6. Before Meta can go live (from a.md Gate 6)

- [ ] App Store build with the $29/$69 tiers approved & live (Gates 6.1/6.2) — the
      subscriptions are "Prepare for Submission" and ship with the next version
- [ ] Full funnel once on a real device, real card (Gate 6.1)
- [ ] Exports in `exports/`, Claude QC pass done

**Then Claude sets up:** one Advantage+ App campaign, App Promotion objective, iOS,
AU broad, single ad set, CBO A$40/day, 5 ads (2 founder vids + hero + money tail +
carousel). Hands off for the first 3-4 days, judge on hook rate + where Meta puts
spend, kill/refresh rules per the research in `tools/reference/`.
