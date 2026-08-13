/**
 * The public, branded booking page: GET /b/:slug
 *
 * Server-rendered by this Express app, deliberately. There is already a
 * separate Next.js booking app in `booking-pages/` deployed as its own Fly app,
 * but its `/api/*` rewrite targets `http://localhost:3000` (booking-pages/
 * next.config.js), which cannot resolve from a different machine — so in
 * production it can never load a slot. Rather than revive that, this mirrors
 * `routes/invoicePage.js`: one origin, no cross-app proxy, no second deploy,
 * a single self-contained HTML string with inline CSS.
 *
 * Design: this is the Flynn design system translated to the web — cream
 * ground, warm-brown dark mode, ink 3px outline on exactly one hero card (the
 * time picker), Space Grotesk display over Inter body, and one orange reserved
 * for the single action that matters. The customer sees the tradie's brand;
 * Flynn signs the footer ("Get this for your business") because the page is
 * also the growth artifact.
 *
 * Price disclosure is not decoration. Under Australian Consumer Law a call-out
 * fee has to be disclosed before the customer commits, so the fee and pricing
 * notes render above the form, not buried in a confirmation email.
 */

const express = require('express');
const { supabase } = require('../telephony/supabaseClient');
const analytics = require('./../services/analytics');
const {
  weekdayForCalendarDate,
  todayInZone,
  addDays,
  toDateString,
  zonedWallTimeToUtc,
} = require('../services/bookingPage');

const router = express.Router();

const FLYNN_MARKETING_URL = 'https://flynnai.app';
const OG_FALLBACK_IMAGE = 'https://flynnai.app/og-image.png';

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function money(cents) {
  if (cents === null || cents === undefined || Number.isNaN(Number(cents))) return null;
  const n = Number(cents) / 100;
  return `$${n % 1 === 0 ? n.toFixed(0) : n.toFixed(2)}`;
}

/** "Australia/Sydney" -> "Sydney". Good enough for a trust caption. */
function zoneCity(timeZone) {
  const part = String(timeZone || '').split('/').pop() || '';
  return part.replace(/_/g, ' ');
}

/** Tenant user id for analytics attribution; falls back to the org id. */
async function ownerDistinctId(orgId) {
  try {
    const { data } = await supabase
      .from('users')
      .select('id')
      .eq('default_org_id', orgId)
      .limit(1)
      .maybeSingle();
    return data?.id || orgId;
  } catch {
    return orgId;
  }
}

function notFoundPage() {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Booking page not found</title>
<style>
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f4e6ce;color:#2c2018;
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;padding:24px}
  @media (prefers-color-scheme:dark){body{background:#1c1611;color:#f7f0e4}}
  .b{text-align:center;max-width:380px}
  h1{font-size:20px;margin:0 0 8px}
  p{opacity:.75;margin:0;line-height:1.5}
</style></head><body><div class="b">
<h1>This booking link isn't active</h1>
<p>The link may have expired or been turned off. Try giving the business a call.</p>
</div></body></html>`;
}

/**
 * The next `count` bookable calendar dates, skipping days the business is
 * closed and anything past `max_days_advance`. Labels are pre-rendered in the
 * business's zone so the client never does timezone maths.
 */
function upcomingDates(page, count = 14) {
  const timeZone = page.timezone || 'Australia/Sydney';
  const hours = page.business_hours || {};
  const maxDays = Math.max(1, Number(page.max_days_advance ?? 60));
  const wk = new Intl.DateTimeFormat('en-AU', { timeZone, weekday: 'short' });
  const mo = new Intl.DateTimeFormat('en-AU', { timeZone, month: 'short' });
  const full = new Intl.DateTimeFormat('en-AU', { timeZone, weekday: 'long', day: 'numeric', month: 'long' });
  const out = [];
  let cal = todayInZone(timeZone);
  for (let offset = 0; offset < maxDays && out.length < count; offset += 1) {
    const day = hours[weekdayForCalendarDate(cal)];
    if (day && day.enabled) {
      const noonUtc = zonedWallTimeToUtc(cal.year, cal.month, cal.day, 12, 0, timeZone);
      out.push({
        value: toDateString(cal),
        label: full.format(noonUtc),
        weekdayShort: wk.format(noonUtc),
        dayNum: cal.day,
        monthShort: mo.format(noonUtc),
        isToday: offset === 0,
      });
    }
    cal = addDays(cal, 1);
  }
  return out;
}

function renderBookingPage(page, profile) {
  const businessName = page.business_name || profile?.public_name || profile?.business_name || 'Bookings';
  const initial = (businessName.trim()[0] || 'B').toUpperCase();
  const dates = upcomingDates(page);
  const calloutFee = money(profile?.callout_fee_cents);
  const pricingNotes = (profile?.pricing_notes || '').trim();
  const phone = (profile?.phone || '').trim();
  const serviceAreas = Array.isArray(profile?.service_areas)
    ? profile.service_areas.filter(Boolean).slice(0, 3).join(' · ')
    : (profile?.service_area || '');
  const timeZone = page.timezone || 'Australia/Sydney';
  const city = zoneCity(timeZone);
  const title = `Book with ${businessName}`;
  const description = calloutFee
    ? `Pick a time online. Call-out ${calloutFee}, firm price before any work starts.`
    : 'Pick a time online — takes about a minute.';
  const hasDisclosure = Boolean(calloutFee || pricingNotes);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="/b/${esc(page.slug)}/og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="robots" content="noindex">
<meta name="theme-color" content="#f4e6ce" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#1c1611" media="(prefers-color-scheme: dark)">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Space+Grotesk:wght@500;700&display=swap" rel="stylesheet">
<style>
  :root{
    --bg:#f4e6ce; --card:#fffbf4; --card-2:#faf3e3;
    --ink:#2c2018; --muted:#5a4a3c; --faint:#8a7a68;
    --line:#dccdb2; --outline:#2c2018;
    --brand:#fb5b1e; --brand-deep:#d94a12; --mustard:#e0a436; --teal:#3c8a86; --error:#c5532b;
    --on-brand:#fffbf4;
    --shadow:0 1px 2px rgba(44,32,24,.06),0 8px 24px rgba(44,32,24,.07);
  }
  @media (prefers-color-scheme:dark){
    :root{
      --bg:#1c1611; --card:#26201a; --card-2:#2e2720;
      --ink:#f7f0e4; --muted:#d6c9b6; --faint:#a4937e;
      --line:#3e352b; --outline:#f7f0e4;
      --shadow:0 1px 2px rgba(0,0,0,.25),0 8px 24px rgba(0,0,0,.28);
    }
  }
  *{box-sizing:border-box}
  html{scroll-behavior:smooth}
  @media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}*,*::before,*::after{animation:none!important;transition:none!important}}
  html,body{margin:0;background:var(--bg);color:var(--ink);
    font-family:"Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
    -webkit-font-smoothing:antialiased;font-size:16px;line-height:1.5}
  .wrap{max-width:560px;margin:0 auto;padding:28px 18px calc(48px + env(safe-area-inset-bottom))}
  .grotesk{font-family:"Space Grotesk","Inter",sans-serif}

  /* ---- header ---- */
  header{display:flex;align-items:center;gap:14px;margin-bottom:22px}
  .avatar{flex:none;width:56px;height:56px;border-radius:50%;background:var(--mustard);
    border:3px solid var(--outline);display:grid;place-items:center;
    font-family:"Space Grotesk",sans-serif;font-weight:700;font-size:24px;color:#2c2018}
  h1{font-family:"Space Grotesk",sans-serif;font-weight:700;font-size:26px;line-height:1.15;
    letter-spacing:-.015em;margin:0}
  .sub{color:var(--muted);margin:3px 0 0;font-size:14px}

  /* ---- cards: one hero, everything else quiet ---- */
  .card{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:20px;margin-top:14px}
  .card.hero{border:3px solid var(--outline);box-shadow:var(--shadow)}
  .card h2{font-family:"Space Grotesk",sans-serif;font-weight:700;font-size:17px;
    letter-spacing:-.01em;margin:0 0 4px}
  .card .hint{color:var(--faint);font-size:13px;margin:0 0 14px}

  /* ---- price disclosure ---- */
  .fee-row{display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin:10px 0 2px}
  .fee-row .amt{font-family:"Space Grotesk",sans-serif;font-weight:700;font-size:26px;letter-spacing:-.01em}
  .fine{color:var(--muted);font-size:13.5px;line-height:1.55;margin:8px 0 0;white-space:pre-wrap}
  .assure{display:flex;gap:8px;align-items:flex-start;margin-top:12px;padding-top:12px;border-top:1px dashed var(--line);
    color:var(--muted);font-size:13.5px}
  .assure .dot{flex:none;width:8px;height:8px;border-radius:50%;background:var(--teal);margin-top:6px}

  /* ---- day picker ---- */
  .days{display:flex;gap:8px;overflow-x:auto;padding:2px;margin:0 -2px 14px;scrollbar-width:none;-webkit-overflow-scrolling:touch}
  .days::-webkit-scrollbar{display:none}
  .day{flex:none;min-width:64px;padding:10px 8px 9px;border-radius:14px;border:1px solid var(--line);
    background:var(--card);color:var(--ink);cursor:pointer;text-align:center;font:inherit}
  .day .wd{display:block;font-size:11.5px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--faint)}
  .day .dn{display:block;font-family:"Space Grotesk",sans-serif;font-weight:700;font-size:20px;line-height:1.25}
  .day .mo{display:block;font-size:11px;color:var(--faint)}
  .day[aria-pressed="true"]{background:var(--ink);border-color:var(--ink);color:var(--bg)}
  .day[aria-pressed="true"] .wd,.day[aria-pressed="true"] .mo{color:var(--bg);opacity:.72}
  .day:focus-visible,.slot:focus-visible,.cta:focus-visible,input:focus-visible,textarea:focus-visible{
    outline:3px solid var(--brand);outline-offset:2px}

  /* ---- slots ---- */
  .tzline{color:var(--faint);font-size:12.5px;margin:0 0 10px}
  .slots{display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:9px}
  .slot{font-family:"Space Grotesk",sans-serif;font-weight:700;font-size:15px;padding:12px 6px;
    border-radius:12px;border:1px solid var(--line);background:var(--card);color:var(--ink);
    cursor:pointer;text-align:center;transition:transform .08s ease}
  .slot:active{transform:scale(.97)}
  .slot[aria-pressed="true"]{background:var(--brand);border-color:var(--outline);border-width:2px;
    padding:11px 5px;color:var(--on-brand)}
  .skeleton{border-radius:12px;height:45px;border:1px solid var(--line);
    background:linear-gradient(100deg,var(--card) 40%,var(--card-2) 50%,var(--card) 60%);
    background-size:200% 100%;animation:sh 1.2s linear infinite}
  @keyframes sh{to{background-position:-200% 0}}
  .empty{color:var(--muted);font-size:14.5px;margin:4px 0 0;padding:14px;border:1px dashed var(--line);
    border-radius:12px;text-align:center}

  /* ---- form ---- */
  label{display:block;font-size:13.5px;font-weight:600;margin:0 0 6px}
  label .opt{font-weight:400;color:var(--faint)}
  input,textarea{width:100%;font:inherit;font-size:16px;color:var(--ink);background:var(--card);
    border:1px solid var(--line);border-radius:12px;padding:13px 14px;appearance:none}
  input::placeholder,textarea::placeholder{color:var(--faint)}
  input:focus,textarea:focus{border-color:var(--ink);outline:none}
  textarea{min-height:84px;resize:vertical}
  .field+.field{margin-top:14px}
  .hp{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}

  /* ---- CTA: the one orange thing ---- */
  .ctabar{margin-top:20px}
  .cta{display:block;width:100%;font-family:"Space Grotesk",sans-serif;font-weight:700;font-size:17.5px;
    color:var(--on-brand);background:var(--brand);border:3px solid var(--outline);border-radius:999px;
    padding:16px 18px;cursor:pointer;box-shadow:4px 4px 0 var(--outline);
    transition:transform .08s ease,box-shadow .08s ease}
  .cta:not(:disabled):active{transform:translate(3px,3px);box-shadow:1px 1px 0 var(--outline)}
  .cta:disabled{opacity:.4;cursor:not-allowed;box-shadow:none}
  .cta .sub-when{display:block;font-family:"Inter",sans-serif;font-weight:500;font-size:12.5px;opacity:.85;margin-top:1px}
  .err{color:var(--error);font-weight:500;font-size:14px;margin:12px 2px 0;min-height:1em;text-align:center}

  /* ---- success ---- */
  .done{text-align:center;padding:30px 20px 24px}
  .done .tick{width:64px;height:64px;border-radius:50%;background:var(--brand);color:var(--on-brand);
    border:3px solid var(--outline);display:grid;place-items:center;margin:0 auto 16px;
    box-shadow:4px 4px 0 var(--outline)}
  .done .tick svg{width:30px;height:30px}
  .done h2{font-family:"Space Grotesk",sans-serif;font-weight:700;font-size:23px;margin:0 0 6px;letter-spacing:-.01em}
  .done .when{font-family:"Space Grotesk",sans-serif;font-weight:700;font-size:16px;color:var(--ink);
    background:var(--card-2);border:1px solid var(--line);border-radius:12px;display:inline-block;
    padding:9px 16px;margin:8px 0 4px}
  .done p{color:var(--muted);font-size:14.5px;line-height:1.55;margin:10px 0 0}
  .calbtns{display:flex;gap:10px;justify-content:center;margin-top:18px;flex-wrap:wrap}
  .calbtn{font:inherit;font-size:14px;font-weight:600;color:var(--ink);background:var(--card);
    border:1px solid var(--outline);border-radius:999px;padding:10px 16px;cursor:pointer;text-decoration:none}

  footer{text-align:center;margin-top:30px;color:var(--faint);font-size:13px;line-height:1.6}
  footer a{color:var(--muted);font-weight:600;text-decoration-color:var(--mustard);text-decoration-thickness:2px}
  [hidden]{display:none !important}
</style>
</head>
<body>
<div class="wrap">
  <header>
    <div class="avatar" aria-hidden="true">${esc(initial)}</div>
    <div>
      <h1>${esc(businessName)}</h1>
      <p class="sub">${serviceAreas ? esc(serviceAreas) : 'Book a time online'}</p>
    </div>
  </header>

  ${hasDisclosure ? `
  <section class="card" aria-label="Pricing">
    <h2>What it costs</h2>
    ${calloutFee ? `<div class="fee-row"><span>Call-out fee</span><span class="amt">${esc(calloutFee)}</span></div>` : ''}
    ${pricingNotes && pricingNotes.toLowerCase() !== 'callout fee' ? `<p class="fine">${esc(pricingNotes)}</p>` : ''}
    <div class="assure"><span class="dot"></span><span>You'll get a firm price before any work starts. Booking a time costs nothing.</span></div>
  </section>` : ''}

  <form id="form" novalidate>
    <section class="card hero" aria-label="Choose a time">
      <h2>Pick a time</h2>
      <p class="hint">Choose a day, then a start time.</p>
      <div id="days" class="days" role="group" aria-label="Day">
        ${dates.map((d, i) => `
        <button type="button" class="day" data-date="${esc(d.value)}" data-label="${esc(d.label)}" aria-pressed="${i === 0 ? 'true' : 'false'}">
          <span class="wd">${d.isToday ? 'Today' : esc(d.weekdayShort)}</span>
          <span class="dn">${d.dayNum}</span>
          <span class="mo">${esc(d.monthShort)}</span>
        </button>`).join('')}
      </div>
      <p class="tzline">Times are ${esc(city)} local time.</p>
      <div id="slots" class="slots" role="group" aria-label="Start time"></div>
      <p id="slotsEmpty" class="empty" hidden>Nothing left on that day — try the next one.</p>
      <p id="slotsError" class="empty" hidden>Couldn't load times. <button type="button" id="retry" class="calbtn" style="margin-left:6px">Try again</button></p>
    </section>

    <section class="card" aria-label="Your details">
      <h2>Your details</h2>
      <p class="hint">So ${esc(businessName)} knows who's coming.</p>
      <div class="field">
        <label for="name">Name</label>
        <input id="name" name="name" autocomplete="name" placeholder="Dave Smith" required>
      </div>
      <div class="field">
        <label for="phone">Mobile</label>
        <input id="phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="04xx xxx xxx" required>
      </div>
      <div class="field">
        <label for="email">Email <span class="opt">(optional — for your confirmation)</span></label>
        <input id="email" name="email" type="email" inputmode="email" autocomplete="email">
      </div>
      <div class="field">
        <label for="notes">What needs doing? <span class="opt">(optional)</span></label>
        <textarea id="notes" name="notes" placeholder="e.g. blocked drain in the laundry, water backing up"></textarea>
      </div>
      <div class="hp" aria-hidden="true">
        <label for="website">Website</label>
        <input id="website" name="website" type="text" tabindex="-1" autocomplete="off">
      </div>
    </section>

    <div class="ctabar">
      <button id="submit" class="cta" type="submit" disabled>
        Pick a time first
      </button>
      <p id="err" class="err" role="alert" aria-live="polite"></p>
    </div>
  </form>

  <section id="done" class="card hero done" hidden>
    <div class="tick" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 12.5l5 5 10-11"/></svg>
    </div>
    <h2>You're booked in</h2>
    <div class="when" id="doneWhen"></div>
    <p>${esc(businessName)} will text to confirm${phone ? `. Need to change it? Call ${esc(phone)}` : ''}.</p>
    <div class="calbtns">
      <a id="gcalLink" class="calbtn" target="_blank" rel="noopener">Add to Google Calendar</a>
      <a id="icsLink" class="calbtn" download="booking.ics">Add to iPhone calendar</a>
    </div>
  </section>

  <footer>
    <p>Booked with <strong>Flynn</strong> — the receptionist that never misses a call.<br>
    <a href="${esc(FLYNN_MARKETING_URL)}?utm_source=booking_page&utm_medium=footer">Get this for your business</a></p>
  </footer>
</div>

<script>
(function(){
  var slug = ${JSON.stringify(page.slug)};
  var business = ${JSON.stringify(businessName)};
  var daysEl = document.getElementById('days');
  var slotsEl = document.getElementById('slots');
  var emptyEl = document.getElementById('slotsEmpty');
  var errorEl = document.getElementById('slotsError');
  var submitEl = document.getElementById('submit');
  var errEl = document.getElementById('err');
  var formEl = document.getElementById('form');
  var doneEl = document.getElementById('done');
  var chosen = null;          // {start_time,end_time,label}
  var chosenDayLabel = '';
  var cache = {};             // date -> slots[]
  var reqSeq = 0;
  var submitting = false;

  function currentDayBtn(){
    return daysEl.querySelector('.day[aria-pressed="true"]');
  }
  function setCta(){
    if (chosen){
      submitEl.disabled = false;
      submitEl.innerHTML = 'Book it in<span class="sub-when">' + chosenDayLabel + ', ' + chosen.label + '</span>';
    } else {
      submitEl.disabled = true;
      submitEl.textContent = 'Pick a time first';
    }
  }
  function setChosen(slot, btn){
    chosen = slot;
    chosenDayLabel = (currentDayBtn() || {}).dataset ? currentDayBtn().dataset.label : '';
    Array.prototype.forEach.call(slotsEl.querySelectorAll('.slot'), function(b){
      b.setAttribute('aria-pressed', String(b === btn));
    });
    setCta();
  }
  function showSkeleton(){
    slotsEl.innerHTML = '';
    for (var i = 0; i < 6; i++){
      var d = document.createElement('div');
      d.className = 'skeleton';
      slotsEl.appendChild(d);
    }
  }
  function renderSlots(open){
    slotsEl.innerHTML = '';
    if (!open.length){ emptyEl.hidden = false; return; }
    open.forEach(function(s){
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'slot';
      b.textContent = s.label;
      b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', function(){ setChosen(s, b); });
      slotsEl.appendChild(b);
    });
  }
  function loadSlots(force){
    var btn = currentDayBtn();
    if (!btn) return;
    var date = btn.dataset.date;
    var seq = ++reqSeq;
    emptyEl.hidden = true;
    errorEl.hidden = true;
    chosen = null; setCta();
    if (!force && cache[date]){ renderSlots(cache[date]); return; }
    showSkeleton();
    fetch('/api/booking/' + encodeURIComponent(slug) + '/availability?date=' + encodeURIComponent(date))
      .then(function(r){ if (!r.ok) throw new Error('http ' + r.status); return r.json(); })
      .then(function(data){
        if (seq !== reqSeq) return; // a later day was clicked; drop this response
        var open = (data.slots || []).filter(function(s){ return s.is_available; });
        cache[date] = open;
        renderSlots(open);
      })
      .catch(function(){
        if (seq !== reqSeq) return;
        slotsEl.innerHTML = '';
        errorEl.hidden = false;
      });
  }

  daysEl.addEventListener('click', function(e){
    var btn = e.target.closest('.day');
    if (!btn) return;
    Array.prototype.forEach.call(daysEl.querySelectorAll('.day'), function(b){
      b.setAttribute('aria-pressed', String(b === btn));
    });
    btn.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
    loadSlots(false);
  });
  document.getElementById('retry').addEventListener('click', function(){ loadSlots(true); });
  loadSlots(false);

  // ---- add-to-calendar helpers (built from the chosen UTC instants) ----
  function compact(iso){ return iso.replace(/[-:]/g, '').replace(/\\.\\d{3}/, ''); }
  function calendarLinks(){
    var text = encodeURIComponent(business + ' — booking');
    var dates = compact(chosen.start_time) + '/' + compact(chosen.end_time);
    var gcal = 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + text + '&dates=' + dates;
    var ics = [
      'BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Flynn//Booking//EN','BEGIN:VEVENT',
      'UID:' + Date.now() + '@flynnai.app',
      'DTSTAMP:' + compact(new Date().toISOString()),
      'DTSTART:' + compact(chosen.start_time),
      'DTEND:' + compact(chosen.end_time),
      'SUMMARY:' + business + ' — booking',
      'END:VEVENT','END:VCALENDAR'
    ].join('\\r\\n');
    return { gcal: gcal, ics: 'data:text/calendar;charset=utf-8,' + encodeURIComponent(ics) };
  }

  formEl.addEventListener('submit', function(e){
    e.preventDefault();
    if (submitting) return;
    errEl.textContent = '';
    var name = document.getElementById('name').value.trim();
    var phone = document.getElementById('phone').value.trim();
    if (!chosen){ errEl.textContent = 'Pick a time up top first.'; return; }
    if (!name || !phone){ errEl.textContent = 'Add your name and mobile so they know who booked.'; return; }
    if (phone.replace(/\\D/g, '').length < 8){ errEl.textContent = 'That mobile number looks short — double-check it?'; return; }

    submitting = true;
    submitEl.disabled = true;
    submitEl.textContent = 'Booking\\u2026';

    var keepWhen = chosenDayLabel + ', ' + chosen.label;
    var links = calendarLinks();

    fetch('/api/booking/' + encodeURIComponent(slug) + '/book', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_name: name,
        customer_phone: phone,
        customer_email: document.getElementById('email').value.trim() || null,
        start_time: chosen.start_time,
        end_time: chosen.end_time,
        notes: document.getElementById('notes').value.trim() || null,
        website: document.getElementById('website').value || undefined
      })
    })
    .then(function(r){ return r.json().then(function(b){ return { ok: r.ok, status: r.status, body: b }; }); })
    .then(function(res){
      if (!res.ok){
        var msg = (res.body && res.body.error) || 'Could not book that time';
        var e2 = new Error(msg); e2.code = res.status; throw e2;
      }
      formEl.hidden = true;
      document.getElementById('doneWhen').textContent = keepWhen;
      document.getElementById('gcalLink').href = links.gcal;
      document.getElementById('icsLink').href = links.ics;
      doneEl.hidden = false;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    })
    .catch(function(e2){
      submitting = false;
      setCta();
      if (e2.code === 409){
        errEl.textContent = 'Someone just took that time — here are the ones still open.';
        delete cache[(currentDayBtn()||{dataset:{}}).dataset.date];
        loadSlots(true);
      } else {
        errEl.textContent = e2.message || 'Something went wrong — try again.';
        submitEl.disabled = false;
      }
    });
  });
})();
</script>
</body>
</html>`;
}

/** GET /b/:slug — the branded page the customer actually lands on. */
router.get('/b/:slug', async (req, res) => {
  try {
    const { slug } = req.params;

    const { data: page } = await supabase
      .from('booking_pages')
      .select('*')
      .eq('slug', slug)
      .eq('is_active', true)
      .maybeSingle();

    if (!page) {
      return res.status(404).type('html').send(notFoundPage());
    }

    // Pricing and contact details live on business_profiles, keyed by org.
    const { data: profile } = await supabase
      .from('business_profiles')
      .select('business_name, public_name, phone, callout_fee_cents, pricing_notes, service_area, service_areas')
      .eq('org_id', page.org_id)
      .maybeSingle();

    res.set('Cache-Control', 'no-store');
    res.type('html').send(renderBookingPage(page, profile || {}));

    // Fire-and-forget: the open rate is the read on whether the artifact works.
    ownerDistinctId(page.org_id)
      .then((distinctId) =>
        analytics.capture(distinctId, analytics.EVENTS.BOOKING_LINK_OPENED, {
          slug,
          org_id: page.org_id,
        })
      )
      .catch(() => {});
  } catch (error) {
    console.error('[BookingPage] render failed:', error);
    res.status(500).type('html').send(notFoundPage());
  }
});

/**
 * GET /b/:slug/og.png — branded unfurl card. The link mostly travels by SMS
 * and iMessage; iMessage fetches OG, so the in-thread preview should read as
 * the business's booking card, not a generic banner. Same sharp SVG->PNG
 * approach as services/ogImage.js; 302 to a static fallback on any failure so
 * previews never break.
 */
router.get('/b/:slug/og.png', async (req, res) => {
  try {
    const { data: page } = await supabase
      .from('booking_pages')
      .select('slug, business_name, org_id')
      .eq('slug', req.params.slug)
      .eq('is_active', true)
      .maybeSingle();
    if (!page) return res.redirect(302, OG_FALLBACK_IMAGE);

    const sharp = require('sharp');
    const name = esc(page.business_name || 'Book online');
    const initial = esc((page.business_name || 'B').trim()[0].toUpperCase());
    const svg = `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="630" fill="#f4e6ce"/>
  <rect x="28" y="28" width="1144" height="574" rx="36" fill="#fffbf4" stroke="#2c2018" stroke-width="6"/>
  <circle cx="150" cy="180" r="62" fill="#e0a436" stroke="#2c2018" stroke-width="6"/>
  <text x="150" y="205" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="68" font-weight="700" fill="#2c2018">${initial}</text>
  <text x="252" y="164" font-family="Helvetica, Arial, sans-serif" font-size="56" font-weight="700" fill="#2c2018">${name.length > 26 ? name.slice(0, 25) + '…' : name}</text>
  <text x="252" y="222" font-family="Helvetica, Arial, sans-serif" font-size="34" fill="#5a4a3c">Book a time online — takes a minute</text>
  <g>
    <rect x="120" y="316" width="200" height="86" rx="20" fill="#fffbf4" stroke="#dccdb2" stroke-width="3"/>
    <text x="220" y="370" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="34" font-weight="700" fill="#2c2018">9:00 am</text>
    <rect x="344" y="316" width="200" height="86" rx="20" fill="#fb5b1e" stroke="#2c2018" stroke-width="5"/>
    <text x="444" y="370" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="34" font-weight="700" fill="#fffbf4">10:15 am</text>
    <rect x="568" y="316" width="200" height="86" rx="20" fill="#fffbf4" stroke="#dccdb2" stroke-width="3"/>
    <text x="668" y="370" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="34" font-weight="700" fill="#2c2018">1:30 pm</text>
  </g>
  <rect x="120" y="452" width="420" height="92" rx="46" fill="#fb5b1e" stroke="#2c2018" stroke-width="6"/>
  <text x="330" y="511" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="36" font-weight="700" fill="#fffbf4">Book it in</text>
  <text x="1076" y="540" text-anchor="end" font-family="Helvetica, Arial, sans-serif" font-size="30" font-weight="700" fill="#8a7a68">Flynn</text>
</svg>`;
    const png = await sharp(Buffer.from(svg)).png().toBuffer();
    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(png);
  } catch (err) {
    console.warn('[BookingPage] og.png failed:', err.message);
    res.redirect(302, OG_FALLBACK_IMAGE);
  }
});

/** Short alias so SMS bodies can stay under a segment. */
router.get('/bk/:slug', (req, res) => {
  res.redirect(302, `/b/${encodeURIComponent(req.params.slug)}`);
});

module.exports = router;
module.exports.renderBookingPage = renderBookingPage;
module.exports.upcomingDates = upcomingDates;
