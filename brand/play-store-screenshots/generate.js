/*
 * Generates Google Play phone screenshots for Flynn — mirrors the Apple App
 * Store set (../app-store-screenshots/generate.js) at 1080x1920 (Play-
 * compliant 9:16), same real device frame (../phone-mock/iphoneFrame.js),
 * same content, same big-phone / natural-bleed / stacked-pill treatment.
 * Android is currently parked (Swift-only pivot) but kept in sync in case
 * the listing is revived.
 *
 * Run:  node generate.js   (writes ./html/*.html)
 * Then the sibling render.sh screenshots each with Chrome.
 */
const fs = require('fs');
const path = require('path');
const { iphoneFrame } = require('../phone-mock/iphoneFrame.js');

const OUT = path.join(__dirname, 'html');

const C = {
  cream: '#F4E6CE',
  card: '#FFFBF4',
  ink: '#2C2018',
  orange: '#FB5B1E',
  mustard: '#E8A93B',
  teal: '#3BA8A8',
  terra: '#B85C38',
  olive: '#7A8C3A',
  line: '#E7E0D3',
  sub: '#9A8E7C',
};

function shapes(variant) {
  const sets = [
    `<div class="sh" style="width:201px;height:201px;border-radius:50%;background:${C.teal};top:-75px;left:-59px"></div>
     <div class="sh" style="width:134px;height:134px;border-radius:50%;background:${C.mustard};bottom:50px;right:-50px"></div>
     <div class="sh" style="width:100px;height:100px;border-radius:50%;background:${C.terra};bottom:-33px;left:75px"></div>`,
    `<div class="sh" style="width:167px;height:167px;border-radius:50%;background:${C.teal};top:-59px;right:-50px"></div>
     <div class="sh" style="width:100px;height:100px;border-radius:50%;background:${C.orange};bottom:100px;left:-42px"></div>
     <div class="sh" style="width:167px;height:167px;border-radius:50%;background:${C.mustard};bottom:-75px;right:50px"></div>`,
    `<div class="sh" style="width:126px;height:126px;border-radius:50%;background:${C.terra};top:-42px;left:-33px"></div>
     <div class="sh" style="width:193px;height:193px;border-radius:50%;background:${C.teal};top:-67px;right:-67px"></div>
     <div class="sh" style="width:109px;height:109px;border-radius:50%;background:${C.orange};bottom:25px;left:-33px"></div>
     <div class="sh" style="width:142px;height:142px;border-radius:50%;background:${C.olive};bottom:-50px;right:33px"></div>`,
    `<div class="sh" style="width:151px;height:151px;border-radius:50%;background:${C.mustard};top:-59px;right:-42px"></div>
     <div class="sh" style="width:109px;height:109px;border-radius:50%;background:${C.terra};bottom:-42px;right:-25px"></div>`,
    `<div class="sh" style="width:126px;height:126px;border-radius:50%;background:${C.orange};bottom:33px;left:-42px"></div>
     <div class="sh" style="width:176px;height:176px;border-radius:50%;background:${C.mustard};bottom:-67px;right:-50px"></div>
     <div class="sh" style="width:126px;height:126px;border-radius:50%;background:${C.teal};top:-50px;right:50px"></div>`,
  ];
  return sets[variant];
}

// Time/signal/battery row. The chassis SVG draws the dynamic island ON TOP of
// this (it's a sibling painted after the screen content), so this can just
// flow full-bleed underneath it like a real iOS status bar does.
const statusBar = (variant = 'dark') => `
  <div class="status ${variant}">
    <span class="time">9:41</span>
    <span class="sysicons">
      <span class="signal">ıll</span>
      <span class="wifi">ᯤ</span>
      <span class="batt"></span>
    </span>
  </div>`;

function lockScreen({ note }) {
  return `
    ${statusBar('light')}
    <div class="callbar"><span class="dot"></span>Flynn is on the call · 0:24</div>
    <div class="lockdate">Thursday, 12 June</div>
    <div class="locktime">9:41</div>
    <div class="notif">
      <div class="notif-icon">F<span class="notif-dot"></span></div>
      <div class="notif-body">
        <div class="notif-top"><span class="notif-app">Flynn</span><span class="notif-time">now</span></div>
        <div class="notif-msg">${note}</div>
      </div>
    </div>
    <div class="notif2">
      <div class="notif2-icon">✓</div>
      <div class="notif2-body">
        <div class="notif2-title">Deck repaint — booked</div>
        <div class="notif2-sub">Thu 12 Jun · 2:00 PM · 14 Marine Pde</div>
      </div>
    </div>`;
}

function chatScreen({ avatar, name, bubbles }) {
  const renderedBubbles = bubbles
    .map((b) => {
      if (b.type === 'photo') {
        return `
          <div class="photo-grid">
            <div class="photo-box" style="background-image:url(data:image/jpeg;base64,${before})"><span>Before</span></div>
            <div class="photo-box" style="background-image:url(data:image/jpeg;base64,${after})"><span>After</span></div>
          </div>`;
      }
      return `<div class="bubble ${b.out ? 'out' : 'in'}">${b.text}</div>`;
    })
    .join('');
  return `
    ${statusBar('dark')}
    <div class="nav">
      <span class="back">‹</span>
      <div class="navc">
        <div class="avatar">${avatar}</div>
        <div class="navname">${name}</div>
      </div>
      <span class="info">ⓘ</span>
    </div>
    <div class="day">Today 9:41 AM</div>
    <div class="msgs">${renderedBubbles}</div>`;
}

function bookingsScreen() {
  return `
    ${statusBar('dark')}
    <div class="screenpad">
      <div class="bigtitle">Bookings</div>
      <div class="sectionlabel">UPCOMING</div>
      <div class="bookcard green">
        <div class="bc-check">✓</div>
        <div>
          <div class="bc-title">Booked on the call</div>
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
      <div class="bookcard">
        <div class="bc-row"><span class="bc-title">Anthony · Reef St Cafe</span><span class="badge blue">Booked</span></div>
        <div class="bc-sub">Shopfront repaint — quote</div>
        <div class="bc-meta">Mon 16 Jun · 7:30 AM</div>
        <div class="bc-sub">Ocean Grove</div>
      </div>
      <div class="sectionlabel">PAST</div>
      <div class="bookcard">
        <div class="bc-row"><span class="bc-title">Mike</span><span class="badge green-b">Done</span></div>
        <div class="bc-sub">Fence repair — done</div>
        <div class="bc-meta">Completed · 6 Jun</div>
      </div>
      <div class="bookcard">
        <div class="bc-row"><span class="bc-title">Coastal Rentals</span><span class="badge green-b">Done</span></div>
        <div class="bc-sub">Handrail repaint — done</div>
        <div class="bc-meta">Completed · 3 Jun</div>
      </div>
    </div>`;
}

// Big phone, deliberately bled off the true canvas bottom edge (not an
// internal crop line — the page boundary itself clips it, same as how the
// device's own rounded corners would just continue unseen past the edge).
// That reads as an intentional, Apple-marketing-style crop instead of the
// "chopped mid-content" look a fake crop window gave.
const PHONE_W = 780;
const PHONE_LEFT = (1080 - PHONE_W) / 2;
const PHONE_TOP = 640;
const STATS_TOP = 470;

const before = fs.readFileSync(path.join(__dirname, '../../flynn-ai-new-landingpage/public/before.jpg')).toString('base64');
const after = fs.readFileSync(path.join(__dirname, '../../flynn-ai-new-landingpage/public/after.jpg')).toString('base64');

const SHARED_CSS = `
  * { margin:0; padding:0; box-sizing:border-box; -webkit-font-smoothing:antialiased; }
  html,body { width:1080px; height:1920px; }
  body { position:relative; overflow:hidden; background:${C.cream};
    font-family:-apple-system,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif; color:${C.ink}; }
  .shapes { position:absolute; inset:0; z-index:0; }
  .sh { position:absolute; border:7px solid ${C.ink}; box-sizing:border-box; }
  .wordmark { position:absolute; top:94px; left:109px; z-index:5; display:flex; align-items:flex-start; gap:5px; }
  .wordmark .txt { font-weight:800; font-size:33px; letter-spacing:1px; color:${C.ink}; }
  .wordmark .dot { width:12px; height:12px; border-radius:50%; background:${C.orange}; margin-top:3px; }
  .eyebrow { position:absolute; top:167px; left:109px; z-index:5; color:${C.orange};
    font-weight:800; font-size:28px; letter-spacing:3px; }
  .headline { position:absolute; top:224px; left:105px; z-index:5; font-weight:800;
    font-size:84px; line-height:89px; letter-spacing:-2px; }
  .headline .o { color:${C.orange}; }

  .stat-row { position:absolute; left:109px; right:109px; z-index:5; display:flex; flex-direction:column;
    gap:15px; align-items:center; }
  .stat-pill { background:${C.card}; border:3px solid ${C.ink}; border-radius:836px; padding:18px 28px;
    font-weight:800; font-size:28px; display:flex; align-items:center; gap:12px; white-space:nowrap;
    box-shadow:5px 5px 0 0 ${C.ink}; }

  /* screen content — all percentages are of the SCREEN box, not the phone */
  .status { position:absolute; top:2.6%; left:8%; right:8%; display:flex; align-items:center;
    justify-content:space-between; font-weight:700; font-size:25px; z-index:3; }
  .status.dark { color:${C.ink}; }
  .status.light { color:#fff; }
  .status .sysicons { display:flex; align-items:center; gap:10px; font-size:20px; font-family:sans-serif; }
  .status .batt { width:30px; height:15px; border:3px solid currentColor; border-radius:4px; position:relative; opacity:.95; }
  .status .batt:after { content:''; position:absolute; inset:2px; right:8px; background:currentColor; border-radius:1px; }

  .lockbg { position:absolute; inset:0; background:
    radial-gradient(120% 90% at 15% 0%, #ffb27a 0%, transparent 55%),
    radial-gradient(120% 100% at 85% 100%, ${C.teal} 0%, transparent 60%),
    linear-gradient(160deg, #2b2320 0%, #171310 60%, #0d0b09 100%); }
  .callbar { position:absolute; top:9%; left:8%; right:8%; z-index:3; background:#2FBD5A;
    border-radius:15px; padding:16px 18px; display:flex; align-items:center; justify-content:center;
    gap:10px; color:#fff; font-weight:700; font-size:24px; box-shadow:0 7px 17px -5px rgba(0,0,0,.35); }
  .callbar .dot { width:10px; height:10px; border-radius:50%; background:#fff; opacity:.92; }
  .lockdate { position:absolute; top:14.8%; left:0; right:0; text-align:center; z-index:3;
    color:rgba(255,255,255,.85); font-weight:600; font-size:28px; }
  .locktime { position:absolute; top:18%; left:0; right:0; text-align:center; z-index:3;
    color:#fff; font-weight:700; font-size:127px; letter-spacing:-2px; text-shadow:0 2px 20px rgba(0,0,0,.25); }
  .notif { position:absolute; left:6%; right:6%; top:35%; z-index:3; background:rgba(42,38,34,.82);
    border-radius:28px; padding:27px 25px; display:flex; gap:18px; align-items:flex-start;
    border:1px solid rgba(255,255,255,.16); }
  .notif-icon { width:64px; height:64px; border-radius:18px; background:${C.ink}; flex:none;
    display:flex; align-items:center; justify-content:center; color:#f5ebe0; font-weight:800;
    font-size:32px; position:relative; }
  .notif-dot { position:absolute; top:8px; right:11px; width:8px; height:8px; border-radius:50%; background:${C.orange}; }
  .notif-body { flex:1; }
  .notif-top { display:flex; justify-content:space-between; align-items:baseline; margin-bottom:8px; }
  .notif-app { color:#fff; font-weight:700; font-size:27px; letter-spacing:.2px; }
  .notif-time { color:rgba(255,255,255,.58); font-size:21px; }
  .notif-msg { color:rgba(255,255,255,.97); font-size:35px; line-height:45px; font-weight:500; }
  .notif-msg b { font-weight:700; }
  .notif2 { position:absolute; left:6%; right:6%; top:57%; z-index:3; background:rgba(255,255,255,.97);
    border-radius:27px; padding:25px 27px; display:flex; gap:17px; align-items:center; }
  .notif2-icon { width:54px; height:54px; border-radius:50%; background:#22A35A; color:#fff; flex:none;
    display:flex; align-items:center; justify-content:center; font-size:27px; font-weight:800; }
  .notif2-title { color:${C.ink}; font-weight:800; font-size:27px; margin-bottom:4px; }
  .notif2-sub { color:${C.sub}; font-size:22px; font-weight:600; }

  .nav { position:absolute; top:8.6%; left:0; right:0; display:flex; align-items:center;
    justify-content:space-between; padding:0 7% 20px; background:#fff; border-bottom:1px solid ${C.line}; z-index:3; }
  .nav .back { color:#0a7aff; font-size:39px; font-weight:500; }
  .nav .info { color:#0a7aff; font-size:28px; }
  .navc { text-align:center; display:flex; flex-direction:column; align-items:center; gap:6px; padding-top:13px; }
  .avatar { width:60px; height:60px; border-radius:50%; background:${C.orange}; color:#fff; font-weight:700;
    font-size:25px; display:flex; align-items:center; justify-content:center; }
  .navname { font-weight:700; font-size:28px; }
  .day { position:absolute; top:20%; left:0; right:0; text-align:center; color:${C.sub}; font-size:25px; z-index:2; }
  .msgs { position:absolute; top:23.5%; left:0; right:0; padding:0 5% 33px; z-index:2; }
  .bubble { font-size:35px; line-height:45px; padding:20px 25px; border-radius:27px; margin-bottom:23px; max-width:85%; word-wrap:break-word; font-weight:500; background:#fff; }
  .bubble.in { background:#ECE7DD; color:#141416; border-bottom-left-radius:7px; }
  .bubble.out { background:#007AFF; color:#FFFFFF; border-bottom-right-radius:7px; margin-left:auto; }
  .photo-grid { display:flex; gap:12px; margin-bottom:23px; justify-content:flex-end; }
  .photo-box { width:209px; height:209px; border-radius:18px; border:3px solid #2C2018; background-size:cover;
    background-position:center; position:relative; overflow:hidden; box-shadow:0 5px 12px rgba(0,0,0,.15); }
  .photo-box span { position:absolute; bottom:12px; left:12px; font-weight:700; font-size:18px; color:white;
    text-shadow:0 2px 5px rgba(0,0,0,.7); background:rgba(0,0,0,.35); padding:3px 10px; border-radius:7px; }

  .screenpad { position:absolute; top:9%; left:0; right:0; bottom:0; padding:0 7%; z-index:2; }
  .bigtitle { font-weight:800; font-size:57px; letter-spacing:-1px; margin:7px 0 23px; }
  .sectionlabel { color:${C.sub}; font-weight:700; font-size:22px; letter-spacing:1px; margin:20px 3px 13px; }
  .bookcard { background:#fff; border:1px solid ${C.line}; border-radius:20px; padding:23px 25px; margin-bottom:15px;
    box-shadow:0 3px 8px rgba(0,0,0,.04); }
  .bookcard.green { background:#E4F6EA; border-color:#BCE7CC; display:flex; align-items:center; gap:17px; }
  .bc-check { width:44px; height:44px; border-radius:50%; background:#22A35A; color:#fff; display:flex;
    align-items:center; justify-content:center; font-size:25px; font-weight:700; flex:none; }
  .bc-title { font-weight:700; font-size:33px; }
  .bc-sub { color:${C.sub}; font-size:28px; line-height:35px; }
  .bc-meta { font-size:29px; margin:5px 0 3px; }
  .bc-row { display:flex; align-items:center; justify-content:space-between; margin-bottom:4px; }
  .badge { font-size:23px; font-weight:700; padding:7px 15px; border-radius:836px; }
  .badge.blue { background:#E2ECFF; color:#2563EB; }
  .badge.green-b { background:#DDF3E5; color:#1E9E54; }
`;

function page({ variant, eyebrow, l1, l2, screenHtml, screenBg = '#fff', stats = [] }) {
  const frame = iphoneFrame({ left: PHONE_LEFT, top: PHONE_TOP, width: PHONE_W, contentHtml: screenHtml, screenBg });
  const statsRow = stats.length
    ? `<div class="stat-row" style="top:${STATS_TOP}px">${stats.map((s) => `<div class="stat-pill">${s}</div>`).join('')}</div>`
    : '';

  return `<!doctype html><html><head><meta charset="utf-8"><style>${SHARED_CSS}</style></head><body>
    <div class="shapes">${shapes(variant)}</div>
    <div class="wordmark"><span class="txt">FLYNN</span><span class="dot"></span></div>
    <div class="eyebrow">${eyebrow}</div>
    <div class="headline">${l1}<br><span class="o">${l2}</span></div>
    ${statsRow}
    ${frame.html}
  </body></html>`;
}

const pages = [
  {
    file: '01-hero',
    variant: 0,
    eyebrow: 'NEVER MISS A JOB',
    l1: 'Flynn answers',
    l2: 'when you can’t',
    stats: ['🎙️ Sounds like a real person', '✅ Books the job on the call'],
    screenBg: 'linear-gradient(160deg,#2b2320 0%,#171310 60%,#0d0b09 100%)',
    screenHtml: lockScreen({
      note: 'Booked the caller in for <b>Thursday 2pm</b> — deck repaint, 14 Marine Pde.',
    }),
  },
  {
    file: '02-voice',
    variant: 1,
    eyebrow: 'BOOKED ON THE CALL',
    l1: 'Books the job,',
    l2: 'confirms with you',
    screenHtml: chatScreen({
      avatar: 'F',
      name: 'Flynn',
      bubbles: [
        { out: false, text: "Just answered a call from 0412 345 678 — booked them in." },
        { out: false, text: "Thursday 2pm, deck repaint, 14 Marine Pde. Sound right?" },
        { out: true, text: "yep all good" },
        { out: false, text: "Added to your calendar and texted them a confirmation." },
      ],
    }),
  },
  {
    file: '03-anyone',
    variant: 2,
    eyebrow: 'PHOTO INVOICES',
    l1: 'Invoices with',
    l2: 'photos on them',
    screenHtml: chatScreen({
      avatar: 'F',
      name: 'Flynn',
      bubbles: [
        { out: true, type: 'photo' },
        { out: true, text: 'invoice Sarah $650 for the deck repaint' },
        { out: false, text: 'Invoice ready with photos. Sent to sarah@jenkins.com. View: flynnai.app/i/abc' },
        { out: false, text: 'Sarah just viewed the invoice.' },
      ],
    }),
  },
  {
    file: '04-booking',
    variant: 3,
    eyebrow: 'AUTO-CHASING',
    l1: 'Chases it',
    l2: 'till it’s paid',
    screenHtml: chatScreen({
      avatar: 'F',
      name: 'Flynn',
      bubbles: [
        { out: true, text: 'invoice Dave $340' },
        { out: false, text: 'Sent to Dave.' },
        { out: false, text: "Heads up — Dave's invoice is 3 days late. I've sent a friendly reminder." },
        { out: false, text: 'Dave just paid $340 via bank transfer.' },
        { out: true, text: 'awesome thanks' },
      ],
    }),
  },
  {
    file: '05-brain',
    variant: 4,
    eyebrow: 'ALL SORTED',
    l1: 'Every job,',
    l2: 'booked & tracked',
    stats: ['📅 Every job in one place', '✓ Booked straight off the call'],
    screenHtml: bookingsScreen(),
  },
];

if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
for (const p of pages) {
  fs.writeFileSync(path.join(OUT, `${p.file}.html`), page(p));
  console.log('wrote', `${p.file}.html`);
}
