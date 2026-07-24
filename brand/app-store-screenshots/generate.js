/*
 * Generates Apple App Store phone screenshots for Flynn — 2026 receptionist
 * positioning ("Flynn answers when you're on the tools"). Rendered by headless
 * Chrome at 1290x2796 (iPhone 6.7").
 *
 * Phone chassis: ../phone-mock/iphoneFrame.js — a real device frame traced
 * from Apple's proportions (via MagicUI's open-source `iphone` component),
 * not a hand-tuned CSS approximation. That's what fixed the "Frankenstein"
 * phone: wrong aspect ratio, a flat bar standing in for the dynamic island,
 * bezel touching the screen's rounded corner.
 *
 * Hero concept: a lock-screen notification, NOT a live in-call UI. Showing
 * "you're calling Flynn" was conceptually backwards — the caller rings the
 * TRADIE's number and Flynn answers it; the tradie sees the green "Flynn is
 * on the call" system bar (real iOS behaviour) plus Flynn's own notification
 * summarising what happened.
 *
 * The hero and bookings screens crop the phone short and use the canvas
 * space that frees up for a supporting stat row — a full device with empty
 * wallpaper/blank list space below the content wasted half the frame.
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
const PHONE_W = 1200;
const PHONE_LEFT = (1290 - PHONE_W) / 2;
const PHONE_TOP = 726;
const STATS_TOP = 500;

const before = fs.readFileSync(path.join(__dirname, '../../flynn-ai-new-landingpage/public/before.jpg')).toString('base64');
const after = fs.readFileSync(path.join(__dirname, '../../flynn-ai-new-landingpage/public/after.jpg')).toString('base64');

const SHARED_CSS = `
  * { margin:0; padding:0; box-sizing:border-box; -webkit-font-smoothing:antialiased; }
  html,body { width:1290px; height:2796px; }
  body { position:relative; overflow:hidden; background:${C.cream};
    font-family:-apple-system,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif; color:${C.ink}; }
  .shapes { position:absolute; inset:0; z-index:0; }
  .sh { position:absolute; border:8px solid ${C.ink}; box-sizing:border-box; }
  .wordmark { position:absolute; top:112px; left:130px; z-index:5; display:flex; align-items:flex-start; gap:6px; }
  .wordmark .txt { font-weight:800; font-size:40px; letter-spacing:1px; color:${C.ink}; }
  .wordmark .dot { width:14px; height:14px; border-radius:50%; background:${C.orange}; margin-top:4px; }
  .eyebrow { position:absolute; top:200px; left:130px; z-index:5; color:${C.orange};
    font-weight:800; font-size:34px; letter-spacing:4px; }
  .headline { position:absolute; top:268px; left:126px; z-index:5; font-weight:800;
    font-size:100px; line-height:106px; letter-spacing:-2px; }
  .headline .o { color:${C.orange}; }

  .stat-row { position:absolute; left:130px; right:130px; z-index:5; display:flex; flex-direction:column;
    gap:18px; align-items:center; }
  .stat-pill { background:${C.card}; border:3px solid ${C.ink}; border-radius:999px; padding:22px 34px;
    font-weight:800; font-size:34px; display:flex; align-items:center; gap:14px; white-space:nowrap;
    box-shadow:6px 6px 0 0 ${C.ink}; }

  /* screen content — all percentages are of the SCREEN box, not the phone */
  .status { position:absolute; top:2.6%; left:8%; right:8%; display:flex; align-items:center;
    justify-content:space-between; font-weight:700; font-size:30px; z-index:3; }
  .status.dark { color:${C.ink}; }
  .status.light { color:#fff; }
  .status .sysicons { display:flex; align-items:center; gap:12px; font-size:24px; font-family:sans-serif; }
  .status .batt { width:36px; height:18px; border:3px solid currentColor; border-radius:5px; position:relative; opacity:.95; }
  .status .batt:after { content:''; position:absolute; inset:2px; right:9px; background:currentColor; border-radius:1.5px; }

  .lockbg { position:absolute; inset:0; background:
    radial-gradient(120% 90% at 15% 0%, #ffb27a 0%, transparent 55%),
    radial-gradient(120% 100% at 85% 100%, ${C.teal} 0%, transparent 60%),
    linear-gradient(160deg, #2b2320 0%, #171310 60%, #0d0b09 100%); }
  .callbar { position:absolute; top:9%; left:8%; right:8%; z-index:3; background:#2FBD5A;
    border-radius:18px; padding:19px 22px; display:flex; align-items:center; justify-content:center;
    gap:12px; color:#fff; font-weight:700; font-size:29px; box-shadow:0 8px 20px -6px rgba(0,0,0,.35); }
  .callbar .dot { width:12px; height:12px; border-radius:50%; background:#fff; opacity:.92; }
  .lockdate { position:absolute; top:14.8%; left:0; right:0; text-align:center; z-index:3;
    color:rgba(255,255,255,.85); font-weight:600; font-size:34px; }
  .locktime { position:absolute; top:18%; left:0; right:0; text-align:center; z-index:3;
    color:#fff; font-weight:700; font-size:152px; letter-spacing:-2px; text-shadow:0 2px 24px rgba(0,0,0,.25); }
  .notif { position:absolute; left:6%; right:6%; top:35%; z-index:3; background:rgba(42,38,34,.82);
    border-radius:34px; padding:32px 30px; display:flex; gap:22px; align-items:flex-start;
    border:1px solid rgba(255,255,255,.16); }
  .notif-icon { width:76px; height:76px; border-radius:21px; background:${C.ink}; flex:none;
    display:flex; align-items:center; justify-content:center; color:#f5ebe0; font-weight:800;
    font-size:38px; position:relative; }
  .notif-dot { position:absolute; top:10px; right:13px; width:10px; height:10px; border-radius:50%; background:${C.orange}; }
  .notif-body { flex:1; }
  .notif-top { display:flex; justify-content:space-between; align-items:baseline; margin-bottom:10px; }
  .notif-app { color:#fff; font-weight:700; font-size:32px; letter-spacing:.2px; }
  .notif-time { color:rgba(255,255,255,.58); font-size:25px; }
  .notif-msg { color:rgba(255,255,255,.97); font-size:42px; line-height:54px; font-weight:500; }
  .notif-msg b { font-weight:700; }
  .notif2 { position:absolute; left:6%; right:6%; top:57%; z-index:3; background:rgba(255,255,255,.97);
    border-radius:32px; padding:30px 32px; display:flex; gap:20px; align-items:center; }
  .notif2-icon { width:64px; height:64px; border-radius:50%; background:#22A35A; color:#fff; flex:none;
    display:flex; align-items:center; justify-content:center; font-size:32px; font-weight:800; }
  .notif2-title { color:${C.ink}; font-weight:800; font-size:32px; margin-bottom:5px; }
  .notif2-sub { color:${C.sub}; font-size:26px; font-weight:600; }

  .nav { position:absolute; top:8.6%; left:0; right:0; display:flex; align-items:center;
    justify-content:space-between; padding:0 7% 24px; background:#fff; border-bottom:1px solid ${C.line}; z-index:3; }
  .nav .back { color:#0a7aff; font-size:46px; font-weight:500; }
  .nav .info { color:#0a7aff; font-size:34px; }
  .navc { text-align:center; display:flex; flex-direction:column; align-items:center; gap:7px; padding-top:16px; }
  .avatar { width:72px; height:72px; border-radius:50%; background:${C.orange}; color:#fff; font-weight:700;
    font-size:30px; display:flex; align-items:center; justify-content:center; }
  .navname { font-weight:700; font-size:34px; }
  .day { position:absolute; top:20%; left:0; right:0; text-align:center; color:${C.sub}; font-size:30px; z-index:2; }
  .msgs { position:absolute; top:23.5%; left:0; right:0; padding:0 5% 40px; z-index:2; }
  .bubble { font-size:42px; line-height:54px; padding:24px 30px; border-radius:32px; margin-bottom:28px; max-width:85%; word-wrap:break-word; font-weight:500; background:#fff; }
  .bubble.in { background:#ECE7DD; color:#141416; border-bottom-left-radius:8px; }
  .bubble.out { background:#007AFF; color:#FFFFFF; border-bottom-right-radius:8px; margin-left:auto; }
  .photo-grid { display:flex; gap:14px; margin-bottom:28px; justify-content:flex-end; }
  .photo-box { width:250px; height:250px; border-radius:22px; border:3px solid #2C2018; background-size:cover;
    background-position:center; position:relative; overflow:hidden; box-shadow:0 6px 14px rgba(0,0,0,.15); }
  .photo-box span { position:absolute; bottom:14px; left:14px; font-weight:700; font-size:22px; color:white;
    text-shadow:0 2px 6px rgba(0,0,0,.7); background:rgba(0,0,0,.35); padding:4px 12px; border-radius:8px; }

  .screenpad { position:absolute; top:9%; left:0; right:0; bottom:0; padding:0 7%; z-index:2; }
  .bigtitle { font-weight:800; font-size:68px; letter-spacing:-1px; margin:8px 0 28px; }
  .sectionlabel { color:${C.sub}; font-weight:700; font-size:26px; letter-spacing:1.5px; margin:24px 4px 16px; }
  .bookcard { background:#fff; border:1.5px solid ${C.line}; border-radius:24px; padding:28px 30px; margin-bottom:18px;
    box-shadow:0 4px 10px rgba(0,0,0,.04); }
  .bookcard.green { background:#E4F6EA; border-color:#BCE7CC; display:flex; align-items:center; gap:20px; }
  .bc-check { width:52px; height:52px; border-radius:50%; background:#22A35A; color:#fff; display:flex;
    align-items:center; justify-content:center; font-size:30px; font-weight:700; flex:none; }
  .bc-title { font-weight:700; font-size:39px; }
  .bc-sub { color:${C.sub}; font-size:33px; line-height:42px; }
  .bc-meta { font-size:35px; margin:6px 0 3px; }
  .bc-row { display:flex; align-items:center; justify-content:space-between; margin-bottom:5px; }
  .badge { font-size:27px; font-weight:700; padding:8px 18px; border-radius:999px; }
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
