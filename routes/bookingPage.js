/**
 * The public, branded booking page: GET /b/:slug
 *
 * Server-rendered by this Express app, deliberately. There is already a
 * separate Next.js booking app in `booking-pages/` deployed as its own Fly app,
 * but its `/api/*` rewrite targets `http://localhost:3000` (booking-pages/
 * next.config.js), which cannot resolve from a different machine — so in
 * production it can never load a slot. Rather than revive that, this mirrors
 * `routes/invoicePage.js`: one origin, no cross-app proxy, no second deploy,
 * a single self-contained HTML string with inline CSS and no external requests.
 *
 * Price disclosure is not decoration. Under Australian Consumer Law a call-out
 * fee has to be disclosed before the customer commits, so the fee and pricing
 * notes render above the form, not buried in a confirmation email.
 */

const express = require('express');
const { supabase } = require('../telephony/supabaseClient');
const analytics = require('./../services/analytics');
const {
  parseCalendarDate,
  weekdayForCalendarDate,
  todayInZone,
  addDays,
  toDateString,
  formatDayLabel,
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
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:#fffbf4;color:#2c2018;
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;padding:24px}
  .b{text-align:center;max-width:380px}
  h1{font-size:20px;margin:0 0 8px}
  p{color:#5a4a3c;margin:0;line-height:1.5}
</style></head><body><div class="b">
<h1>This booking link isn't active</h1>
<p>The link may have expired or been turned off. Try giving the business a call.</p>
</div></body></html>`;
}

/**
 * The next `count` bookable calendar dates, skipping days the business is
 * closed and anything past `max_days_advance`.
 */
function upcomingDates(page, count = 14) {
  const timeZone = page.timezone || 'Australia/Sydney';
  const hours = page.business_hours || {};
  const maxDays = Math.max(1, Number(page.max_days_advance ?? 60));
  const out = [];
  let cal = todayInZone(timeZone);
  for (let offset = 0; offset < maxDays && out.length < count; offset += 1) {
    const day = hours[weekdayForCalendarDate(cal)];
    if (day && day.enabled) {
      const noonUtc = zonedWallTimeToUtc(cal.year, cal.month, cal.day, 12, 0, timeZone);
      out.push({ value: toDateString(cal), label: formatDayLabel(noonUtc, timeZone) });
    }
    cal = addDays(cal, 1);
  }
  return out;
}

function renderBookingPage(page, profile) {
  const businessName = page.business_name || profile?.public_name || profile?.business_name || 'Bookings';
  const brand = /^#[0-9a-f]{3,8}$/i.test(page.primary_color || '') ? page.primary_color : '#fb5b1e';
  const dates = upcomingDates(page);
  const calloutFee = money(profile?.callout_fee_cents);
  const pricingNotes = (profile?.pricing_notes || '').trim();
  const phone = (profile?.phone || '').trim();
  const serviceAreas = Array.isArray(profile?.service_areas)
    ? profile.service_areas.filter(Boolean).join(', ')
    : (profile?.service_area || '');
  const title = `Book with ${businessName}`;
  const description = calloutFee
    ? `Pick a time that suits you. Call-out ${calloutFee}.`
    : 'Pick a time that suits you.';

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
<meta property="og:image" content="${esc(OG_FALLBACK_IMAGE)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="robots" content="noindex">
<style>
  :root{
    --brand:${esc(brand)};
    --ink:#2c2018; --muted:#5a4a3c; --line:#e3d9c6; --bg:#fffbf4; --card:#ffffff;
  }
  *{box-sizing:border-box}
  html,body{margin:0;background:var(--bg);color:var(--ink);
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
    -webkit-font-smoothing:antialiased}
  .wrap{max-width:520px;margin:0 auto;padding:24px 16px 40px}
  header{margin-bottom:20px}
  .eyebrow{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);font-weight:700;margin:0 0 6px}
  h1{font-size:26px;line-height:1.2;margin:0 0 6px;letter-spacing:-.01em}
  .sub{color:var(--muted);margin:0;font-size:15px;line-height:1.5}
  .card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:18px;margin-top:16px}
  .card h2{font-size:15px;margin:0 0 12px;letter-spacing:-.005em}
  .disclosure{background:#fff6ee;border-color:#f3d9c2}
  .fee{display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin:0 0 6px}
  .fee .amt{font-size:22px;font-weight:750;letter-spacing:-.01em}
  .fine{color:var(--muted);font-size:13px;line-height:1.5;margin:8px 0 0;white-space:pre-wrap}
  label{display:block;font-size:13px;font-weight:650;margin:0 0 6px}
  select,input,textarea{width:100%;font:inherit;font-size:16px;color:var(--ink);background:#fff;
    border:1px solid var(--line);border-radius:11px;padding:12px 13px;appearance:none}
  select:focus,input:focus,textarea:focus{outline:2px solid var(--brand);outline-offset:1px;border-color:transparent}
  textarea{min-height:80px;resize:vertical}
  .field+.field{margin-top:13px}
  .slots{display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:8px;margin-top:12px}
  .slot{font:inherit;font-size:15px;font-weight:600;padding:11px 6px;border-radius:11px;
    border:1px solid var(--line);background:#fff;color:var(--ink);cursor:pointer;text-align:center}
  .slot[aria-pressed="true"]{background:var(--brand);border-color:var(--brand);color:#fff}
  .slot:disabled{opacity:.36;cursor:not-allowed;text-decoration:line-through}
  .empty{color:var(--muted);font-size:14px;margin:12px 0 0}
  .cta{width:100%;font:inherit;font-size:17px;font-weight:750;color:#fff;background:var(--brand);
    border:0;border-radius:999px;padding:16px;margin-top:18px;cursor:pointer}
  .cta:disabled{opacity:.45;cursor:not-allowed}
  .err{color:#b42318;font-size:14px;margin:10px 0 0;min-height:1em}
  footer{text-align:center;margin-top:28px;color:var(--muted);font-size:13px;line-height:1.6}
  footer a{color:var(--muted)}
  .done{text-align:center;padding:26px 18px}
  .done .tick{width:52px;height:52px;border-radius:50%;background:var(--brand);color:#fff;display:grid;
    place-items:center;margin:0 auto 14px;font-size:26px}
  .done h2{font-size:20px;margin:0 0 8px}
  [hidden]{display:none !important}
</style>
</head>
<body>
<div class="wrap">
  <header>
    <p class="eyebrow">Book online</p>
    <h1>${esc(businessName)}</h1>
    <p class="sub">Pick a time that suits you${serviceAreas ? ` &middot; ${esc(serviceAreas)}` : ''}</p>
  </header>

  ${hasDisclosure ? `
  <section class="card disclosure">
    <h2>What it costs</h2>
    ${calloutFee ? `<p class="fee"><span>Call-out fee</span><span class="amt">${esc(calloutFee)}</span></p>` : ''}
    ${pricingNotes ? `<p class="fine">${esc(pricingNotes)}</p>` : ''}
    <p class="fine">You'll get a firm price before any work starts.</p>
  </section>` : ''}

  <form id="form" novalidate>
    <section class="card">
      <h2>Choose a time</h2>
      <div class="field">
        <label for="date">Day</label>
        <select id="date" name="date">
          ${dates.map((d, i) => `<option value="${esc(d.value)}"${i === 0 ? ' selected' : ''}>${esc(d.label)}</option>`).join('')}
        </select>
      </div>
      <div id="slots" class="slots" role="group" aria-label="Available times"></div>
      <p id="slotsEmpty" class="empty" hidden>No times left on that day. Try another.</p>
    </section>

    <section class="card">
      <h2>Your details</h2>
      <div class="field">
        <label for="name">Name</label>
        <input id="name" name="name" autocomplete="name" required>
      </div>
      <div class="field">
        <label for="phone">Mobile</label>
        <input id="phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" required>
      </div>
      <div class="field">
        <label for="email">Email <span style="font-weight:400;color:var(--muted)">(optional)</span></label>
        <input id="email" name="email" type="email" autocomplete="email">
      </div>
      <div class="field">
        <label for="notes">What do you need done?</label>
        <textarea id="notes" name="notes"></textarea>
      </div>
    </section>

    <button id="submit" class="cta" type="submit" disabled>Pick a time first</button>
    <p id="err" class="err" role="alert"></p>
  </form>

  <section id="done" class="card done" hidden>
    <div class="tick">&#10003;</div>
    <h2>You're booked in</h2>
    <p class="sub" id="doneWhen"></p>
    <p class="fine">${esc(businessName)} will confirm shortly${phone ? `. Need to change it? Call ${esc(phone)}` : ''}.</p>
  </section>

  <footer>
    <p>Booked with <strong>Flynn</strong> &middot; <a href="${esc(FLYNN_MARKETING_URL)}">Get this for your business</a></p>
  </footer>
</div>

<script>
(function(){
  var slug = ${JSON.stringify(page.slug)};
  var duration = ${Number(page.slot_duration_minutes) || 60};
  var dateEl = document.getElementById('date');
  var slotsEl = document.getElementById('slots');
  var emptyEl = document.getElementById('slotsEmpty');
  var submitEl = document.getElementById('submit');
  var errEl = document.getElementById('err');
  var formEl = document.getElementById('form');
  var doneEl = document.getElementById('done');
  var chosen = null;

  function setChosen(slot, btn){
    chosen = slot;
    Array.prototype.forEach.call(slotsEl.querySelectorAll('.slot'), function(b){
      b.setAttribute('aria-pressed', String(b === btn));
    });
    submitEl.disabled = !slot;
    submitEl.textContent = slot ? 'Book this time' : 'Pick a time first';
  }

  function loadSlots(){
    slotsEl.innerHTML = '';
    emptyEl.hidden = true;
    setChosen(null, null);
    fetch('/api/booking/' + encodeURIComponent(slug) + '/availability?date=' + encodeURIComponent(dateEl.value))
      .then(function(r){ return r.json(); })
      .then(function(data){
        var open = (data.slots || []).filter(function(s){ return s.is_available; });
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
      })
      .catch(function(){ emptyEl.hidden = false; });
  }

  dateEl.addEventListener('change', loadSlots);
  loadSlots();

  formEl.addEventListener('submit', function(e){
    e.preventDefault();
    errEl.textContent = '';
    var name = document.getElementById('name').value.trim();
    var phone = document.getElementById('phone').value.trim();
    if (!name || !phone){ errEl.textContent = 'Please add your name and mobile.'; return; }
    if (!chosen){ errEl.textContent = 'Please pick a time.'; return; }

    submitEl.disabled = true;
    submitEl.textContent = 'Booking...';

    fetch('/api/booking/' + encodeURIComponent(slug) + '/book', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_name: name,
        customer_phone: phone,
        customer_email: document.getElementById('email').value.trim() || null,
        start_time: chosen.start_time,
        end_time: chosen.end_time,
        duration_minutes: duration,
        notes: document.getElementById('notes').value.trim() || null
      })
    })
    .then(function(r){ return r.json().then(function(b){ return { ok: r.ok, body: b }; }); })
    .then(function(res){
      if (!res.ok){ throw new Error((res.body && res.body.error) || 'Could not book that time'); }
      formEl.hidden = true;
      document.getElementById('doneWhen').textContent = dateEl.options[dateEl.selectedIndex].text + ', ' + chosen.label;
      doneEl.hidden = false;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    })
    .catch(function(e){
      errEl.textContent = e.message === 'Time slot is no longer available'
        ? 'Someone just took that time. Pick another.'
        : e.message;
      submitEl.disabled = false;
      submitEl.textContent = 'Book this time';
      loadSlots();
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

/** Short alias so SMS bodies can stay under a segment. */
router.get('/bk/:slug', (req, res) => {
  res.redirect(302, `/b/${encodeURIComponent(req.params.slug)}`);
});

module.exports = router;
module.exports.renderBookingPage = renderBookingPage;
module.exports.upcomingDates = upcomingDates;
