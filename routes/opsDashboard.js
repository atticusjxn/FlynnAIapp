/**
 * Ops dashboard — GET /ops
 *
 * A single private page for "is everything funded and where are people
 * dropping off": provider balances (Twilio, Deepgram, OpenAI — the ones that
 * expose a real balance API with the keys already in Fly secrets) and a
 * 7-day PostHog funnel summary. Server-rendered like routes/invoicePage.js
 * and routes/bookingPage.js — no separate frontend build.
 *
 * Gated by a single shared passphrase (OPS_DASHBOARD_PASSPHRASE), not real
 * per-user auth — this is a personal tool for one operator, not a product
 * surface. A correct passphrase mints a signed, HttpOnly session cookie good
 * for 90 days, so "add to home screen" on a phone stays logged in.
 *
 * Reachable at https://flynnai.app/ops via the Cloudflare Worker proxy
 * (flynn-ai-new-landingpage/worker.js) — otherwise flynnai.app/ops would
 * silently fall through to the marketing SPA's index.html.
 */

const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const router = express.Router();

const PASSPHRASE = process.env.OPS_DASHBOARD_PASSPHRASE;
const JWT_SECRET = process.env.OPS_DASHBOARD_JWT_SECRET;
const SESSION_COOKIE = 'flynn_ops';
const SESSION_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const POSTHOG_HOST = (process.env.POSTHOG_HOST || 'https://us.posthog.com').replace(/\/$/, '');
const POSTHOG_PROJECT_ID = process.env.POSTHOG_PROJECT_ID || '550834';
const POSTHOG_OPS_QUERY_KEY = process.env.POSTHOG_OPS_QUERY_KEY;

// ---------------------------------------------------------------------------
// Cookie / session — no cookie-parser dependency, just one cookie to read.

function parseCookies(req) {
  const header = req.headers.cookie;
  if (!header) return {};
  return header.split(';').reduce((acc, part) => {
    const idx = part.indexOf('=');
    if (idx === -1) return acc;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) acc[key] = decodeURIComponent(val);
    return acc;
  }, {});
}

function isAuthed(req) {
  if (!JWT_SECRET) return false;
  const cookies = parseCookies(req);
  const token = cookies[SESSION_COOKIE];
  if (!token) return false;
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    return payload?.ops === true;
  } catch (_) {
    return false;
  }
}

function setSessionCookie(res) {
  const token = jwt.sign({ ops: true }, JWT_SECRET, { expiresIn: '90d' });
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Lax; Path=/ops; Max-Age=${Math.floor(SESSION_MAX_AGE_MS / 1000)}`
  );
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/ops; Max-Age=0`);
}

// Basic brute-force guard on the login form — in-memory, per-IP, resets on
// deploy. Good enough for a single-operator passphrase gate.
const loginAttempts = new Map();
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 10;

function loginRateLimited(ip) {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || now > entry.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > LOGIN_MAX_ATTEMPTS;
}

// ---------------------------------------------------------------------------
// Provider balance fetchers — each best-effort, never throws. A provider
// without a clean balance API (or a key without the right scope) degrades to
// an "unavailable" card with a direct link, not a broken page.

async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchTwilioBalance() {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    return { ok: false, reason: 'Not configured' };
  }
  try {
    const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');
    const res = await fetchWithTimeout(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Balance.json`,
      { headers: { Authorization: `Basic ${auth}` } }
    );
    if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` };
    const data = await res.json();
    return { ok: true, balance: data.balance, currency: (data.currency || 'usd').toUpperCase() };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
}

async function fetchDeepgramBalance() {
  if (!DEEPGRAM_API_KEY) return { ok: false, reason: 'Not configured' };
  try {
    const projRes = await fetchWithTimeout('https://api.deepgram.com/v1/projects', {
      headers: { Authorization: `Token ${DEEPGRAM_API_KEY}` },
    });
    if (!projRes.ok) return { ok: false, reason: `HTTP ${projRes.status}` };
    const projData = await projRes.json();
    const project = projData.projects?.[0];
    if (!project) return { ok: false, reason: 'No project on this key' };

    const balRes = await fetchWithTimeout(
      `https://api.deepgram.com/v1/projects/${project.project_id}/balances`,
      { headers: { Authorization: `Token ${DEEPGRAM_API_KEY}` } }
    );
    if (!balRes.ok) return { ok: false, reason: `HTTP ${balRes.status}` };
    const balData = await balRes.json();
    const balances = balData.balances || [];
    return {
      ok: true,
      project: project.name,
      balances: balances.map((b) => ({ amount: b.amount, units: b.units })),
    };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
}

// OpenAI's billing/usage endpoints require an org-level Admin API key, not a
// regular project key — the OPENAI_API_KEY in use here is the runtime
// transcription-fallback key, so this almost certainly 401s. Attempted
// anyway (cheap, cached), with an honest fallback rather than pretending it
// works.
async function fetchOpenAIStatus() {
  if (!OPENAI_API_KEY) return { ok: false, reason: 'Not configured' };
  try {
    const res = await fetchWithTimeout('https://api.openai.com/v1/organization/costs?limit=1', {
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
    });
    if (!res.ok) {
      return {
        ok: false,
        reason: res.status === 401 || res.status === 403
          ? 'Key is not an Admin key — usage API needs one'
          : `HTTP ${res.status}`,
      };
    }
    return { ok: true, note: 'Reachable — see platform.openai.com/usage for the breakdown' };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
}

async function fetchPostHogSummary() {
  if (!POSTHOG_OPS_QUERY_KEY) return { ok: false, reason: 'Not configured' };
  try {
    const res = await fetchWithTimeout(
      `${POSTHOG_HOST}/api/projects/${POSTHOG_PROJECT_ID}/query/`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${POSTHOG_OPS_QUERY_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: {
            kind: 'HogQLQuery',
            query: `SELECT event, count() AS n FROM events
                     WHERE timestamp > now() - INTERVAL 7 DAY
                     GROUP BY event ORDER BY n DESC LIMIT 25`,
          },
        }),
      },
      12000
    );
    if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` };
    const data = await res.json();
    const rows = (data.results || []).map(([event, n]) => ({ event, count: n }));
    return { ok: true, rows };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
}

// ---------------------------------------------------------------------------
// Cache — 5 minute TTL, shared across visitors (there's only ever one). A
// PWA reopened repeatedly on a phone shouldn't hammer four provider APIs
// every time.

let cache = { data: null, fetchedAt: 0 };
const CACHE_TTL_MS = 5 * 60 * 1000;

async function loadDashboardData(forceRefresh) {
  if (!forceRefresh && cache.data && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return { ...cache.data, cached: true, fetchedAt: cache.fetchedAt };
  }
  const [twilio, deepgram, openai, posthog] = await Promise.all([
    fetchTwilioBalance(),
    fetchDeepgramBalance(),
    fetchOpenAIStatus(),
    fetchPostHogSummary(),
  ]);
  const data = { twilio, deepgram, openai, posthog };
  cache = { data, fetchedAt: Date.now() };
  return { ...data, cached: false, fetchedAt: cache.fetchedAt };
}

// ---------------------------------------------------------------------------
// Canonical funnel order — matches the event schema in a.md Gate 1. Rows not
// in this list (nothing today, but future events) render after, unordered.
const FUNNEL_ORDER = [
  'app_installed', 'signup_started', 'signup_completed',
  'onboard_trade_selected', 'onboard_services_entered', 'onboard_calendar_connected',
  'demo_call_requested', 'demo_call_answered', 'demo_call_completed', 'demo_transcript_viewed',
  'paywall_viewed', 'paywall_dismissed', 'trial_started', 'subscription_purchased',
  'number_assigned', 'forwarding_code_dialled', 'forwarding_verified',
  'call_answered', 'job_booked', 'booking_link_sent', 'booking_link_opened', 'booking_made',
  'invoice_sent', 'invoice_paid', 'chase_sent',
];

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

const BASE_STYLE = `
  :root{--ink:#2c2018;--cream:#f4e6ce;--card:#fffbf4;--orange:#fb5b1e;--border:#2c2018;
    --sub:#5a4a3c;--ok:#3c8a86;--err:#c5532b}
  *{box-sizing:border-box}
  body{margin:0;background:var(--cream);color:var(--ink);
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
    padding:20px 16px 48px;-webkit-font-smoothing:antialiased}
  .wrap{max-width:640px;margin:0 auto}
  h1{font-size:22px;font-weight:700;margin:0 0 4px;letter-spacing:-.01em}
  .sub{color:var(--sub);font-size:13px;margin:0 0 20px}
  .card{background:var(--card);border:2px solid var(--border);border-radius:14px;
    padding:16px 18px;margin-bottom:14px}
  .card h2{font-size:15px;font-weight:700;margin:0 0 10px;display:flex;
    align-items:center;justify-content:space-between}
  .amt{font-size:26px;font-weight:700;letter-spacing:-.02em}
  .row{display:flex;justify-content:space-between;align-items:baseline;
    padding:6px 0;border-bottom:1px solid #ecdfc4;font-size:14px}
  .row:last-child{border-bottom:none}
  .row .n{font-weight:700}
  .muted{color:var(--sub);font-size:13px}
  .badge{display:inline-block;font-size:11px;font-weight:700;padding:2px 8px;
    border-radius:20px;text-transform:uppercase;letter-spacing:.03em}
  .badge.ok{background:rgba(60,138,134,.15);color:var(--ok)}
  .badge.err{background:rgba(197,83,43,.15);color:var(--err)}
  a{color:var(--orange);text-decoration:none;font-weight:600}
  a:hover{text-decoration:underline}
  .footer{text-align:center;margin-top:24px;font-size:12px;color:var(--sub)}
  input[type=password]{width:100%;padding:12px 14px;border:2px solid var(--border);
    border-radius:10px;font-size:16px;margin-bottom:12px;background:var(--card);color:var(--ink)}
  button{width:100%;padding:13px;border:2px solid var(--border);border-radius:10px;
    background:var(--orange);color:#fff;font-weight:700;font-size:15px;cursor:pointer}
  .error{color:var(--err);font-size:13px;margin-bottom:12px}
  @media(prefers-color-scheme:dark){
    :root{--ink:#f7f0e4;--cream:#1c1611;--card:#26201a;--border:#f7f0e4;--sub:#d6c9b6}
  }
`;

const MANIFEST_LINKS = `
  <link rel="manifest" href="/ops/manifest.json">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="apple-mobile-web-app-title" content="Flynn Ops">
  <link rel="apple-touch-icon" href="/ops/icon-180.png">
  <meta name="theme-color" content="#FB5B1E">
`;

function loginPage(error) {
  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Flynn Ops</title>${MANIFEST_LINKS}<style>${BASE_STYLE}</style></head><body>
<div class="wrap" style="max-width:340px;padding-top:18vh">
  <h1>Flynn Ops</h1>
  <p class="sub">Enter the passphrase to continue.</p>
  ${error ? `<p class="error">${escapeHtml(error)}</p>` : ''}
  <form method="POST" action="/ops/login">
    <input type="password" name="passphrase" placeholder="Passphrase" autofocus autocomplete="current-password">
    <button type="submit">Unlock</button>
  </form>
</div></body></html>`;
}

function moneyRow(amount, currency) {
  if (amount == null) return '—';
  const n = Number(amount);
  if (Number.isNaN(n)) return escapeHtml(String(amount));
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD' }).format(n);
  } catch (_) {
    return `${n.toFixed(2)} ${currency || ''}`;
  }
}

function providerCard(title, link, result, render) {
  if (!result.ok) {
    return `<div class="card"><h2>${escapeHtml(title)} <span class="badge err">Unavailable</span></h2>
      <p class="muted">${escapeHtml(result.reason || 'Unknown error')} — <a href="${link}" target="_blank" rel="noopener">check manually</a></p>
    </div>`;
  }
  return `<div class="card"><h2>${escapeHtml(title)} <span class="badge ok">Live</span></h2>${render(result)}</div>`;
}

function dashboardPage(data) {
  const twilioCard = providerCard('Twilio', 'https://console.twilio.com/us1/billing/manage-billing/billing-overview', data.twilio, (r) =>
    `<div class="amt">${moneyRow(r.balance, r.currency)}</div><p class="muted">Account balance</p>`
  );

  const deepgramCard = providerCard('Deepgram', 'https://console.deepgram.com/', data.deepgram, (r) => {
    if (!r.balances?.length) return `<p class="muted">No balance rows returned for ${escapeHtml(r.project || 'this project')}</p>`;
    return r.balances.map((b) => `<div class="amt">${escapeHtml(b.amount)} ${escapeHtml(b.units || '')}</div>`).join('') +
      `<p class="muted">${escapeHtml(r.project || '')}</p>`;
  });

  const openaiCard = providerCard('OpenAI', 'https://platform.openai.com/usage', data.openai, (r) =>
    `<p class="muted">${escapeHtml(r.note || 'Key reachable')}</p>`
  );

  let posthogCard;
  if (!data.posthog.ok) {
    posthogCard = providerCard('Signups & funnel (7 days)', `https://us.posthog.com/project/${POSTHOG_PROJECT_ID}`, data.posthog, () => '');
  } else {
    const rows = data.posthog.rows || [];
    const known = FUNNEL_ORDER
      .map((name) => ({ name, count: rows.find((r) => r.event === name)?.count ?? 0 }))
      .filter((r) => r.count > 0 || FUNNEL_ORDER.slice(0, 3).includes(r.name));
    const other = rows.filter((r) => !FUNNEL_ORDER.includes(r.event));
    const allZero = rows.length === 0;
    posthogCard = `<div class="card"><h2>Signups &amp; funnel (7 days) <span class="badge ok">Live</span></h2>
      ${allZero
        ? `<p class="muted">No events in the last 7 days yet — this fills in once real traffic starts. <a href="https://us.posthog.com/project/${POSTHOG_PROJECT_ID}" target="_blank" rel="noopener">Open PostHog</a></p>`
        : known.map((r) => `<div class="row"><span>${escapeHtml(r.name)}</span><span class="n">${r.count}</span></div>`).join('') +
          (other.length ? `<p class="muted" style="margin-top:8px">+ ${other.length} other event type${other.length === 1 ? '' : 's'}</p>` : '') +
          `<p class="muted" style="margin-top:8px"><a href="https://us.posthog.com/project/${POSTHOG_PROJECT_ID}" target="_blank" rel="noopener">Open full funnel in PostHog →</a></p>`
      }
    </div>`;
  }

  const ageSeconds = Math.round((Date.now() - data.fetchedAt) / 1000);

  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Flynn Ops</title>${MANIFEST_LINKS}<style>${BASE_STYLE}</style></head><body>
<div class="wrap">
  <h1>Flynn Ops</h1>
  <p class="sub">Updated ${data.cached ? `${ageSeconds}s ago (cached)` : 'just now'} ·
    <a href="/ops?refresh=1">Refresh</a> · <a href="/ops/logout">Log out</a></p>
  ${twilioCard}
  ${deepgramCard}
  ${openaiCard}
  ${posthogCard}
  <p class="footer">Balances refresh every 5 min. Twilio/Deepgram figures come straight from their APIs — treat OpenAI as informational until an Admin key is added.</p>
</div></body></html>`;
}

const MANIFEST = {
  name: 'Flynn Ops',
  short_name: 'Flynn Ops',
  description: 'API balances and signup funnel, at a glance.',
  start_url: '/ops',
  scope: '/ops',
  display: 'standalone',
  background_color: '#F4E6CE',
  theme_color: '#FB5B1E',
  icons: [
    { src: '/ops/icon-180.png', sizes: '180x180', type: 'image/png' },
    { src: '/ops/icon-1024.png', sizes: '1024x1024', type: 'image/png', purpose: 'any maskable' },
  ],
};

// ---------------------------------------------------------------------------
// Routes

router.get('/ops/manifest.json', (req, res) => {
  res.json(MANIFEST);
});

router.get(['/ops/icon-180.png', '/ops/icon-1024.png'], (req, res) => {
  const file = req.path.replace('/ops/', '');
  res.sendFile(file, { root: __dirname + '/../public/ops' }, (err) => {
    if (err) res.status(404).end();
  });
});

router.get('/ops', async (req, res) => {
  if (!PASSPHRASE || !JWT_SECRET) {
    return res.status(503).send('Ops dashboard not configured — set OPS_DASHBOARD_PASSPHRASE and OPS_DASHBOARD_JWT_SECRET.');
  }
  if (!isAuthed(req)) {
    return res.status(200).set('Content-Type', 'text/html; charset=utf-8').send(loginPage());
  }
  try {
    const data = await loadDashboardData(req.query.refresh === '1');
    res.set('Content-Type', 'text/html; charset=utf-8').send(dashboardPage(data));
  } catch (err) {
    console.error('[OpsDashboard] Failed to load:', err.message);
    res.status(500).send('Failed to load dashboard.');
  }
});

router.post('/ops/login', express.urlencoded({ extended: false }), (req, res) => {
  if (!PASSPHRASE || !JWT_SECRET) {
    return res.status(503).send('Ops dashboard not configured.');
  }
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || 'unknown';
  if (loginRateLimited(ip)) {
    return res.status(429).set('Content-Type', 'text/html; charset=utf-8')
      .send(loginPage('Too many attempts — try again in a few minutes.'));
  }
  const supplied = String(req.body?.passphrase || '');
  const expected = Buffer.from(PASSPHRASE);
  const given = Buffer.from(supplied);
  const match = given.length === expected.length && crypto.timingSafeEqual(given, expected);
  if (!match) {
    return res.status(401).set('Content-Type', 'text/html; charset=utf-8').send(loginPage('Wrong passphrase.'));
  }
  setSessionCookie(res);
  res.redirect('/ops');
});

router.get('/ops/logout', (req, res) => {
  clearSessionCookie(res);
  res.redirect('/ops');
});

module.exports = router;
