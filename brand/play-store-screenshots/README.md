# Flynn — Google Play phone screenshots

Android phone screenshots, mirroring the 5 Apple App Store shots in `../app-store-screenshots/`
but Android-flavoured (Flynn keyboard draft panel, Bookings + Brain screens).

## Files (upload in this order)

| File | Eyebrow | Headline | Mirrors Apple |
|------|---------|----------|----------------|
| `01-hero.png` | REPLY IN YOUR VOICE | Reply in your voice in seconds | 01-hero |
| `02-voice.png` | YOUR VOICE | Sounds exactly like you | 02-voice |
| `03-anyone.png` | FOR ANYONE | Work, side gigs or the group chat | 03-anyone |
| `04-booking.png` | BOOKED | Agree a time — Flynn books it | 04-booking |
| `05-brain.png` | BUSINESS BRAIN | Knows your prices, hours & services | 05-brain |

## Google Play size requirements (researched)

Per the Play Console "Main store listing → Phone screenshots" spec:

- **Format:** JPEG or **24-bit PNG** (no alpha)
- **Shortest side:** ≥ 320 px
- **Longest side:** ≤ 3,840 px
- **Aspect ratio:** between **2:1 and 1:2** — the longest side must be **≤ 2× the shortest**
- **File size:** ≤ 8 MB each
- **Count:** 2–8 (we ship 5)

> ⚠️ The Apple shots are 1290 × 2796 (**2.17:1**), which **exceeds** Play's 2:1 cap and would be
> rejected. These are rendered fresh at **1080 × 1920 (9:16 = 1.78:1)** — the canonical Android
> phone size — 24-bit (no alpha), ~200 KB each. Fully compliant.

## Regenerating

```bash
./render.sh        # runs generate.js → html/, then headless-Chrome screenshots each to *.png
```

`generate.js` builds self-contained HTML (mascots base64-inlined from the app's drawables) and
`render.sh` rasterises with headless Google Chrome at exactly 1080 × 1920.
