// Content-sprint data — the source for the interactive /sprint checklist.
// This page is the live source of truth (the old Flynn_Content_Sprint.docx /
// Flynn_Locked_Scripts.docx are now stale — don't sync back to them). IDs are
// STABLE — never renumber, or saved progress in localStorage detaches from its
// item. (A3 "farm" angle was removed; its id 'a3' is retired, not reused — codes
// keep their gap on purpose.)
//
// Voice rule for every script below: it's the TRUE story — interning full-time,
// doing jobs after 6 (mowing, landscaping, tip runs), building Flynn late at
// night. Talk like you'd text a mate. No "for a crust", no "it's called flynn",
// no "no app, no login" feature-triads. Track D is the benchmark — match it.

export interface SprintVideo {
  id: string;            // stable key, also the localStorage id prefix
  code: string;          // A1, B1, ...
  title: string;
  badge: '🟢 organic' | '🔵 paid' | '🟣 both';
  length: string;
  hook: string;          // frame-1 / on-screen line, must land on mute
  script: string[];      // the actual spoken VO, line by line — how you'd really talk
  shots: string[];
  captions: string;
  audio: string;
  editNote: string;
  variants?: boolean;    // B1 = 5 hook variants
}

export interface SprintCheck {
  id: string;
  label: string;
}

export interface SprintGroup {
  id: string;
  title: string;
  items: SprintCheck[];
}

export interface ScheduleDay {
  id: string;     // stable, also the localStorage id (a "posted" tick)
  date: string;   // 'Wed 24 Jun'
  code: string;   // which video card — A1, D1, ...
  title: string;  // short label
  why: string;    // why this one, this day — the posting note
}

export const TRACK_A: SprintVideo[] = [
  {
    id: 'a1', code: 'A1', title: 'The origin (operator-builder)', badge: '🟣 both', length: '~30-40s',
    hook: 'i intern all day, do jobs all night. so i built an ai to handle the admin.',
    script: [
      "my days are a bit stupid right now. i intern full time, then i'm out doing jobs til it's dark. mowing, landscaping, whatever pays.",
      "the bit that was actually breaking me wasn't the work. it was getting home at nine and still having to invoice people, sort receipts, chase the money.",
      "so i built a thing i can just text. i tell it what i did and it sends the invoice, logs the receipt, chases whoever hasn't paid.",
      "and i'm not special. everyone i know doing this on the side is drowning in the same admin.",
      "you text it like you'd text a mate. that's the whole thing.",
    ],
    shots: [
      'You in the ute seat, straight to camera, deliver the hook (DJI mic).',
      'CUT to after-work job B-roll: mowing / whipper-snipping / hauling green waste (real effort, fading light).',
      'Back to you for the "getting home at nine and still doing admin" line.',
      "Screen-record (tight): text Flynn 'invoice the henderson job $400' → 'sent', then snap a receipt → 'logged'.",
      "Back to you: 'everyone i know doing this on the side is buried in the same admin.'",
      "End on you: 'you text it like you'd text a mate.' (organic: stop. paid: Message Flynn end card.)",
    ],
    captions: 'ALL-CAPS karaoke, highlight ADMIN / $400 / TEXT IT LIKE A MATE.',
    audio: 'Organic: VO + quiet bed. Paid: VO + Epidemic bed, mute-proof.',
    editNote: 'Vary tempo: slower on the personal lines, snappy on the demo. The after-work job B-roll is un-fakeable, do not skip it.',
  },
  {
    id: 'a2', code: 'A2', title: 'I built it for myself', badge: '🟣 both', length: '~20-25s',
    hook: 'i kept forgetting to invoice people. so i built a thing that does it when i text it.',
    script: [
      "i kept forgetting to send invoices. like actually losing money, cause i'd get home wrecked and just not do it.",
      'so i built something. now i text it what i did and it sends the invoice for me.',
      "that's genuinely it. i text it like i'd text you.",
    ],
    shots: [
      'You, end-of-day tired, ute or couch, straight to cam, deliver the hook.',
      'CUT to screen-record: one text → invoice sent.',
      "You: 'i text it like i'd text you.'",
    ],
    captions: 'ALL-CAPS karaoke, highlight INVOICES / JUST A TEXT.',
    audio: 'Original VO + low bed.',
    editNote: 'Under 25s. One pattern interrupt (cut to screen-record). Need-driven origin = strongest founder hook.',
  },
  {
    id: 'a4', code: 'A4', title: 'Build-update / countdown (run as a SERIES)', badge: '🟢 organic', length: '~20-30s',
    hook: "day 1 of trying to get flynn its first paying tradies before i fly out.",
    script: [
      "right, i'm trying to get flynn its first paying tradies before i fly out. this is day one.",
      'today i [shipped the thing / talked to four sparkies / fixed the bug that was driving me mental].',
      "day one done. follow along, this is gonna be a bit of a scramble.",
    ],
    shots: [
      'You, raw/handheld, state the goal + the clock.',
      'Quick cuts of what you shipped/learned today (screen, whiteboard, ute).',
      "End: 'day 1 done. follow to see if i make it.'",
    ],
    captions: "ALL-CAPS; big 'DAY 1' number on screen.",
    audio: 'Original VO; optional low bed.',
    editNote: 'Front-load the goal in the first words (day-1-of format). Keep it RAW. Serialized → drives follows. This is the build-in-public sibling to Track D (the $2,500 challenge) — run whichever fits the week, don\'t overlap both at once.',
  },
  {
    id: 'a5', code: 'A5', title: 'Reaction in your lane', badge: '🟢 organic', length: '~25-40s',
    hook: "everyone keeps telling me apple's about to kill the thing i'm building.",
    script: [
      "everyone keeps tagging me like 'mate, apple's adding ai to imessage, you're cooked.'",
      'nah. apple writes you a reply. flynn actually does the job. sends the invoice, books the gig, logs the receipt.',
      "one drafts a text. the other runs your whole back office. not the same thing.",
    ],
    shots: [
      'You to cam, clean background, hook mid-sentence.',
      'B-roll cutaway: Flynn doing a real task (screen-record).',
      'You: your take — flynn lives on the number they already use AND executes real tasks.',
    ],
    captions: 'ALL-CAPS karaoke; highlight the news term + EXECUTES.',
    audio: 'Original VO.',
    editNote: 'Punchy, opinionated. On-topic hook filters for builders. Drives comment threads.',
  },
  {
    id: 'a6', code: 'A6', title: 'Day in the life (the fusion)', badge: '🟢 organic', length: '~30-45s',
    hook: 'interning till 5, doing jobs till dark, building the app till midnight.',
    script: [
      "internship all day. then i go straight out and do jobs til i can't see anymore. mowing, hauling green waste to the tip.",
      "then i get home and build the exact thing i needed an hour ago, when i was too cooked to do my own invoices.",
      "working the jobs by day, building for people who work the jobs by night. it's a weird life, but it's the whole reason the thing actually works.",
    ],
    shots: [
      'Morning: the commute / desk at the internship, early start (gimbal walk-and-talk optional).',
      'Evening: out on a job, mowing / hauling, racing the light, the finish.',
      'Night: laptop, late, building (screen glow).',
      'VO over the top tying the two halves together.',
    ],
    captions: 'Minimal captions, let the montage breathe, a few key lines.',
    audio: 'Trending bed (day-in-life suits trending audio) + light VO.',
    editNote: 'Montage cut to the music, vary shot length. Highly save/send-able. Plays to BOTH audiences.',
  },
  {
    id: 'a7', code: 'A7', title: 'The $2,500-before-Europe challenge', badge: '🟣 both', length: '~30-45s',
    hook: "i finished my last exam thursday and i fly to europe wednesday. i need $2,500 by then.",
    script: [
      "i just sat my last exam and my flight to europe leaves wednesday. that gives me six days, and i'm about two and a half grand short.",
      "so the deal i made with myself, every day this week i take whatever job i can get. mowing, hauling, a tip run, if it pays i'm doing it.",
      "the one rule is i don't touch any admin. not a quote, not an invoice, not a single receipt. i just do the work and the money side sorts itself out.",
      "[day 6] twenty-five sixty. made the lot with my hands and never once sat down to do paperwork.",
      "the thing running all of that while i was out grafting, it's just a text thread. i text it like a mate and it does the rest. that's flynn.",
    ],
    shots: [
      "You to cam, just-finished-uni energy. The stakes + the clock, casual like you're telling a mate, not narrating a trailer.",
      'The day\'s job — pull real footage from your camera roll (mowing, hauling, the tip run) and VO over it as if it happened this week. Fast cuts to the beat.',
      "Cut-ins of the back office quietly running itself: a quote going out, an invoice getting chased, a receipt logged. DON'T name what's doing it yet.",
      'A running $ tally ticking up across the days on screen ($640… $1,480… $2,150…).',
      "Final day, the WIN: '$2,560. made it.' a real little celebration, not staged.",
      "Only NOW the reveal — it was all one text thread, that's Flynn. (organic: end there. paid: Message Flynn card.)",
    ],
    captions: "ALL-CAPS karaoke; the running $ TALLY is the hero — animate it ticking up day by day, highlight the final number. Don't put the word 'Flynn' on screen until the last line.",
    audio: 'Organic: upbeat trending bed building to the win. Paid: licensed build-up track, mute-proof.',
    editNote: "Stakes + payoff, casual NOT cinematic. Framing: last exam Thursday, fly Wednesday = six days, grinding ALL DAY (NOT after-work). Backfill the daytime jobs with camera-roll footage + VO. Flynn is invisible until the final line — the whole video IS the challenge, Flynn is just the reveal of HOW it held up. Tally carries watch-time.",
  },
];

export const TRACK_B: SprintVideo[] = [
  {
    id: 'b1', code: 'B1', title: 'Receipt to books (the HERO)', badge: '🔵 paid', length: '~10-15s', variants: true,
    hook: 'watch me do my whole bookkeeping in one text.',
    script: [
      'watch me do my entire bookkeeping in one text.',
      'grab a receipt off the pile in the ute, snap it, send it.',
      "'logged $94.20 fuel, tax ready.' done. didn't even open an app.",
    ],
    shots: [
      'Tight screen-record: grab a receipt from the ute console (real prop), drag into the Flynn thread.',
      "Flynn replies 'logged $94.20 fuel to your books.'",
      'End card: Message Flynn → flynnai.app',
    ],
    captions: 'Burned-in ALL CAPS, highlight the $ figure.',
    audio: 'No trending music. Meta Sound Collection bed or VO + a UI ding. Mute-proof.',
    editNote: '5 hook-line variations, body constant, test on hook-rate. Your best-converting asset — scale the winner.',
  },
  {
    id: 'b2', code: 'B2', title: 'Multi-task combo (proves it is an AGENT)', badge: '🔵 paid', length: '~12-15s',
    hook: 'i sent one text and this ai did three jobs at once.',
    script: [
      'i sent one text and this thing did three jobs at once.',
      'chased an overdue invoice, drafted a quote, logged a receipt. off one message.',
      "that's the bit people miss. it doesn't just reply, it actually does the work.",
    ],
    shots: [
      'Screen-record: one message → Flynn chases an invoice, drafts another, logs the receipt.',
      'End card CTA.',
    ],
    captions: 'Number each task on screen (1, 2, 3).',
    audio: 'Licensed bed or VO, mute-proof.',
    editNote: 'The combo is the proof Flynn executes.',
  },
  {
    id: 'b3', code: 'B3', title: 'Send from YOUR email', badge: '🔵 paid', length: '~12s',
    hook: 'flynn sent that quote from my email. not some bot address.',
    script: [
      'flynn just sent that quote from MY email. not some dodgy bot address.',
      'customer gets it from me, looks legit, replies straight back to me.',
      "and i didn't open gmail once.",
    ],
    shots: [
      'Screen-record: Flynn drafts + sends from your Gmail/Outlook.',
      'Close on the sent email showing YOUR address.',
      'End card CTA.',
    ],
    captions: 'Highlight MY EMAIL.',
    audio: 'Licensed/VO, mute-proof.',
    editNote: 'The "it is actually me emailing my customer" proof.',
  },
  {
    id: 'b4', code: 'B4', title: 'Run it from iMessage (no-app wedge)', badge: '🔵 paid', length: '~12-15s',
    hook: 'this is my whole business. it\'s a text thread.',
    script: [
      "this is my whole business. it's a text thread.",
      'quotes, invoices, bookings, receipts. all of it, in here.',
      "no app to learn. you just text it like you'd text your mate.",
    ],
    shots: [
      'Hold the phone up showing the real Flynn thread (no app-delete gimmick).',
      'Quick screen-record of tasks happening in the thread.',
      'End card CTA.',
    ],
    captions: 'The positioning line as the key caption.',
    audio: 'Licensed/VO, mute-proof.',
    editNote: 'Confident, not defensive. Let the no-app point be obvious.',
  },
  {
    id: 'b5', code: 'B5', title: '9pm admin (the tradie-audience winner)', badge: '🔵 paid', length: '~12-15s',
    hook: "it's 9pm, you've been on the tools since 6, and you still haven't invoiced anyone.",
    script: [
      "it's 9pm. you've been on the tools since six. and you still haven't sent today's invoices.",
      'so you either do it now half asleep, or forget and chase the money next week.',
      "or you text flynn, it's done, and you go to bed.",
    ],
    shots: [
      'You in hi-vis / the ute, tired, 9pm vibe (the problem).',
      'CUT to texting Flynn → done (the relief).',
      'End card CTA.',
    ],
    captions: 'The pain line BIG on frame 1.',
    audio: 'Licensed/VO, mute-proof.',
    editNote: 'Pain → relief. Leading with the 9pm pain wins the tradie audience, most send-able.',
  },
];

// Track D — the REAL serialized challenge. Daily drops, posted same-day, raw.
// The whole format runs on: cold "day N of [specific $ goal]" open + a running
// $ tally on frame 1 + ONE real job beat. Flynn does NOT appear day 1 (day 1 earns
// the follow on pure hustle); it surfaces day 3-4 as the admin you've got no time for,
// and lands its cleanest plug on the day-6 payoff. Days 2-6 are scaffolded on purpose
// — fill the script after you film each day. Do NOT pre-write days that haven't happened.
export const CHALLENGE: SprintVideo[] = [
  {
    id: 'd1', code: 'D1', title: 'Day 1 — mow + tip run (FILMED)', badge: '🟢 organic', length: '~25-35s',
    hook: 'day 1 of making $2,500 in 6 days so i can get to europe. last exam done, flight booked.',
    script: [
      'day one of trying to make two and a half grand in six days. just sat my last exam, flight to europe leaves wednesday.',
      "no real job to fall back on, so i'm just taking whatever work i can get, all day.",
      'today i mowed and whipper-snipped a whole property, then a tip run to clear the green waste.',
      'day one: $___ of $2,500.',
    ],
    shots: [
      'Cold open straight to the goal — no intro, the running $ TALLY on frame 1 ("DAY 1 · $0 / $2,500").',
      'The job: mowing + whipper-snipping (pull from your camera roll if needed, VO over it as today).',
      'The tip run: loading green waste, the drive, dumping it.',
      'End on the tally updating to today\'s number.',
    ],
    captions: 'ALL-CAPS karaoke. Hero element is the persistent DAY + $ TALLY top-of-frame. Highlight $2,500 and EUROPE.',
    audio: 'Original VO + low trending bed building under it. Same bed across all 6 = series signature.',
    editNote: 'Day 1 = pure hustle, NO Flynn. It earns the follow before you sell anything. Fill the $___ with what you actually pulled. Keep it raw/handheld — polish kills the "will he make it" tension. Post same day.',
  },
  {
    id: 'd2', code: 'D2', title: 'Day 2 — (fill after you film)', badge: '🟢 organic', length: '~20-35s',
    hook: 'day 2 of $2,500 in 6 days for europe. [running total: $___]',
    script: [
      'day two. [carry the tally forward: "$___ of twenty-five hundred so far."]',
      '[ONE or two real beats from today — whatever you actually did. do not dress it up.]',
      'day two done: $___ of $2,500.',
    ],
    shots: [
      'Same cold-open structure: "DAY 2 · $___ / $2,500" tally on frame 1.',
      "Today's real job beat(s) — handheld, raw.",
      'End on the tally ticking up.',
    ],
    captions: 'Same tally treatment as D1 — consistency IS the series. Highlight the new running number.',
    audio: 'Same VO + same bed as D1.',
    editNote: 'Still no Flynn — keep building the hustle and the follow. The tally carrying forward is what pulls people back for day 3.',
  },
  {
    id: 'd3', code: 'D3', title: 'Day 3 — (fill after you film) · first Flynn beat', badge: '🟣 both', length: '~25-40s',
    hook: 'day 3 of $2,500 in 6 days. [running total: $___] this is the one where i nearly forgot to invoice anyone.',
    script: [
      'day three. [tally so far: "$___ of twenty-five hundred."]',
      '[ONE real beat from today.]',
      "here's the bit no one shows you — by the end of a day this full i'm too knackered to sit and do invoices.",
      "so before i pack up i just snap the before and afters, text the job to flynn, and it sends the client an invoice with the photos right on it. logs the lot, chases the money too. that's the only reason this is working.",
      'day three: $___ of $2,500.',
    ],
    shots: [
      '"DAY 3 · $___ / $2,500" tally on frame 1.',
      "Today's real job beat — and grab a clean before + after of the lawn (this is the hero shot for the invoice beat).",
      'Cut-in screen-record: text Flynn the before/after pics + "invoice the job $___" → an invoice page with YOUR photos embedded on it, link ready to send.',
      'End on the tally.',
    ],
    captions: 'Tally hero. On the Flynn beat, highlight PHOTOS ON THE INVOICE / SENT.',
    audio: 'Same VO + bed. Keep the Flynn line casual, drop it into the story, do not pivot into an ad voice.',
    editNote: 'FIRST Flynn appearance, mid-to-late in the video — by now the engaged viewers are the ones still watching, so this is who hears it. The photos-on-the-invoice beat is the standout, let it land: the before/after the viewer just watched you do shows up ON the invoice. Frame Flynn as what makes the hustle survivable, NOT the hero. Keep it to ~6-8s of the cut.',
  },
  {
    id: 'd4', code: 'D4', title: 'Day 4 — (fill after you film)', badge: '🟢 organic', length: '~20-35s',
    hook: 'day 4 of $2,500 in 6 days. [running total: $___] halfway-ish and the gap is real.',
    script: [
      'day four. [tally — and lean into the gap: how far off $2,500 you still are.]',
      '[ONE real beat from today.]',
      '[optional light Flynn callback only if natural — e.g. "flynn already chased two invoices today" — otherwise leave it out.]',
      'day four: $___ of $2,500. [the maths for the days left.]',
    ],
    shots: [
      '"DAY 4 · $___ / $2,500" tally on frame 1 — the gap is the tension now.',
      "Today's real job beat.",
      'End on the tally + a "still need $___" beat to set up the back half.',
    ],
    captions: 'Tally hero. Highlight the GAP / how much left.',
    audio: 'Same VO + bed. Tempo can tighten — the deadline pressure is the story.',
    editNote: 'Build the will-he-make-it tension. Flynn callback is optional and light — D3 already planted it, do not re-sell. This episode\'s job is to make the back half feel uncertain.',
  },
  {
    id: 'd5', code: 'D5', title: 'Day 5 — cutting it close (fill after you film)', badge: '🟢 organic', length: '~20-35s',
    hook: 'day 5 of $2,500 in 6 days. [running total: $___] one day left after this. cutting it close.',
    script: [
      'day five. [tally — and the honest maths: how much you still need with one day to go.]',
      '[the biggest grind day — ONE or two real beats from today.]',
      'day five: $___ of $2,500. [set up the finale: "need $___ tomorrow or i don\'t make it."]',
    ],
    shots: [
      '"DAY 5 · $___ / $2,500" tally on frame 1 — the gap is the whole story.',
      "Today's real job beat(s) — the hardest push of the week.",
      'End on the tally + a stark "need $___ tomorrow" card to cliffhang into D6.',
    ],
    captions: 'Tally hero. Highlight the GAP and the one-day-left pressure.',
    audio: 'Same VO + bed. Tighten the tempo — this is the cliffhanger before the finale.',
    editNote: 'Pure tension, NO Flynn re-sell. This episode\'s only job is to make D6 feel genuinely uncertain — end on the gap, not a resolution.',
  },
  {
    id: 'd6', code: 'D6', title: 'Day 6 — the payoff (fill after you film)', badge: '🟣 both', length: '~30-45s',
    hook: 'day 6. last day before i fly. did i make $2,500 in 6 days? [final tally reveal]',
    script: [
      'day six. last chance, i fly tonight. [where you started the day, how much you needed.]',
      '[the final push — ONE real beat from today.]',
      '[the reveal: the final number hitting / passing $2,500.]',
      "and the admin? didn't open a spreadsheet once. flynn logged every receipt and chased every invoice while i did the actual work.",
      '[real reaction to the result — win or near-miss, keep it honest.]',
    ],
    shots: [
      '"DAY 6 · $___ / $2,500" tally on frame 1.',
      'The final job beat.',
      'The tally crossing the line — animate it hitting $2,500 (the payoff frame).',
      'A genuine real reaction (fist-pump / relief / "barely made it").',
      'Soft Flynn close + "Message Flynn" end card on the paid cut.',
    ],
    captions: 'The FINAL NUMBER is the hero frame — biggest, brightest, Flynn orange. Highlight $2,500 crossing.',
    audio: 'Organic: VO + bed building to the win. Paid cut: licensed/mute-proof build-up.',
    editNote: 'The payoff carries the whole series, so this is the strongest, most legitimate place to plug Flynn — tie the win directly to "I did the work, Flynn did the books." If you fall short, post it honestly anyway; a real near-miss out-performs a fake win and keeps the series trustworthy.',
  },
];

export const BROLL: SprintGroup[] = [
  {
    id: 'broll-removals', title: 'After-work jobs (un-fakeable proof)', items: [
      { id: 'br-rem-1', label: 'Mowing + whipper-snipping, sweat, racing the light' },
      { id: 'br-rem-2', label: 'Loading green waste into the ute' },
      { id: 'br-rem-3', label: 'Before/after: overgrown → tidy lawn' },
      { id: 'br-rem-4', label: 'Hands + detail shots of the actual work' },
      { id: 'br-rem-5', label: 'Hopping out of the ute at a job' },
    ],
  },
  {
    id: 'broll-ute', title: 'The ute', items: [
      { id: 'br-ute-1', label: 'Talking-head from the driver seat' },
      { id: 'br-ute-2', label: 'Driving POV' },
      { id: 'br-ute-3', label: 'Phone-in-hand texting Flynn (over-shoulder)' },
      { id: 'br-ute-4', label: 'Console stuffed with servo receipts (real prop for B1)' },
      { id: 'br-ute-5', label: 'Parked at a job, door open' },
    ],
  },
  {
    id: 'broll-hivis', title: 'Hi-vis / town (Byron)', items: [
      { id: 'br-hv-1', label: 'Walking the main street in workwear' },
      { id: 'br-hv-2', label: 'On a site-looking spot' },
      { id: 'br-hv-3', label: 'Coffee in workwear' },
    ],
  },
  {
    id: 'broll-build', title: 'Building / late night', items: [
      { id: 'br-farm-1', label: 'Laptop set up wherever you are, nice light' },
      { id: 'br-farm-2', label: 'Scrappy desk / build setup' },
      { id: 'br-farm-4', label: 'Working late, screen glow' },
    ],
  },
  {
    id: 'broll-win', title: 'A win / celebration (for A7)', items: [
      { id: 'br-win-1', label: 'A genuine fist-pump / cheers / ute-door-slam payoff beat' },
    ],
  },
];

export const SCREEN_RECORDS: SprintCheck[] = [
  { id: 'sr-1', label: 'Receipt photo → "logged $X to your books"' },
  { id: 'sr-2', label: '"chase the henderson invoice" → "want me to send it?" → sent' },
  { id: 'sr-3', label: '"quote the smith job" → drafted quote' },
  { id: 'sr-4', label: 'The Sunday money digest landing' },
  { id: 'sr-5', label: 'Send a quote/email from your Gmail/Outlook' },
  { id: 'sr-6', label: '"book the henderson job thursday 2pm" → booked' },
  { id: 'sr-7', label: 'Before/after pics + "invoice the job $X" → invoice page with the photos embedded → share link (the hero demo)' },
];

// Posting plan — one drop a day, 24 Jun → 6 Jul. Last exam Thu 25 Jun, you FLY
// Wed 1 Jul. Track D runs as an UNBROKEN 6-day block (Fri 26 Jun → Wed 1 Jul, the
// day you leave) so the tally + "will he make it" tension actually works, payoff
// landing the morning you fly out. The A-track identity posts (A1/A6) still carry
// the old "intern by day" framing — reconcile those separately. Post to BOTH IG
// Reels + TikTok each day. IDs are stable — never renumber.
export const POST_PLAN: ScheduleDay[] = [
  { id: 'post-1',  date: 'Wed 24 Jun', code: 'A1', title: 'The origin',          why: 'Departure day. Tell people who you are: intern by day, jobs by night, built Flynn. Sets up everyone who finds you later.' },
  { id: 'post-2',  date: 'Thu 25 Jun', code: 'A6', title: 'Day in the life',     why: 'The fusion montage over trending audio. Highly shareable, reinforces yesterday\'s identity.' },
  { id: 'post-3',  date: 'Fri 26 Jun', code: 'D1', title: 'Challenge · day 1',   why: 'Start the $2,500 series. Pure hustle, no Flynn. The tally + "will he make it" is the hook. Make it a playlist on your profile.' },
  { id: 'post-4',  date: 'Sat 27 Jun', code: 'D2', title: 'Challenge · day 2',   why: 'Carry the tally forward. Still no Flynn. This is where the returning-viewer engine kicks in.' },
  { id: 'post-5',  date: 'Sun 28 Jun', code: 'D3', title: 'Challenge · day 3',   why: 'First Flynn beat, mid-video. Frame it as the only reason the hustle is survivable, not an ad.' },
  { id: 'post-6',  date: 'Mon 29 Jun', code: 'D4', title: 'Challenge · day 4',   why: 'The gap is real. Lean into how far off $2,500 you still are. Build the tension.' },
  { id: 'post-7',  date: 'Tue 30 Jun', code: 'D5', title: 'Challenge · day 5',   why: 'Cutting it close — one day left. End on the gap, not a resolution. Cliffhang into the finale.' },
  { id: 'post-7b', date: 'Wed 1 Jul',  code: 'D6', title: 'Challenge · day 6',   why: 'The payoff, and the day you fly. Tally crosses $2,500. Your strongest, most earned Flynn plug — best single shot at a breakout.' },
  { id: 'post-8',  date: 'Thu 2 Jul',  code: 'A2', title: 'I built it for myself', why: 'Founder note after the win. Short confessional hook, strong standalone.' },
  { id: 'post-9',  date: 'Fri 3 Jul',  code: 'A5', title: 'Reaction in your lane', why: 'Opinionated, on-topic. Filters for builders and drives comment threads (comments = reach).' },
  { id: 'post-10', date: 'Sat 4 Jul',  code: 'B5', title: '9pm admin',           why: 'Pain → relief, the most send-able one. "Tag your tradie mate." High-intent scrolling.' },
  { id: 'post-11', date: 'Sun 5 Jul',  code: 'A4', title: 'Build update',        why: 'Raw build-in-public check-in. Keeps the series energy going without a whole new challenge.' },
  { id: 'post-12', date: 'Mon 6 Jul',  code: 'B1', title: 'Receipt to books',    why: 'The clean one-text demo. Also your best paid-ad creative — note if it pops, that\'s the one to scale on Meta.' },
];

export const EDIT_QA: string[] = [
  'Hook lands on frame 1 (readable on mute)',
  'Hard cuts only, dead air trimmed, tempo varies',
  'Burned-in ALL-CAPS karaoke captions (Anton, white + black outline, 1 keyword highlighted)',
  'Audio set (organic: VO + quiet bed / ad: licensed, mute-proof)',
  '9:16, 1080p',
  'Captions in the safe zone (Reels lower-third / TikTok center-upper)',
  'Organic = soft/no CTA + a reason to SEND / Ad = "Message Flynn" end card',
  'Exported clean (no TikTok watermark)',
];

export const PLAYBOOK: { heading: string; points: string[] }[] = [
  {
    heading: 'Talk like you text, not like a trailer',
    points: [
      'Read the script out loud. If it sounds like a movie voiceover ("4 days. one ute."), bin it.',
      'Casual, lowercase, contractions, a bit of slang. How you\'d actually tell a mate.',
      'A real face + a real sentence beats polished + scripted every time.',
    ],
  },
  {
    heading: 'Cut, do not transition',
    points: [
      'Hard / straight cuts only. No wipes, dissolves, spins.',
      'A cut roughly every 3s. Never faster than 2s (faster LOWERS completion).',
      'Vary tempo: slower on story, snappy on demo. Trim every "um".',
    ],
  },
  {
    heading: 'Captions = your #1 lever (80%+ watch on mute)',
    points: [
      'Font: Anton or Montserrat Black. ALL CAPS, 3-5 words/line.',
      'White text, thick black outline. Highlight ONE keyword in Flynn orange.',
      'Word-by-word karaoke pop, not static blocks.',
    ],
  },
  {
    heading: 'Audio: organic ≠ paid (legal, not taste)',
    points: [
      'Organic: VO baked in + a quiet trending bed under it.',
      'Paid ads: NO trending/licensed music. Meta Sound Collection / Epidemic / your VO.',
      'Design every AD to land fully ON MUTE. Mute-test before you ship.',
    ],
  },
  {
    heading: 'Hook: win the first 1 second',
    points: [
      'Value/pain on the FIRST frame + first caption, readable on mute.',
      'Motion in the first 0.5s. No "hey guys", no backstory.',
      'Hook-rate target: 30%+ Meta, 40%+ TikTok.',
    ],
  },
  {
    heading: 'What drives reach',
    points: [
      'Organic: sends/shares beat likes ~3-5x. Engineer "send this to your tradie mate".',
      'Specificity beats polish: the ACTUAL receipt, a REAL dollar figure.',
      'Don\'t open the same safe way everyone else does.',
    ],
  },
  {
    heading: 'Hook formats that convert (data-backed)',
    points: [
      'Front-load the goal in the FIRST words: "day 1 of [specific $ goal]" beats burying "day 1" at the end.',
      'Always a specific number: "$2,500 in 6 days" / "logged $94.20" beats "make money" by ~5x.',
      'Outcome-first is the single highest-performing hook: show the result in frame 1-2 (running $ tally, the sent invoice).',
      'Confessional / negative framing punches up: "i kept forgetting to invoice", "the bit no one shows you", "everyone says i\'m cooked".',
      'Serialize it: daily "day N" episodes build next-video intent + returning viewers. The carried-forward tally is the pull-back.',
      'Realistic effort > get-rich-quick: real after-hours grind reads credible; audiences bail the second it smells fake.',
    ],
  },
];
