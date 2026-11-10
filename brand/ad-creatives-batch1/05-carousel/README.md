# Creative 5 — Carousel + statics (DONE — rendered)

Final files live in `brand/ad-creatives/output/`:

- **Carousel (1080×1080):** `e-carousel-card-1..4-1x1.png`
  1. "Answers when you can't." (Home, current UI)
  2. "Books it straight into your calendar." (Bookings)
  3. "Invoices on the spot. Gets you paid." (Invoice)
  4. "Learns your prices, once." + "7-day free trial · from $29 a month" (Brain, dark)
- **Statics (9:16, 4:5, 1:1 each):** `a-painpoint-*` (missed-call stat, dark),
  `b-callnow-*` ("Hear Flynn answer", mascot), `c-hero-home-*` ("Never miss another
  job"), `d-hero-invoice-*` ("Send it. Get paid on the spot.")

Changes made this pass: all screenshots re-shot from the current app UI (light mode,
clean status bar), "She answers/Give her a call" copy replaced (no gendered pronoun —
the product is Flynn), offer updated everywhere to **7-day free trial · from $29 a
month**, b-callnow reframed from the retired call-the-demo-number concept to the
in-app demo call ("Tell Flynn about your business, then let it ring you").

Meta setup: carousel runs cards 1→4 in order with card 4 as the closer; statics are
extra creative-diversity slots (use 4:5 in feed, 9:16 in stories/reels).

To re-render after edits: Chrome with `--remote-debugging-port=9222` open, then
`cd brand/ad-creatives && node render.js`.
