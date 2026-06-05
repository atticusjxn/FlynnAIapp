/*
 * Generates Google Play phone screenshots for Flynn, mirroring the 5 Apple App Store shots but
 * Android-flavoured (Flynn keyboard draft panel, Bookings + Brain screens). Output is rendered by
 * headless Chrome at 1080x1920 (9:16) — Play-compliant: 24-bit PNG, ratio within 2:1..1:2.
 *
 * Run:  node generate.js   (writes ./html/*.html)
 * Then the sibling render.sh screenshots each with Chrome.
 */
const fs = require('fs');
const path = require('path');

const DRAWABLE = path.resolve(
  __dirname,
  '../../android-native/app/src/main/res/drawable',
);
const OUT = path.join(__dirname, 'html');

const mascot = (name) => {
  const b64 = fs.readFileSync(path.join(DRAWABLE, `${name}.png`)).toString('base64');
  return `data:image/png;base64,${b64}`;
};

const C = {
  cream: '#F4E6CE',
  card: '#FFFBF4',
  ink: '#2C2018',
  orange: '#FB5B1E',
  mustard: '#E8A93B',
  teal: '#3BA8A8',
  terra: '#B85C38',
  olive: '#7A8C3A',
  incoming: '#ECE7DD',
  reply: '#FFFFFF',
  line: '#E7E0D3',
  sub: '#9A8E7C',
};

// Decorative scattered corner shapes — varied per screen, behind the content.
function shapes(variant) {
  const sets = [
    `<div class="sh" style="width:240px;height:240px;border-radius:50%;background:${C.teal};top:-90px;left:-70px"></div>
     <div class="sh" style="width:160px;height:160px;border-radius:50%;background:${C.mustard};bottom:60px;right:-60px"></div>
     <div class="sh" style="width:120px;height:120px;border-radius:50%;background:${C.terra};bottom:-40px;left:90px"></div>`,
    `<div class="sh" style="width:200px;height:200px;border-radius:50%;background:${C.teal};top:-70px;right:-60px"></div>
     <div class="sh" style="width:120px;height:120px;border-radius:50%;background:${C.orange};bottom:120px;left:-50px"></div>
     <div class="sh" style="width:200px;height:200px;border-radius:50%;background:${C.mustard};bottom:-90px;right:60px"></div>`,
    `<div class="sh" style="width:150px;height:150px;border-radius:50%;background:${C.terra};top:-50px;left:-40px"></div>
     <div class="sh" style="width:230px;height:230px;border-radius:50%;background:${C.teal};top:-80px;right:-80px"></div>
     <div class="sh" style="width:130px;height:130px;border-radius:50%;background:${C.orange};bottom:30px;left:-40px"></div>
     <div class="sh" style="width:170px;height:170px;border-radius:50%;background:${C.olive};bottom:-60px;right:40px"></div>`,
    `<div class="sh" style="width:180px;height:180px;border-radius:50%;background:${C.mustard};top:-70px;right:-50px"></div>
     <div class="sh" style="width:130px;height:130px;border-radius:50%;background:${C.terra};bottom:-50px;right:-30px"></div>`,
    `<div class="sh" style="width:150px;height:150px;border-radius:50%;background:${C.orange};bottom:40px;left:-50px"></div>
     <div class="sh" style="width:210px;height:210px;border-radius:50%;background:${C.mustard};bottom:-80px;right:-60px"></div>
     <div class="sh" style="width:150px;height:150px;border-radius:50%;background:${C.teal};top:-60px;right:60px"></div>`,
  ];
  return sets[variant];
}

const statusBar = () => `
  <div class="status">
    <span class="time">9:41</span>
    <span class="sysicons">
      <svg width="22" height="14" viewBox="0 0 22 14"><path fill="${C.ink}" d="M1 9l2-2a9 9 0 0 1 16 0l2 2-1.5 1.5a7 7 0 0 0-17 0z" opacity=".0"/></svg>
      <span class="dot">●●●</span>
      <span class="wifi">⌃</span>
      <span class="batt"></span>
    </span>
  </div>`;

// ── chat screen (screens 1–3) ──────────────────────────────────────────────
function chatScreen({ avatar, name, sub, incoming, bizLabel, replies, hint }) {
  const bubbles = incoming
    .map((t) => `<div class="inbub">${t}</div>`)
    .join('');
  const replyCards = replies
    .map(
      (t, i) => `<div class="rcard${i === 0 ? ' first' : ''}">${t}${
        i === 0 ? `<div class="insert">Tap to insert →</div>` : ''
      }</div>`,
    )
    .join('');
  return `
    ${statusBar()}
    <div class="nav">
      <span class="back">‹</span>
      <div class="navc">
        <div class="avatar">${avatar}</div>
        <div class="navname">${name}</div>
      </div>
      <span class="info">ⓘ</span>
    </div>
    <div class="day">Today 9:41 AM</div>
    <div class="msgs">${bubbles}</div>
    <div class="inputrow">
      <div class="inputfield">Message…</div>
      <div class="send">↑</div>
    </div>
    <div class="kb">
      <div class="kbhead">
        <span class="kbbiz">Flynn · ${bizLabel}</span>
        <span class="kbactions"><span class="redraft">↻ Redraft</span><span class="globe">🌐</span></span>
      </div>
      <div class="kbhint">${hint}</div>
      ${replyCards}
    </div>`;
}

// ── bookings screen (screen 4) ─────────────────────────────────────────────
function bookingsScreen() {
  return `
    ${statusBar()}
    <div class="screenpad">
      <div class="bigtitle">Bookings</div>
      <div class="sectionlabel">UPCOMING</div>
      <div class="bookcard green">
        <div class="bc-check">✓</div>
        <div>
          <div class="bc-title">Booked from your reply</div>
          <div class="bc-sub">Flynn added it to your calendar</div>
        </div>
      </div>
      <div class="bookcard">
        <div class="bc-row"><span class="bc-title">Sam · Coastal Painting</span><span class="badge blue">Booked</span></div>
        <div class="bc-sub">3-bed repaint — quote</div>
        <div class="bc-meta">Thu 12 Jun · 9:00 AM</div>
        <div class="bc-sub">14 Marine Pde, Torquay</div>
      </div>
      <div class="bookcard">
        <div class="bc-row"><span class="bc-title">Priya</span><span class="badge blue">Booked</span></div>
        <div class="bc-sub">Kitchen splashback</div>
        <div class="bc-meta">Sat 14 Jun · 11:30 AM</div>
        <div class="bc-sub">Geelong West</div>
      </div>
      <div class="sectionlabel">PAST</div>
      <div class="bookcard">
        <div class="bc-row"><span class="bc-title">Mike</span><span class="badge green-b">Done</span></div>
        <div class="bc-sub">Fence repair — done</div>
        <div class="bc-meta">Completed · 6 Jun</div>
      </div>
    </div>`;
}

// ── brain screen (screen 5) ────────────────────────────────────────────────
function brainScreen() {
  const price = (name, val) =>
    `<div class="prow"><span>${name}</span><span class="pval">${val}</span></div>`;
  return `
    ${statusBar()}
    <div class="screenpad">
      <div class="bigtitle">Brain</div>
      <div class="braindesc">Flynn cites these when it drafts.</div>
      <div class="bcard">
        <div class="blabel">WHAT YOU DO</div>
        <div class="bbig">Coastal Painting — int. &amp; exterior</div>
      </div>
      <div class="bcard">
        <div class="blabel">SERVICES &amp; PRICING</div>
        ${price('Interior repaint', '$3.5–5k')}
        ${price('Exterior repaint', '$6–9k')}
        ${price('Feature wall', 'from $450')}
        ${price('Free quote', '$0')}
      </div>
      <div class="bcard">
        <div class="blabel">HOURS</div>
        <div class="bhours">Mon–Fri&nbsp;&nbsp;7 AM – 5 PM<br>Sat&nbsp;&nbsp;8 AM – 12 PM</div>
      </div>
      <div class="bcard">
        <div class="blabel">SERVICE AREA</div>
        <div class="bbig">Surf Coast — Torquay to Lorne</div>
      </div>
    </div>`;
}

function page({ file, variant, eyebrow, l1, l2, mascotName, mascotTop, screen, phoneClass = '' }) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  * { margin:0; padding:0; box-sizing:border-box; -webkit-font-smoothing:antialiased; }
  html,body { width:1080px; height:1920px; }
  body { position:relative; overflow:hidden; background:${C.cream};
    font-family:-apple-system,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif; color:${C.ink}; }
  .shapes { position:absolute; inset:0; z-index:0; }
  .sh { position:absolute; }
  .eyebrow { position:absolute; top:72px; left:80px; z-index:5; color:${C.orange};
    font-weight:800; font-size:26px; letter-spacing:3px; }
  .headline { position:absolute; top:132px; left:78px; z-index:5; font-weight:800;
    font-size:78px; line-height:84px; letter-spacing:-1.5px; }
  .headline .o { color:${C.orange}; }
  .mascot { position:absolute; right:34px; width:236px; z-index:30; filter:drop-shadow(0 8px 14px rgba(0,0,0,.18)); }
  .phone { position:absolute; left:180px; width:720px; top:430px; height:1452px;
    background:#0E0E10; border-radius:60px; padding:13px 13px 0; z-index:20;
    box-shadow:0 30px 60px rgba(0,0,0,.28); }
  .screen { width:100%; height:100%; background:#F3F1EC; border-radius:48px 48px 0 0; overflow:hidden;
    position:relative; }
  .screen.chat { background:#FFFFFF; display:flex; flex-direction:column; }
  .screen.chat .msgs { flex:0 0 auto; min-height:230px; }
  .screen.chat .kb { flex:1 1 auto; }
  .status { height:54px; display:flex; align-items:center; justify-content:space-between;
    padding:0 36px; font-weight:700; font-size:24px; }
  .status .sysicons { display:flex; align-items:center; gap:8px; font-size:20px; }
  .status .dot { letter-spacing:-2px; }
  .status .batt { width:30px; height:15px; border:2px solid ${C.ink}; border-radius:4px; position:relative; }
  .status .batt:after { content:''; position:absolute; inset:2px; right:8px; background:${C.ink}; border-radius:1px; }
  /* chat */
  .nav { display:flex; align-items:center; justify-content:space-between; padding:6px 28px 14px; }
  .nav .back { color:#0a7aff; font-size:40px; font-weight:500; }
  .nav .info { color:#0a7aff; font-size:30px; }
  .navc { text-align:center; display:flex; flex-direction:column; align-items:center; gap:6px; }
  .avatar { width:64px; height:64px; border-radius:50%; background:#C9C2B6; color:#fff; font-weight:700;
    font-size:26px; display:flex; align-items:center; justify-content:center; }
  .navname { font-weight:700; font-size:26px; }
  .day { text-align:center; color:${C.sub}; font-size:21px; margin:4px 0 18px; }
  .msgs { padding:0 26px; }
  .inbub { background:${C.incoming}; color:${C.ink}; font-size:27px; line-height:35px; padding:18px 22px;
    border-radius:24px; border-bottom-left-radius:8px; margin-bottom:12px; max-width:80%; }
  .inputrow { display:flex; align-items:center; gap:12px; padding:14px 26px 16px; }
  .inputfield { flex:1; border:2px solid ${C.line}; border-radius:26px; padding:14px 22px; color:${C.sub};
    font-size:25px; }
  .send { width:48px; height:48px; border-radius:50%; background:#D9D3C7; color:#fff; display:flex;
    align-items:center; justify-content:center; font-size:28px; }
  /* keyboard panel */
  .kb { background:${C.cream}; border-top:1px solid ${C.line}; padding:18px 22px 26px; }
  .kbhead { display:flex; align-items:center; justify-content:space-between; margin-bottom:14px; }
  .kbbiz { color:${C.sub}; font-size:23px; font-weight:600; }
  .kbactions { display:flex; align-items:center; gap:14px; }
  .redraft { color:${C.orange}; font-weight:700; font-size:23px; }
  .globe { font-size:24px; }
  .kbhint { color:${C.sub}; font-size:21px; margin-bottom:14px; }
  .rcard { background:${C.reply}; border:1.5px solid ${C.line}; border-radius:20px; padding:20px 22px;
    font-size:26px; line-height:34px; color:${C.ink}; margin-bottom:12px; }
  .rcard.first { border-color:${C.orange}; border-width:2.5px; }
  .insert { color:${C.orange}; font-weight:700; font-size:21px; margin-top:10px; }
  /* generic screens */
  .screenpad { padding:14px 34px 0; }
  .bigtitle { font-weight:800; font-size:52px; letter-spacing:-1px; margin:6px 0 22px; }
  .sectionlabel { color:${C.sub}; font-weight:700; font-size:21px; letter-spacing:1.5px; margin:18px 4px 12px; }
  .bookcard { background:#fff; border:1.5px solid ${C.line}; border-radius:22px; padding:22px 24px; margin-bottom:14px;
    box-shadow:0 4px 10px rgba(0,0,0,.04); }
  .bookcard.green { background:#E4F6EA; border-color:#BCE7CC; display:flex; align-items:center; gap:18px; }
  .bc-check { width:46px; height:46px; border-radius:50%; background:#22A35A; color:#fff; display:flex;
    align-items:center; justify-content:center; font-size:26px; font-weight:700; flex:none; }
  .bc-title { font-weight:700; font-size:28px; }
  .bc-sub { color:${C.sub}; font-size:24px; line-height:32px; }
  .bc-meta { font-size:25px; margin:4px 0 2px; }
  .bc-row { display:flex; align-items:center; justify-content:space-between; margin-bottom:4px; }
  .badge { font-size:20px; font-weight:700; padding:6px 16px; border-radius:999px; }
  .badge.blue { background:#E2ECFF; color:#2563EB; }
  .badge.green-b { background:#DDF3E5; color:#1E9E54; }
  /* brain */
  .braindesc { color:${C.sub}; font-size:25px; margin-bottom:22px; }
  .bcard { background:#fff; border:1.5px solid ${C.line}; border-radius:20px; padding:22px 24px; margin-bottom:16px; }
  .blabel { color:${C.sub}; font-weight:700; font-size:20px; letter-spacing:1.5px; margin-bottom:12px; }
  .bbig { font-weight:700; font-size:30px; line-height:38px; }
  .prow { display:flex; justify-content:space-between; align-items:center; font-size:28px; padding:11px 0;
    border-top:1px solid ${C.line}; }
  .prow:first-of-type { border-top:none; }
  .pval { color:${C.orange}; font-weight:700; }
  .bhours { font-size:29px; line-height:42px; }
  </style></head><body>
    <div class="shapes">${shapes(variant)}</div>
    <div class="eyebrow">${eyebrow}</div>
    <div class="headline">${l1}<br><span class="o">${l2}</span></div>
    <img class="mascot" style="top:${mascotTop}px" src="${mascot(mascotName)}">
    <div class="phone"><div class="screen ${phoneClass}">${screen}</div></div>
  </body></html>`;
}

const pages = [
  {
    file: '01-hero',
    variant: 0,
    eyebrow: 'REPLY IN YOUR VOICE',
    l1: 'Reply in your',
    l2: 'voice in seconds',
    mascotName: 'mascot_wave',
    mascotTop: 250,
    phoneClass: 'chat',
    screen: chatScreen({
      avatar: 'S',
      name: 'Sam',
      incoming: [
        'Hi! Do you do quotes? How much to repaint a 3-bed, and when could you start?',
      ],
      bizLabel: 'Coastal Painting',
      hint: 'Tap a reply to insert it.',
      replies: [
        'Yeah for sure! A 3-bed’s usually $3.5–4.5k. Could swing by Thurs to quote — what time suits?',
        'Happy to help — ballpark’s about $4k depending on prep. Free Saturday morning?',
        'Definitely do quotes! When’s good for a quick look this week?',
      ],
    }),
  },
  {
    file: '02-voice',
    variant: 1,
    eyebrow: 'YOUR VOICE',
    l1: 'Sounds exactly',
    l2: 'like you',
    mascotName: 'mascot_write',
    mascotTop: 235,
    phoneClass: 'chat',
    screen: chatScreen({
      avatar: 'J',
      name: 'Jordan',
      incoming: [
        'hey you round this wkend for a cut + colour? and roughly how much?',
      ],
      bizLabel: 'Bella Hair Studio',
      hint: 'Even the slang, casing &amp; emojis are yours.',
      replies: [
        'heya! yep got sat arvo free ✂️ cut + colour’s around $180. want me to lock you in?',
        'omg yes would love to! sat or sun works. it’s $180ish depending on length x',
        'hey lovely! free this wknd — $180 for both. what time suits you?',
      ],
    }),
  },
  {
    file: '03-anyone',
    variant: 2,
    eyebrow: 'FOR ANYONE',
    l1: 'Work, side gigs',
    l2: 'or the group chat',
    mascotName: 'mascot_thumbsup',
    mascotTop: 250,
    phoneClass: 'chat',
    screen: chatScreen({
      avatar: 'FL',
      name: 'Footy Lads',
      incoming: [
        'oi you free sat arvo for a hit + bbq after? bringing the fam?',
      ],
      bizLabel: 'WhatsApp',
      hint: 'Works for clients, side gigs — or just mates.',
      replies: [
        'yeah I’m keen! sat arvo works 🍺 I’ll bring the snags — what time?',
        'count me in 🔥 sat’s good, fam’s coming too. what do you need me to grab?',
        'for sure mate, locked in for sat — text me the addy?',
      ],
    }),
  },
  {
    file: '04-booking',
    variant: 3,
    eyebrow: 'BOOKED',
    l1: 'Agree a time —',
    l2: 'Flynn books it',
    mascotName: 'mascot_phone',
    mascotTop: 232,
    screen: bookingsScreen(),
  },
  {
    file: '05-brain',
    variant: 4,
    eyebrow: 'BUSINESS BRAIN',
    l1: 'Knows your prices,',
    l2: 'hours &amp; services',
    mascotName: 'mascot_thinking',
    mascotTop: 232,
    screen: brainScreen(),
  },
];

if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
for (const p of pages) {
  fs.writeFileSync(path.join(OUT, `${p.file}.html`), page(p));
  console.log('wrote', `${p.file}.html`);
}
