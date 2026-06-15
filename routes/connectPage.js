/**
 * Unified secure "connect your tools" page (/setup?t=<jwt>).
 *
 * One branded, mobile-first page that batches a user's integrations into a
 * stepper. Two card types:
 *   - OAuth (Google Calendar/Sheets): a Connect button -> /setup/oauth/:provider
 *     mints a Nango session and 302s to the provider consent screen.
 *   - Credential (Xero, trade suppliers, Apple/iCloud): a form posting
 *     email+password over HTTPS to /setup/credential, which encrypts at rest
 *     (services/credentialCrypto.js) — never over text.
 *
 * The link is identity-only (7-day JWT, CONNECT_LINK_JWT_SECRET); the page
 * derives which tools to show from the user's brain + existing connections.
 */

const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const nango = require('../services/nango');
const { encryptCredentials } = require('../services/credentialCrypto');
const { resumeParkedAction } = require('../services/agent/agentLoop');
const { sendToUser } = require('../services/flynnOutbound');

const router = express.Router();

const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_SECRET;
const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

const SUPPLIER_SLUGS = ['reece', 'bunnings', 'tradelink', 'nhp', 'middy', 'rsea', 'neco'];

// provider catalogue. kind: 'oauth' (Nango) or 'credential' (encrypted form).
// `nango` is the self-hosted provider config key for oauth rows; `provider` is
// the user_integrations key for credential rows.
const CATALOG = {
  google_calendar: { kind: 'oauth', nango: 'google-calendar', name: 'Google Calendar', blurb: 'Book jobs & see your week', icon: '📅' },
  google_sheets:   { kind: 'oauth', nango: 'google-sheet', name: 'Google Sheets', blurb: 'Log receipts & expenses', icon: '📊' },
  apple_calendar:  { kind: 'credential', provider: 'apple-calendar', name: 'Apple Calendar', blurb: 'Book into your iCloud calendar', icon: '📆',
                     userLabel: 'iCloud email', passLabel: 'App-specific password',
                     help: 'Make one at appleid.apple.com → Sign-In and Security → App-Specific Passwords.' },
  xero:            { kind: 'credential', provider: 'xero', name: 'Xero', blurb: 'Send invoices from a text', icon: '💸' },
  reece:           { kind: 'credential', provider: 'reece', name: 'Reece', blurb: 'Order plumbing supplies', icon: '🔧' },
  bunnings:        { kind: 'credential', provider: 'bunnings', name: 'Bunnings', blurb: 'Order materials', icon: '🪚' },
  tradelink:       { kind: 'credential', provider: 'tradelink', name: 'Tradelink', blurb: 'Order plumbing supplies', icon: '🚰' },
  nhp:             { kind: 'credential', provider: 'nhp', name: 'NHP', blurb: 'Order electrical', icon: '⚡' },
  middy:           { kind: 'credential', provider: 'middy', name: "Middy's", blurb: 'Order electrical', icon: '⚡' },
  rsea:            { kind: 'credential', provider: 'rsea', name: 'RSEA', blurb: 'Safety gear', icon: '🦺' },
  neco:            { kind: 'credential', provider: 'neco', name: 'Neco', blurb: 'Order supplies', icon: '📦' },
};

function verify(token) {
  try { return nango.verifyConnectLinkToken(String(token || '')); }
  catch { return null; }
}

async function loadCtx(claims) {
  const { data: user } = await supabase
    .from('users').select('id, phone, business_brain, preferred_channel').eq('id', claims.uid).maybeSingle();
  const connections = new Map();
  const { data: conns } = await supabase.from('user_connections').select('provider, status').eq('user_phone', claims.phone);
  for (const r of conns || []) connections.set(r.provider, r);
  const integ = new Set();
  const { data: ints } = await supabase.from('user_integrations').select('integration_type').eq('user_phone', claims.phone);
  for (const r of ints || []) integ.add(r.integration_type);
  return { user, connections, integ };
}

// Build the ordered list of cards for this user from their brain + connections.
function buildItems({ user, connections, integ }) {
  const brain = user?.business_brain || {};
  const slugs = new Set(['google_calendar', 'google_sheets', 'xero', 'apple_calendar']);
  for (const s of brain._pending_integrations || []) if (CATALOG[s]) slugs.add(s);
  const suppliers = (brain.suppliers || []).map((s) => String(s).toLowerCase()).filter((s) => SUPPLIER_SLUGS.includes(s));
  for (const s of (suppliers.length ? suppliers : ['reece'])) slugs.add(s);

  const isConnected = (meta) => meta.kind === 'oauth'
    ? connections.get(meta.nango)?.status === 'connected'
    : (connections.get(meta.provider)?.status === 'connected' || integ.has(meta.provider));

  const cards = [...slugs].map((slug) => {
    const meta = CATALOG[slug];
    return meta ? { slug, ...meta, connected: isConnected(meta) } : null;
  }).filter(Boolean);

  // Email is one step with a provider chooser (Gmail / Outlook one-click, or any
  // other address via app password) so a non-Gmail operator is still one session.
  const emailConnected = connections.get('google-mail')?.status === 'connected'
    || connections.get('outlook')?.status === 'connected'
    || connections.get('imap-email')?.status === 'connected'
    || integ.has('imap-email');
  cards.push({ slug: 'email', kind: 'email', name: 'Email', icon: '📧', blurb: 'Find & send email from a text', connected: emailConnected });

  // unconnected first (actionable), connected sink to the bottom
  return cards.sort((a, b) => Number(a.connected) - Number(b.connected));
}

// ---------------------------------------------------------------------------
// GET /setup?t=<jwt>  — the page
// ---------------------------------------------------------------------------
router.get('/setup', async (req, res) => {
  const claims = verify(req.query.t);
  if (!claims?.uid || !supabase) return res.status(410).send(expiredPage());
  const ctx = await loadCtx(claims);
  if (!ctx.user) return res.status(410).send(expiredPage());
  res.send(renderPage(String(req.query.t), buildItems(ctx)));
});

// ---------------------------------------------------------------------------
// GET /setup/oauth/:provider?t=<jwt>  — mint Nango session, 302 to consent
// ---------------------------------------------------------------------------
router.get('/setup/oauth/:provider', async (req, res) => {
  const claims = verify(req.query.t);
  if (!claims?.uid) return res.status(410).send(expiredPage());
  try {
    const { connectUrl } = await nango.createConnectSession({ userId: claims.uid, phone: claims.phone, provider: req.params.provider });
    return res.redirect(302, connectUrl);
  } catch (err) {
    console.warn('[ConnectPage] oauth mint failed:', err?.message);
    return res.status(502).send(expiredPage('Couldn\'t start that connection, head back and try again.'));
  }
});

// ---------------------------------------------------------------------------
// POST /setup/credential  — store an encrypted login, resume parked action
// ---------------------------------------------------------------------------
router.post('/setup/credential', express.json(), async (req, res) => {
  const claims = verify(req.body?.t);
  if (!claims?.uid || !supabase) return res.status(401).json({ ok: false });
  const provider = String(req.body?.provider || '').toLowerCase().trim();
  const email = String(req.body?.email || '').trim();
  const password = String(req.body?.password || '');
  const valid = provider === 'apple-calendar' || provider === 'xero' || provider === 'imap-email' || SUPPLIER_SLUGS.includes(provider);
  if (!valid || !email || !password) return res.status(400).json({ ok: false, error: 'missing or invalid fields' });
  // Gmail/Microsoft addresses can't use IMAP basic auth — steer to the OAuth tiles.
  if (provider === 'imap-email' && require('../services/imapEmail').requiresOAuth(email)) {
    return res.status(400).json({ ok: false, error: 'that address uses one-click sign-in, pick the Gmail or Outlook tile instead' });
  }

  const authKind = provider === 'apple-calendar' ? 'credentials_apple'
    : provider === 'imap-email' ? 'credentials_imap'
    : 'credentials_browserbase';
  const now = new Date().toISOString();
  try {
    await supabase.from('user_integrations').upsert({
      user_phone: claims.phone, integration_type: provider,
      credentials_encrypted: encryptCredentials({ email, password }),
      connected_at: now, updated_at: now,
    }, { onConflict: 'user_phone,integration_type' });
    await supabase.from('user_connections').upsert({
      user_id: claims.uid, user_phone: claims.phone, provider,
      auth_kind: authKind, status: 'connected', connected_at: now, updated_at: now,
    }, { onConflict: 'user_phone,provider' });

    // resume anything parked on this provider, text the result
    try {
      const resumed = await resumeParkedAction(claims.phone, provider, supabase);
      if (resumed.handled && resumed.bubbles.length) {
        await sendToUser(claims.phone, resumed.bubbles, { channel: 'imessage', supabase });
      }
    } catch (err) { console.warn('[ConnectPage] resume failed:', err?.message); }

    return res.json({ ok: true });
  } catch (err) {
    console.error('[ConnectPage] credential save failed:', err?.message);
    return res.status(500).json({ ok: false });
  }
});

// ---------------------------------------------------------------------------
// HTML
// ---------------------------------------------------------------------------
function expiredPage(msg = 'This link has expired. Text Flynn and ask to connect again.') {
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Flynn</title></head><body style="font-family:-apple-system,system-ui,sans-serif;background:#F4E6CE;color:#1E293B;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;padding:24px;text-align:center"><div><div style="font-size:40px">👋</div><p style="font-size:18px;max-width:300px">${msg}</p></div></body></html>`;
}

function renderPage(token, items) {
  const data = JSON.stringify({ token, items }).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Connect your tools · Flynn</title>
<style>
  :root{--orange:#FB5B1E;--cream:#F4E6CE;--ink:#1E293B;--muted:#64748B;--ok:#10B981;--line:#E2E8F0}
  *{box-sizing:border-box}
  body{margin:0;font-family:-apple-system,system-ui,Segoe UI,Roboto,sans-serif;background:var(--cream);color:var(--ink);-webkit-font-smoothing:antialiased}
  .wrap{max-width:480px;margin:0 auto;padding:24px 20px 40px;min-height:100vh;display:flex;flex-direction:column}
  .head{display:flex;align-items:center;gap:10px;margin-bottom:6px}
  .logo{width:30px;height:30px;border-radius:8px;background:var(--orange);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800}
  h1{font-size:22px;margin:14px 0 4px}
  .sub{color:var(--muted);font-size:15px;margin:0 0 18px}
  .prog{font-size:13px;color:var(--muted);margin-bottom:10px}
  .card{background:#fff;border:1px solid var(--line);border-radius:16px;padding:22px;box-shadow:0 2px 8px rgba(0,0,0,.06)}
  .ico{font-size:34px}
  .cname{font-size:20px;font-weight:700;margin:10px 0 2px}
  .cblurb{color:var(--muted);margin:0 0 18px}
  label{display:block;font-size:13px;font-weight:600;color:#334155;margin:12px 0 6px}
  input{width:100%;padding:13px 14px;border:1px solid #CBD5E1;border-radius:10px;font-size:16px}
  input:focus{outline:none;border-color:var(--orange);box-shadow:0 0 0 3px rgba(251,91,30,.15)}
  .help{font-size:12px;color:var(--muted);margin-top:8px;line-height:1.4}
  .btn{width:100%;padding:14px;border:none;border-radius:12px;font-size:16px;font-weight:700;cursor:pointer;margin-top:18px;background:var(--orange);color:#fff}
  .btn:active{transform:scale(.99)}
  .btn[disabled]{opacity:.55}
  .skip{display:block;width:100%;background:none;border:none;color:var(--muted);font-size:15px;margin-top:14px;cursor:pointer;text-decoration:underline}
  .done{text-align:center;padding:40px 0}
  .done .big{font-size:46px}
  .pill{display:inline-flex;align-items:center;gap:6px;background:#D1FAE5;color:#065F46;font-size:12px;font-weight:600;padding:4px 10px;border-radius:999px;margin-top:6px}
  .lock{font-size:12px;color:var(--muted);text-align:center;margin-top:18px}
  .err{color:#B91C1C;font-size:13px;margin-top:10px;min-height:16px}
</style></head>
<body>
<div class="wrap">
  <div class="head"><div class="logo">F</div><strong>Flynn</strong></div>
  <h1>Connect your tools</h1>
  <p class="sub">Hook these up once and I'll handle the busywork from your texts.</p>
  <div class="prog" id="prog"></div>
  <div id="stage"></div>
  <div class="lock">🔒 Logins are encrypted and never sent over text.</div>
</div>
<script>
const STATE = ${data};
let i = 0;
const stage = document.getElementById('stage');
const prog = document.getElementById('prog');
const items = STATE.items;

function esc(s){return String(s||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}

function render(){
  // skip already-connected, advance to next actionable
  while(i < items.length && items[i].connected) i++;
  if(i >= items.length){ return done(); }
  const it = items[i];
  prog.textContent = 'Step ' + (i+1) + ' of ' + items.length;
  if(it.kind === 'email'){
    const T = encodeURIComponent(STATE.token);
    stage.innerHTML =
      '<div class="card"><div class="ico">📧</div>'+
      '<div class="cname">Email</div><p class="cblurb">Connect the email you use for work, I\\'ll find and send from it.</p>'+
      '<a class="btn" style="display:block;text-align:center;text-decoration:none;background:#EA4335" href="/setup/oauth/google-mail?t='+T+'">Gmail / Google Workspace</a>'+
      '<a class="btn" style="display:block;text-align:center;text-decoration:none;background:#0072C6" href="/setup/oauth/outlook?t='+T+'">Outlook / Microsoft 365</a>'+
      '<button class="btn" style="background:#475569" onclick="emailOther()">Another email (Bigpond, iCloud…)</button>'+
      '<button class="skip" onclick="next()">Skip for now</button></div>';
  } else if(it.kind === 'oauth'){
    stage.innerHTML =
      '<div class="card"><div class="ico">'+it.icon+'</div>'+
      '<div class="cname">'+esc(it.name)+'</div><p class="cblurb">'+esc(it.blurb)+'</p>'+
      '<a class="btn" style="display:block;text-align:center;text-decoration:none" href="/setup/oauth/'+encodeURIComponent(it.nango)+'?t='+encodeURIComponent(STATE.token)+'">Connect '+esc(it.name)+'</a>'+
      '<button class="skip" onclick="next()">Skip for now</button></div>';
  } else {
    stage.innerHTML =
      '<div class="card"><div class="ico">'+it.icon+'</div>'+
      '<div class="cname">'+esc(it.name)+'</div><p class="cblurb">'+esc(it.blurb)+'</p>'+
      '<label>'+esc(it.userLabel||'Email')+'</label><input id="email" type="text" autocomplete="username" autocapitalize="none" inputmode="email">'+
      '<label>'+esc(it.passLabel||'Password')+'</label><input id="password" type="password" autocomplete="current-password">'+
      (it.help?'<p class="help">'+esc(it.help)+'</p>':'')+
      '<div class="err" id="err"></div>'+
      '<button class="btn" id="save" onclick="saveCred()">Connect '+esc(it.name)+'</button>'+
      '<button class="skip" onclick="next()">Skip for now</button></div>';
  }
}
function next(){ i++; render(); }
function emailOther(){
  stage.innerHTML =
    '<div class="card"><div class="ico">📧</div>'+
    '<div class="cname">Your email</div><p class="cblurb">Bigpond, iCloud, Optus, or your own business domain.</p>'+
    '<label>Email address</label><input id="email" type="text" autocomplete="username" autocapitalize="none" inputmode="email">'+
    '<label>App password</label><input id="password" type="password" autocomplete="current-password">'+
    '<p class="help">Use an app password from your email provider\\'s security settings. Bigpond and iCloud require one, your normal password won\\'t work for apps.</p>'+
    '<div class="err" id="err"></div>'+
    '<button class="btn" id="save" onclick="saveImap()">Connect email</button>'+
    '<button class="skip" onclick="render()">Back</button></div>';
}
async function saveImap(){
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const err = document.getElementById('err');
  const btn = document.getElementById('save');
  if(!email || !password){ err.textContent='Enter both fields.'; return; }
  btn.disabled=true; btn.textContent='Connecting…'; err.textContent='';
  try{
    const r = await fetch('/setup/credential',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({t:STATE.token,provider:'imap-email',email,password})});
    const j = await r.json();
    if(j.ok){ items[i].connected=true; next(); }
    else { err.textContent=j.error||'Couldn\\'t save that, double-check and try again.'; btn.disabled=false; btn.textContent='Connect email'; }
  }catch(e){ err.textContent='Something went wrong, try again.'; btn.disabled=false; btn.textContent='Connect email'; }
}
function done(){
  prog.textContent='';
  stage.innerHTML='<div class="done"><div class="big">✅</div><h1>All set</h1>'+
    '<p class="sub">Head back to Messages — Flynn can do this stuff for you now.</p></div>';
}
async function saveCred(){
  const it = items[i];
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const err = document.getElementById('err');
  const btn = document.getElementById('save');
  if(!email || !password){ err.textContent='Enter both fields.'; return; }
  btn.disabled=true; btn.textContent='Connecting…'; err.textContent='';
  try{
    const r = await fetch('/setup/credential',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({t:STATE.token,provider:it.provider,email,password})});
    const j = await r.json();
    if(j.ok){ it.connected=true; next(); }
    else { err.textContent='Couldn\\'t save that, double-check and try again.'; btn.disabled=false; btn.textContent='Connect '+it.name; }
  }catch(e){ err.textContent='Something went wrong, try again.'; btn.disabled=false; btn.textContent='Connect '+it.name; }
}
render();
</script>
</body></html>`;
}

module.exports = router;
