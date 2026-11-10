/*
 * Generates Instagram feed images (1080x1350, 4:5) natively — NOT a crop of
 * the tall App Store screenshots. A 4:5 frame can only ever show ~1612px of
 * a 1290-wide source before the aspect ratio forces a cut, which was slicing
 * straight through the phone's chat bubbles / lock-screen notification on
 * screens 02-04 and hiding the notification entirely on 01. Rendering the
 * same components at their own compact canvas — phone scaled to 0.7x with
 * every fixed px in its content CSS scaled the same amount (percentage-based
 * positions need no change) — keeps line-wrapping identical to the App Store
 * versions while guaranteeing the important content actually fits on-canvas.
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
    `<div class="sh" style="width:105px;height:105px;border-radius:50%;background:${C.teal};top:-60px;left:-60px"></div>
     <div class="sh" style="width:100px;height:100px;border-radius:50%;background:${C.mustard};bottom:30px;right:-35px"></div>`,
    `<div class="sh" style="width:130px;height:130px;border-radius:50%;background:${C.teal};top:-45px;right:-40px"></div>
     <div class="sh" style="width:80px;height:80px;border-radius:50%;background:${C.orange};bottom:70px;left:-30px"></div>`,
    `<div class="sh" style="width:95px;height:95px;border-radius:50%;background:${C.terra};top:-30px;left:-25px"></div>
     <div class="sh" style="width:145px;height:145px;border-radius:50%;background:${C.teal};top:-50px;right:-50px"></div>`,
    `<div class="sh" style="width:115px;height:115px;border-radius:50%;background:${C.mustard};top:-45px;right:-30px"></div>
     <div class="sh" style="width:85px;height:85px;border-radius:50%;background:${C.terra};bottom:-30px;right:-20px"></div>`,
    `<div class="sh" style="width:95px;height:95px;border-radius:50%;background:${C.orange};bottom:25px;left:-30px"></div>
     <div class="sh" style="width:130px;height:130px;border-radius:50%;background:${C.teal};top:-40px;right:40px"></div>`,
  ];
  return sets[variant];
}

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
    </div>`;
}

// Everything below is the App Store CSS with every fixed px value in the
// phone-content classes scaled by K=0.7 (percentage-based top/left positions
// are untouched — they're already relative to the screen box). Header
// classes (wordmark/eyebrow/headline) are sized bespoke for the 1080x1350
// canvas, not scaled from the App Store version.
const PHONE_W = 900;
const PHONE_LEFT = (1080 - PHONE_W) / 2;
const PHONE_TOP = 332;

const before = fs.readFileSync(path.join(__dirname, '../../flynn-ai-new-landingpage/public/before.jpg')).toString('base64');
const after = fs.readFileSync(path.join(__dirname, '../../flynn-ai-new-landingpage/public/after.jpg')).toString('base64');

const SHARED_CSS = `
  * { margin:0; padding:0; box-sizing:border-box; -webkit-font-smoothing:antialiased; }
  html,body { width:1080px; height:1350px; }
  body { position:relative; overflow:hidden; background:${C.cream};
    font-family:-apple-system,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif; color:${C.ink}; }
  .shapes { position:absolute; inset:0; z-index:0; }
  .sh { position:absolute; border:6px solid ${C.ink}; box-sizing:border-box; }
  .wordmark { position:absolute; top:32px; left:64px; z-index:5; display:flex; align-items:flex-start; gap:6px; }
  .wordmark .txt { font-weight:800; font-size:40px; letter-spacing:1px; color:${C.ink}; }
  .wordmark .dot { width:14px; height:14px; border-radius:50%; background:${C.orange}; margin-top:4px; }
  .eyebrow { position:absolute; top:86px; left:64px; z-index:5; color:${C.orange};
    font-weight:800; font-size:30px; letter-spacing:3px; }
  .headline { position:absolute; top:130px; left:60px; z-index:5; font-weight:800;
    font-size:80px; line-height:86px; letter-spacing:-1.6px; }
  .headline .o { color:${C.orange}; }

  /* screen content — all percentages are of the SCREEN box, not the phone */
  .status { position:absolute; top:2.6%; left:8%; right:8%; display:flex; align-items:center;
    justify-content:space-between; font-weight:700; font-size:32px; z-index:3; }
  .status.dark { color:${C.ink}; }
  .status.light { color:#fff; }
  .status .sysicons { display:flex; align-items:center; gap:11px; font-size:26px; font-family:sans-serif; }
  .status .batt { width:36px; height:19px; border:2.5px solid currentColor; border-radius:5px; position:relative; opacity:.95; }
  .status .batt:after { content:''; position:absolute; inset:2px; right:8px; background:currentColor; border-radius:1.5px; }

  .lockbg { position:absolute; inset:0; background:
    radial-gradient(120% 90% at 15% 0%, #ffb27a 0%, transparent 55%),
    radial-gradient(120% 100% at 85% 100%, ${C.teal} 0%, transparent 60%),
    linear-gradient(160deg, #2b2320 0%, #171310 60%, #0d0b09 100%); }
  .callbar { position:absolute; top:7%; left:8%; right:8%; z-index:3; background:#2FBD5A;
    border-radius:14px; padding:14px 17px; display:flex; align-items:center; justify-content:center;
    gap:9px; color:#fff; font-weight:700; font-size:22px; box-shadow:0 6px 14px -4px rgba(0,0,0,.35); }
  .callbar .dot { width:9px; height:9px; border-radius:50%; background:#fff; opacity:.92; }
  .lockdate { position:absolute; top:12.8%; left:0; right:0; text-align:center; z-index:3;
    color:rgba(255,255,255,.85); font-weight:600; font-size:26px; }
  .locktime { position:absolute; top:16%; left:0; right:0; text-align:center; z-index:3;
    color:#fff; font-weight:700; font-size:114px; letter-spacing:-1.5px; text-shadow:0 2px 17px rgba(0,0,0,.25); }
  .notif { position:absolute; left:6%; right:6%; top:26%; z-index:3; background:rgba(42,38,34,.82);
    border-radius:26px; padding:24px 23px; display:flex; gap:17px; align-items:flex-start;
    border:1px solid rgba(255,255,255,.16); }
  .notif-icon { width:57px; height:57px; border-radius:16px; background:${C.ink}; flex:none;
    display:flex; align-items:center; justify-content:center; color:#f5ebe0; font-weight:800;
    font-size:29px; position:relative; }
  .notif-dot { position:absolute; top:8px; right:10px; width:8px; height:8px; border-radius:50%; background:${C.orange}; }
  .notif-body { flex:1; }
  .notif-top { display:flex; justify-content:space-between; align-items:baseline; margin-bottom:8px; }
  .notif-app { color:#fff; font-weight:700; font-size:24px; letter-spacing:.2px; }
  .notif-time { color:rgba(255,255,255,.58); font-size:19px; }
  .notif-msg { color:rgba(255,255,255,.97); font-size:32px; line-height:41px; font-weight:500; }
  .notif-msg b { font-weight:700; }
  .notif2 { position:absolute; left:6%; right:6%; top:42%; z-index:3; background:rgba(255,255,255,.97);
    border-radius:24px; padding:23px 24px; display:flex; gap:15px; align-items:center; }
  .notif2-icon { width:48px; height:48px; border-radius:50%; background:#22A35A; color:#fff; flex:none;
    display:flex; align-items:center; justify-content:center; font-size:24px; font-weight:800; }
  .notif2-title { color:${C.ink}; font-weight:800; font-size:24px; margin-bottom:4px; }
  .notif2-sub { color:${C.sub}; font-size:20px; font-weight:600; }

  .nav { position:absolute; top:6.8%; left:0; right:0; display:flex; align-items:center;
    justify-content:space-between; padding:0 7% 18px; background:#fff; border-bottom:1px solid ${C.line}; z-index:3; }
  .nav .back { color:#0a7aff; font-size:35px; font-weight:500; }
  .nav .info { color:#0a7aff; font-size:26px; }
  .navc { text-align:center; display:flex; flex-direction:column; align-items:center; gap:5px; padding-top:12px; }
  .avatar { width:54px; height:54px; border-radius:50%; background:${C.orange}; color:#fff; font-weight:700;
    font-size:23px; display:flex; align-items:center; justify-content:center; }
  .navname { font-weight:700; font-size:26px; }
  .day { position:absolute; top:18.2%; left:0; right:0; text-align:center; color:${C.sub}; font-size:23px; z-index:2; }
  .msgs { position:absolute; top:21.7%; left:0; right:0; padding:0 5% 30px; z-index:2; }
  .bubble { font-size:32px; line-height:41px; padding:18px 23px; border-radius:24px; margin-bottom:21px; max-width:85%; word-wrap:break-word; font-weight:500; background:#fff; }
  .bubble.in { background:#ECE7DD; color:#141416; border-bottom-left-radius:6px; }
  .bubble.out { background:#007AFF; color:#FFFFFF; border-bottom-right-radius:6px; margin-left:auto; }
  .photo-grid { display:flex; gap:11px; margin-bottom:21px; justify-content:flex-end; }
  .photo-box { width:188px; height:188px; border-radius:17px; border:2px solid #2C2018; background-size:cover;
    background-position:center; position:relative; overflow:hidden; box-shadow:0 4px 10px rgba(0,0,0,.15); }
  .photo-box span { position:absolute; bottom:11px; left:11px; font-weight:700; font-size:17px; color:white;
    text-shadow:0 2px 6px rgba(0,0,0,.7); background:rgba(0,0,0,.35); padding:3px 9px; border-radius:6px; }

  .screenpad { position:absolute; top:7%; left:0; right:0; bottom:0; padding:0 7%; z-index:2; }
  .bigtitle { font-weight:800; font-size:51px; letter-spacing:-0.7px; margin:6px 0 21px; }
  .sectionlabel { color:${C.sub}; font-weight:700; font-size:20px; letter-spacing:1px; margin:18px 3px 12px; }
  .bookcard { background:#fff; border:1.5px solid ${C.line}; border-radius:18px; padding:21px 23px; margin-bottom:14px;
    box-shadow:0 3px 7px rgba(0,0,0,.04); }
  .bookcard.green { background:#E4F6EA; border-color:#BCE7CC; display:flex; align-items:center; gap:15px; }
  .bc-check { width:39px; height:39px; border-radius:50%; background:#22A35A; color:#fff; display:flex;
    align-items:center; justify-content:center; font-size:23px; font-weight:700; flex:none; }
  .bc-title { font-weight:700; font-size:29px; }
  .bc-sub { color:${C.sub}; font-size:25px; line-height:32px; }
  .bc-meta { font-size:26px; margin:5px 0 2px; }
  .bc-row { display:flex; align-items:center; justify-content:space-between; margin-bottom:4px; }
  .badge { font-size:20px; font-weight:700; padding:6px 14px; border-radius:999px; }
  .badge.blue { background:#E2ECFF; color:#2563EB; }
  .badge.green-b { background:#DDF3E5; color:#1E9E54; }
`;

function page({ variant, eyebrow, l1, l2, screenHtml, screenBg = '#fff' }) {
  const frame = iphoneFrame({ left: PHONE_LEFT, top: PHONE_TOP, width: PHONE_W, contentHtml: screenHtml, screenBg });

  return `<!doctype html><html><head><meta charset="utf-8"><style>${SHARED_CSS}</style></head><body>
    <div class="shapes">${shapes(variant)}</div>
    <div class="wordmark"><span class="txt">FLYNN</span><span class="dot"></span></div>
    <div class="eyebrow">${eyebrow}</div>
    <div class="headline">${l1}<br><span class="o">${l2}</span></div>
    ${frame.html}
  </body></html>`;
}

const pages = [
  {
    file: '01-hero-ig',
    variant: 0,
    eyebrow: 'NEVER MISS A JOB',
    l1: 'Flynn answers',
    l2: 'when you can’t',
    screenBg: 'linear-gradient(160deg,#2b2320 0%,#171310 60%,#0d0b09 100%)',
    screenHtml: lockScreen({
      note: 'Booked the caller in for <b>Thursday 2pm</b> — deck repaint, 14 Marine Pde.',
    }),
  },
  {
    file: '02-voice-ig',
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
    file: '03-anyone-ig',
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
        { out: false, text: 'Invoice ready with photos. Sent to sarah@jenkins.com.' },
      ],
    }),
  },
  {
    file: '04-booking-ig',
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
      ],
    }),
  },
  {
    file: '05-brain-ig',
    variant: 4,
    eyebrow: 'ALL SORTED',
    l1: 'Every job,',
    l2: 'booked & tracked',
    screenHtml: bookingsScreen(),
  },
];

if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
for (const p of pages) {
  fs.writeFileSync(path.join(OUT, `${p.file}.html`), page(p));
  console.log('wrote', `${p.file}.html`);
}
