// Content-sprint data — the source for the interactive /sprint checklist.
// Mirrors Flynn_Content_Sprint.docx + Flynn_Locked_Scripts.docx so the phone
// checklist and the docs stay in sync. IDs are STABLE — never renumber, or saved
// progress in localStorage detaches from its item. (A3 "farm" angle was removed;
// its id 'a3' is retired, not reused — codes keep their gap on purpose.)

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

export const TRACK_A: SprintVideo[] = [
  {
    id: 'a1', code: 'A1', title: 'The origin (operator-builder)', badge: '🟣 both', length: '~30-40s',
    hook: 'i move furniture for a living and i built an ai that does my paperwork.',
    script: [
      'i move furniture for a crust. and i built an ai that does all my paperwork.',
      'after a big day lugging lounges up three flights, the last thing i wanna do is sit down and invoice people.',
      "so now i just text it. 'invoice the henderson job, 400 bucks.' done. snap a servo receipt, it's logged.",
      "and it's not just me being slack. every solo operator i know is buried in this stuff.",
      "it's called flynn. you literally just text it. no app, no login.",
    ],
    shots: [
      'You in the ute seat, straight to camera, deliver the hook (DJI mic).',
      'CUT to removals B-roll: carrying furniture / loading the ute (real effort).',
      'Back to you for the tired-of-paperwork line.',
      "Screen-record (tight): text Flynn 'invoice the henderson job $400' → 'sent', then snap a receipt → 'logged'.",
      "Back to you: 'it is not just me. every solo operator is buried in this.'",
      "End on you: 'you just text it.' (organic: stop. paid: Message Flynn end card.)",
    ],
    captions: 'ALL-CAPS karaoke, highlight PAPERWORK / $400 / JUST TEXT IT.',
    audio: 'Organic: VO + quiet bed. Paid: VO + Epidemic bed, mute-proof.',
    editNote: 'Vary tempo: slower on the personal lines, snappy on the demo. The removals B-roll is un-fakeable, do not skip it.',
  },
  {
    id: 'a2', code: 'A2', title: 'I built it for myself', badge: '🟣 both', length: '~20-25s',
    hook: 'i kept forgetting to invoice people. so i built a thing that does it when i text it.',
    script: [
      "i kept forgetting to send invoices. like genuinely losing money cause i'd get home knackered and forget.",
      'so i built something. now i just text it what i did and it sends the invoice for me.',
      "that's it. no app, no logging in. just a text.",
    ],
    shots: [
      'You, end-of-day tired, ute or couch, straight to cam, deliver the hook.',
      'CUT to screen-record: one text → invoice sent.',
      "You: 'no app, no login. just a text.'",
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
    editNote: 'Front-load the goal in the first words (day-1-of format). Keep it RAW. Serialized → drives follows. This is the build-in-public sibling to Track D (the $1,500 challenge) — run whichever fits the week, don\'t overlap both at once.',
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
    hook: 'moving furniture till 3, building an ai company till midnight.',
    script: [
      "mornings i'm on the tools. moving furniture, loading the ute, the usual.",
      'then i get home and build the exact thing i wish i had when i\'m doing admin at 10pm.',
      "tradie by day, building for tradies by night. weird mix, but it's the whole reason it actually works.",
    ],
    shots: [
      'Morning: loading the ute, early start (gimbal walk-and-talk optional).',
      'Midday: on a job, carrying, the team, the finish.',
      'Evening: laptop, late, building (screen glow).',
      'VO over the top tying the two halves together.',
    ],
    captions: 'Minimal captions, let the montage breathe, a few key lines.',
    audio: 'Trending bed (day-in-life suits trending audio) + light VO.',
    editNote: 'Montage cut to the music, vary shot length. Highly save/send-able. Plays to BOTH audiences.',
  },
  {
    id: 'a7', code: 'A7', title: 'The $1,500-in-4-days challenge', badge: '🟣 both', length: '~30-45s',
    hook: "i need $1,500 in 4 days for this trip. so i'm running my whole business off flynn to see if it holds up.",
    script: [
      "okay i need fifteen hundred bucks in four days to get to europe. flight's already booked, slight problem.",
      "so i'm running my entire business off flynn and seeing if it carries me.",
      'i do the jobs. it does the quotes, chases the invoices, logs every receipt.',
      "[day 4] fifteen sixty. made it. didn't open a spreadsheet once.",
    ],
    shots: [
      'You to cam, the stakes + the clock (keep it casual, not a movie trailer).',
      'Montage of your existing hustle B-roll: jobs, loading the ute, grinding, fast cuts to a beat.',
      "Cut-ins of Flynn running the back office: quote drafted, 'chase the henderson invoice' → sent, receipt logged.",
      'A running $ tally ticking up on screen ($420… $890… $1,310…).',
      "Day 4, the WIN: '$1,560. made it.' little real celebration (fist pump / cheers).",
      "End line: 'didn't open a spreadsheet once.' (organic: stop. paid: Message Flynn card.)",
    ],
    captions: 'ALL-CAPS karaoke; the running $ TALLY is the hero — animate it ticking up, highlight the final number.',
    audio: 'Organic: upbeat trending bed building to the win. Paid: licensed build-up track, mute-proof.',
    editNote: 'Stakes + payoff, but keep the delivery casual and real, NOT dramatic/cinematic. The tally carries watch-time. Mostly existing B-roll + VO.',
  },
];

export const TRACK_B: SprintVideo[] = [
  {
    id: 'b1', code: 'B1', title: 'Receipt to books (the HERO)', badge: '🔵 paid', length: '~10-15s', variants: true,
    hook: 'watch me do my whole bookkeeping in one text.',
    script: [
      'watch me do my entire bookkeeping in one text.',
      'grab a receipt off the pile in the ute. snap it, send it to flynn.',
      "'logged $94.20 fuel, tax ready.' that's it. no app, no spreadsheet.",
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

// Track D — the REAL serialized challenge. Daily drops, posted same-night, raw.
// The whole format runs on: cold "day N of [specific $ goal]" open + a running
// $ tally on frame 1 + ONE real job beat. Flynn does NOT appear day 1 (day 1 earns
// the follow on pure hustle); it surfaces day 3-4 as the admin you've got no time for,
// and lands its cleanest plug on the day-5 payoff. Days 2-5 are scaffolded on purpose
// — fill the script after you film each night. Do NOT pre-write days that haven't happened.
export const CHALLENGE: SprintVideo[] = [
  {
    id: 'd1', code: 'D1', title: 'Day 1 — mow + tip run (FILMED)', badge: '🟢 organic', length: '~25-35s',
    hook: 'day 1 of making $1,500 in 5 days, only after work, so i can get to europe.',
    script: [
      'day one of trying to make fifteen hundred bucks in five days. only after work. so i can actually afford europe.',
      "i'm interning full time, so all of this happens after six.",
      'tonight i mowed and whipper-snipped a whole property, racing the light before it got too dark.',
      'then a quick tip run to clear the green waste.',
      'day one: $___ of $1,500.',
    ],
    shots: [
      'Cold open straight to the goal — no intro, the running $ TALLY on frame 1 ("DAY 1 · $0 / $1,500").',
      'The 6:30pm rush: mowing + whipper-snipping, beat-the-clock energy, fading light (un-fakeable).',
      'The tip run: loading green waste, the drive, dumping it.',
      'End on the tally updating to tonight\'s number.',
    ],
    captions: 'ALL-CAPS karaoke. Hero element is the persistent DAY + $ TALLY top-of-frame. Highlight $1,500 and EUROPE.',
    audio: 'Original VO + low trending bed building under it. Same bed across all 5 = series signature.',
    editNote: 'Day 1 = pure hustle, NO Flynn. It earns the follow before you sell anything. Fill the $___ with what you actually pulled. Keep it raw/handheld — polish kills the "will he make it" tension. Post same night.',
  },
  {
    id: 'd2', code: 'D2', title: 'Day 2 — (fill after you film)', badge: '🟢 organic', length: '~20-35s',
    hook: 'day 2 of $1,500 in 5 days, after work only. [running total: $___]',
    script: [
      'day two. [carry the tally forward: "$___ of fifteen hundred so far."]',
      '[ONE or two real beats from tonight — whatever you actually did. do not dress it up.]',
      'day two done: $___ of $1,500.',
    ],
    shots: [
      'Same cold-open structure: "DAY 2 · $___ / $1,500" tally on frame 1.',
      "Tonight's real job beat(s) — handheld, racing the same after-work clock.",
      'End on the tally ticking up.',
    ],
    captions: 'Same tally treatment as D1 — consistency IS the series. Highlight the new running number.',
    audio: 'Same VO + same bed as D1.',
    editNote: 'Still no Flynn — keep building the hustle and the follow. The tally carrying forward is what pulls people back for day 3.',
  },
  {
    id: 'd3', code: 'D3', title: 'Day 3 — (fill after you film) · first Flynn beat', badge: '🟣 both', length: '~25-40s',
    hook: 'day 3 of $1,500 in 5 days. [running total: $___] this is the one where i nearly forgot to invoice anyone.',
    script: [
      'day three. [tally so far: "$___ of fifteen hundred."]',
      '[ONE real beat from tonight.]',
      "here's the bit no one shows you — i'm too knackered after a full day plus this to sit and do receipts and invoices.",
      "so i just text flynn what i did and it logs the receipt and chases the money for me. that's the only reason this is working.",
      'day three: $___ of $1,500.',
    ],
    shots: [
      '"DAY 3 · $___ / $1,500" tally on frame 1.',
      "Tonight's real job beat.",
      'Cut-in screen-record: snap a fuel/dump receipt → Flynn "logged"; "chase the [job] invoice" → sent.',
      'End on the tally.',
    ],
    captions: 'Tally hero. On the Flynn beat, highlight LOGGED / CHASE THE INVOICE.',
    audio: 'Same VO + bed. Keep the Flynn line casual, drop it into the story, do not pivot into an ad voice.',
    editNote: 'FIRST Flynn appearance, mid-to-late in the video — by now the engaged viewers are the ones still watching, so this is who hears it. Frame Flynn as what makes the hustle survivable, NOT the hero. Keep it to ~6-8s of the cut.',
  },
  {
    id: 'd4', code: 'D4', title: 'Day 4 — (fill after you film)', badge: '🟢 organic', length: '~20-35s',
    hook: 'day 4 of $1,500 in 5 days. [running total: $___] cutting it close.',
    script: [
      'day four. [tally — and lean into the gap: how far off $1,500 you still are.]',
      '[ONE real beat from tonight.]',
      '[optional light Flynn callback only if natural — e.g. "flynn already chased two invoices today" — otherwise leave it out.]',
      'day four: $___ of $1,500. [the maths for tomorrow.]',
    ],
    shots: [
      '"DAY 4 · $___ / $1,500" tally on frame 1 — the gap is the tension now.',
      "Tonight's real job beat.",
      'End on the tally + a "need $___ tomorrow" beat to set up the finale.',
    ],
    captions: 'Tally hero. Highlight the GAP / how much left.',
    audio: 'Same VO + bed. Tempo can tighten — the deadline pressure is the story.',
    editNote: 'Build the will-he-make-it tension. Flynn callback is optional and light — D3 already planted it, do not re-sell. This episode\'s job is to make day 5 feel uncertain.',
  },
  {
    id: 'd5', code: 'D5', title: 'Day 5 — the payoff (fill after you film)', badge: '🟣 both', length: '~30-45s',
    hook: 'day 5. did i make $1,500 in 5 days, only after work? [final tally reveal]',
    script: [
      'day five. last chance. [where you started the day, how much you needed.]',
      '[the final push — ONE real beat from tonight.]',
      '[the reveal: the final number hitting / passing $1,500.]',
      "and the admin? didn't open a spreadsheet once. flynn logged every receipt and chased every invoice while i did the actual work.",
      '[real reaction to the result — win or near-miss, keep it honest.]',
    ],
    shots: [
      '"DAY 5 · $___ / $1,500" tally on frame 1.',
      'The final job beat.',
      'The tally crossing the line — animate it hitting $1,500 (the payoff frame).',
      'A genuine real reaction (fist-pump / relief / "barely made it").',
      'Soft Flynn close + "Message Flynn" end card on the paid cut.',
    ],
    captions: 'The FINAL NUMBER is the hero frame — biggest, brightest, Flynn orange. Highlight $1,500 crossing.',
    audio: 'Organic: VO + bed building to the win. Paid cut: licensed/mute-proof build-up.',
    editNote: 'The payoff carries the whole series, so this is the strongest, most legitimate place to plug Flynn — tie the win directly to "I did the work, Flynn did the books." If you fall short, post it honestly anyway; a real near-miss out-performs a fake win and keeps the series trustworthy.',
  },
];

export const BROLL: SprintGroup[] = [
  {
    id: 'broll-removals', title: 'Removals (un-fakeable proof)', items: [
      { id: 'br-rem-1', label: 'Carrying / lifting furniture, sweat, real effort' },
      { id: 'br-rem-2', label: 'Loading + strapping the ute' },
      { id: 'br-rem-3', label: 'Before/after: full room → empty room' },
      { id: 'br-rem-4', label: 'The team working, hands + detail shots' },
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
      'Always a specific number: "$1,500 in 5 days" / "logged $94.20" beats "make money" by ~5x.',
      'Outcome-first is the single highest-performing hook: show the result in frame 1-2 (running $ tally, the sent invoice).',
      'Confessional / negative framing punches up: "i kept forgetting to invoice", "the bit no one shows you", "everyone says i\'m cooked".',
      'Serialize it: daily "day N" episodes build next-video intent + returning viewers. The carried-forward tally is the pull-back.',
      'Realistic effort > get-rich-quick: real after-hours grind reads credible; audiences bail the second it smells fake.',
    ],
  },
];
