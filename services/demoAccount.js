// services/demoAccount.js
//
// Reviewer demo account. Texting the demo code (LATITUDE) from any phone
// provisions a fully-seeded "James the Brisbane tradie" persona — no signup, no
// OAuth — so a reviewer experiences every beat (chase an overdue invoice, send
// a photo invoice, order parts, get a proactive weather nudge) on a realistic
// account. is_demo makes tools behave as connected and simulates external side
// effects (see toolRegistry SIMULATED_TOOLS). Re-texting the code resets it.

const crypto = require('crypto');
const { sendToUser } = require('./flynnOutbound');
const { sanitiseReply } = require('./flynnTone');
const weatherScheduler = require('./weatherScheduler');

const DEMO_CODE = (process.env.DEMO_CODE || 'LATITUDE').trim().toLowerCase();
const DEMO_PHOTO = 'https://flynnai.app/img-03-768x768.jpg';

// James's Yards & Decks logo — a bold leaf emblem in a circular green badge.
// Inlined as a data URI so the invoice renders it instantly (no image fetch) on
// camera. The hosted invoice reads business_brain.logo_url.
const JAMES_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2E9259"/><stop offset="1" stop-color="#185C37"/></linearGradient></defs><circle cx="32" cy="32" r="32" fill="url(#a)"/><g transform="rotate(-15 32 32)"><path d="M32 11 C47 19 47 43 32 53 C17 43 17 19 32 11 Z" fill="#F3F9F4"/><path d="M32 16 L32 48" stroke="#1E7445" stroke-width="3" stroke-linecap="round"/><path d="M32 25 L24 21" stroke="#1E7445" stroke-width="2.4" stroke-linecap="round"/><path d="M32 25 L40 21" stroke="#1E7445" stroke-width="2.4" stroke-linecap="round"/><path d="M32 34 L24 30" stroke="#1E7445" stroke-width="2.4" stroke-linecap="round"/><path d="M32 34 L40 30" stroke="#1E7445" stroke-width="2.4" stroke-linecap="round"/></g></svg>`;
const JAMES_LOGO_DATA_URI = `data:image/svg+xml;base64,${Buffer.from(JAMES_LOGO_SVG).toString('base64')}`;
const WIPE_TABLES = ['pending_actions', 'agent_quotes', 'agent_invoices', 'invoices', 'job_photo_buffer', 'sms_messages', 'weather_nudges'];
const INVOICE_NUDGE_DELAY_MS = 40 * 1000;  // first proactive nudge (the money story)
const WEATHER_NUDGE_DELAY_MS = 130 * 1000; // second, staggered so each "yes" resolves cleanly

function isDemoCode(body) {
  return String(body || '').trim().toLowerCase() === DEMO_CODE;
}

const token = () => crypto.randomBytes(9).toString('base64url');
const daysAgoIso = (n) => new Date(Date.now() - n * 86400000).toISOString();
const daysAheadDate = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

function demoBrain() {
  return {
    business_type: 'landscaper',
    business_name: "James's Yards & Decks",
    logo_url: JAMES_LOGO_DATA_URI,
    location: 'Brisbane, QLD',
    service_area: 'Brisbane + Toowoomba',
    services: ['decking', 'landscaping', 'painting', 'fencing'],
    pricing_model: 'hourly',
    hourly_rate_cents: 9500,
    callout_fee_cents: 8000,
    suppliers: ['bunnings', 'reece'],
    currency: 'AUD',
    email_provider: 'gmail',
    calendar_provider: 'google',
    // No bank/PayID details on purpose: the demo invoice shows "awaiting
    // payment" but keeps the payment rail OFF camera (a payments reviewer
    // shouldn't be prompted to ask "whose rail / are you licensed?"). The
    // money-movement story stays implied via the chase + paid beats.
    // upcoming jobs the weather nudge reads (one outdoor, ~2 days out). Summary
    // is kept location-free so the nudge reads cleanly ("painting job in
    // toowoomba", not "toowoomba ... in toowoomba").
    _demo_jobs: [
      { summary: 'painting job', location: 'Toowoomba', date: daysAheadDate(2), time: '08:00', outdoor: true },
      { summary: 'fence repair', location: 'Hendra', date: daysAheadDate(4), time: '09:00', outdoor: true },
    ],
    onboarding_complete: true,
  };
}

async function provisionDemoAccount(phone, { supabase, channel = 'imessage', film = false } = {}) {
  if (!supabase) return;

  // Reset any prior state for this phone so re-texting the code starts clean.
  for (const t of WIPE_TABLES) {
    await supabase.from(t).delete().eq('user_phone', phone).then(() => {}, () => {});
  }

  // Upsert the demo user (update if the row exists, else insert).
  const row = {
    phone,
    is_demo: true,
    signup_source: 'demo',
    preferred_channel: channel,
    onboarding_step: 'active', // skip onboarding so tools work immediately
    reengagement_opted_out: false,
    business_brain: demoBrain(),
  };
  const { data: existing } = await supabase.from('users').select('id').eq('phone', phone).maybeSingle();
  if (existing) {
    await supabase.from('users').update(row).eq('phone', phone).then(() => {}, (e) => console.warn('[demo] user update failed:', e?.message));
  } else {
    await supabase.from('users').insert(row).then(() => {}, (e) => console.warn('[demo] user insert failed:', e?.message));
  }

  // Film mode (director-driven shoot): clean slate, no welcome blurb, no
  // pre-seeded invoice, no auto-timer nudges. The operator creates the hero
  // invoice live on camera and the director endpoint fires each proactive beat
  // on cue, so the iMessage thread stays pristine and choreographable.
  if (film) return;

  // Seed an overdue invoice (keyed by job address, like a tradie refers to it)
  // so "chase the greens road invoice" works and the proactive overdue nudge has
  // something real to reference.
  const invToken = token();
  let invoiceId = null;
  const { data: invRow } = await supabase.from('invoices').insert({
    user_phone: phone,
    client_name: '23 Greens Road',
    client_handle: '23-greens-road',
    client_email: process.env.DEMO_CLIENT_EMAIL || null,
    title: '23 Greens Road',
    line_items: [{ description: 'Deck rebuild', quantity: 1, unit_price: 2400, total: 2400, amount_cents: 240000 }],
    subtotal: 2400,
    tax_rate: 0,
    tax_amount: 0,
    total: 2400,
    amount_paid: 0,
    amount_due: 2400,
    currency: 'AUD',
    photo_urls: [DEMO_PHOTO],
    public_token: invToken,
    status: 'sent',
    issued_date: new Date().toISOString().slice(0, 10),
    sent_at: daysAgoIso(4),
    created_at: daysAgoIso(4),
  }).select('id').single().then((r) => r, (e) => { console.warn('[demo] invoice seed failed:', e?.message); return { data: null }; });
  if (invRow?.id) invoiceId = invRow.id;

  // Welcome sequence — plain text, holds up over SMS.
  await sendToUser(phone, sanitiseReply("you're all set up as james. you run a landscaping and decking business in brisbane, and you've got real jobs and an overdue invoice loaded. have a go at a few things:"), { channel, supabase });
  await sendToUser(phone, sanitiseReply("text 'chase the greens road invoice', or 'order some treated pine decking for the toowoomba job' and i'll price it up across your suppliers, or send a photo of any job and i'll make you an invoice. i'll also flag a couple of things to you off my own bat."), { channel, supabase });

  // Accelerated proactivity — two unprompted nudges so the reviewer sees Flynn
  // come to THEM (matches the demo video's "4 days later" + "Thursday morning"
  // beats). Staggered so each parks its own action and a "yes" resolves the most
  // recent one. Invoice chase first (the money story), then the weather nudge.
  setTimeout(() => {
    fireInvoiceChaseNudge(phone, { supabase, channel, invoiceId, token: invToken, clientName: '23 Greens Road', totalCents: 240000, currency: 'AUD' }).catch((e) => console.warn('[demo] invoice nudge failed:', e?.message));
  }, INVOICE_NUDGE_DELAY_MS);
  setTimeout(() => {
    weatherScheduler.nudgeUserNow(phone, { demo: true }).catch((e) => console.warn('[demo] weather nudge failed:', e?.message));
  }, WEATHER_NUDGE_DELAY_MS);
}

// Proactively flag the overdue invoice and park a chase_invoice action so "yep"
// chases it (simulated email in demo). Reads the real invoice's client + amount
// so it follows whatever job reference the operator used (a name like "sarah"
// or an address like "23 greens road"), phrased to read naturally either way.
async function fireInvoiceChaseNudge(phone, { supabase, channel, invoiceId, token: invToken, clientName = 'that job', totalCents = 240000, currency = 'AUD', clientEmail = null }) {
  const amount = `$${(totalCents / 100).toLocaleString('en-AU')}`;
  const label = String(clientName).toLowerCase();
  const message = `heads up, the ${amount} invoice for ${label} is 4 days overdue and still unpaid. want me to chase it?`;
  await sendToUser(phone, sanitiseReply(message), { channel, supabase });

  const toolArgs = {
    invoices: [{
      invoice_id: invoiceId,
      client_name: clientName,
      client_email: clientEmail || process.env.DEMO_CLIENT_EMAIL || null,
      total_cents: totalCents,
      currency,
      public_token: invToken,
    }],
  };
  await supabase.from('pending_actions').delete()
    .eq('user_phone', phone).eq('tool_name', 'chase_invoice').eq('status', 'awaiting_confirmation')
    .then(() => {}, () => {});
  await supabase.from('pending_actions').insert({
    user_phone: phone,
    action_type: 'chase_invoice',
    action_data: toolArgs,
    confirmation_message: message,
    status: 'awaiting_confirmation',
    tool_name: 'chase_invoice',
    tool_args: toolArgs,
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  }).then(() => {}, (e) => console.warn('[demo] park invoice chase failed:', e?.message));
}

// ---------------------------------------------------------------------------
// Director controls — fire each proactive beat ON CUE for a choreographed demo
// shoot (instead of the auto-timers). Driven by routes/demoDirector.js. Each
// produces ONLY Flynn's proactive message (no visible trigger in the thread).
// ---------------------------------------------------------------------------

// Fire the overdue-invoice chase nudge. Uses the operator's most recent unpaid
// invoice (the Henderson one they created live); seeds it backdated if none.
async function fireChase(phone, { supabase, channel = 'imessage' } = {}) {
  if (!supabase) return;
  let { data: inv } = await supabase
    .from('invoices')
    .select('id, public_token, client_name, client_email, total, currency')
    .eq('user_phone', phone)
    .neq('status', 'paid')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!inv) {
    const invToken = token();
    const { data } = await supabase.from('invoices').insert({
      user_phone: phone,
      client_name: '23 Greens Road',
      client_handle: '23-greens-road',
      client_email: process.env.DEMO_CLIENT_EMAIL || null,
      title: '23 Greens Road',
      line_items: [{ description: 'Deck rebuild', quantity: 1, unit_price: 2400, total: 2400, amount_cents: 240000 }],
      subtotal: 2400, tax_rate: 0, tax_amount: 0, total: 2400,
      amount_paid: 0, amount_due: 2400, currency: 'AUD',
      photo_urls: [DEMO_PHOTO], public_token: invToken,
      status: 'sent', sent_at: daysAgoIso(4), created_at: daysAgoIso(4),
      issued_date: new Date().toISOString().slice(0, 10),
    }).select('id, public_token, client_name, client_email, total, currency').single().then((r) => r, () => ({ data: null }));
    inv = data;
  }
  if (!inv) return;
  await fireInvoiceChaseNudge(phone, {
    supabase, channel,
    invoiceId: inv.id, token: inv.public_token,
    clientName: inv.client_name, totalCents: Math.round(Number(inv.total || 0) * 100),
    currency: inv.currency, clientEmail: inv.client_email,
  });
}

// Fire the hero weather-reschedule nudge for the seeded outdoor job.
async function fireWeather(phone, { supabase } = {}) {
  if (!supabase) return;
  await weatherScheduler.nudgeUserNow(phone, { demo: true });
}

// Fire the "client just paid" beat: mark the latest unpaid invoice paid and
// tell the operator. Lets the shoot control the paid moment instead of the
// 25s auto-follow inside chase_invoice.
async function firePaid(phone, { supabase, channel = 'imessage' } = {}) {
  if (!supabase) return;
  const { data: inv } = await supabase
    .from('invoices')
    .select('id, client_name, total, currency')
    .eq('user_phone', phone)
    .neq('status', 'paid')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!inv) return;
  await supabase.from('invoices')
    .update({
      status: 'paid', paid_at: new Date().toISOString(),
      amount_paid: inv.total, amount_due: 0,
      updated_at: new Date().toISOString(),
    })
    .eq('id', inv.id).then(() => {}, () => {});
  const amt = `$${Number(inv.total || 0).toLocaleString('en-AU')}`;
  const label = String(inv.client_name).toLowerCase();
  await sendToUser(phone, sanitiseReply(`that ${amt} from ${label} just landed, marked it off your books.`), { channel, supabase });
}

module.exports = { provisionDemoAccount, isDemoCode, DEMO_CODE, fireChase, fireWeather, firePaid };
