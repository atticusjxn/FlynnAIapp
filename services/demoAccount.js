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
const DEMO_PHOTO = 'https://flynnai.app/after.jpg';
const WIPE_TABLES = ['pending_actions', 'agent_quotes', 'agent_invoices', 'job_photo_buffer', 'sms_messages', 'weather_nudges'];
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
    // bank details so the hosted invoice renders a pay block
    bank_bsb: '064-000',
    bank_account: '1234 5678',
    bank_account_name: "James's Yards & Decks",
    // upcoming jobs the weather nudge reads (one outdoor, ~2 days out)
    _demo_jobs: [
      { summary: 'Toowoomba deck restain', location: 'Toowoomba', date: daysAheadDate(2), time: '08:00', outdoor: true },
      { summary: 'Hendra fence repair', location: 'Hendra', date: daysAheadDate(4), time: '09:00', outdoor: true },
    ],
    onboarding_complete: true,
  };
}

async function provisionDemoAccount(phone, { supabase, channel = 'imessage' } = {}) {
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

  // Seed the overdue Henderson invoice so "chase the henderson invoice" works
  // and the proactive overdue nudge has something real to reference.
  const invToken = token();
  let invoiceId = null;
  const { data: invRow } = await supabase.from('agent_invoices').insert({
    user_phone: phone,
    client_name: 'Henderson',
    client_handle: 'henderson',
    client_email: process.env.DEMO_CLIENT_EMAIL || null,
    line_items: [{ description: 'Deck rebuild', amount_cents: 240000 }],
    subtotal_cents: 240000,
    tax_cents: 0,
    total_cents: 240000,
    currency: 'AUD',
    photo_urls: [DEMO_PHOTO],
    public_token: invToken,
    status: 'sent',
    sent_at: daysAgoIso(4),
    created_at: daysAgoIso(4),
  }).select('id').single().then((r) => r, (e) => { console.warn('[demo] invoice seed failed:', e?.message); return { data: null }; });
  if (invRow?.id) invoiceId = invRow.id;

  // Welcome sequence — plain text, holds up over SMS.
  await sendToUser(phone, sanitiseReply("you're all set up as james. you run a landscaping and decking business in brisbane, and you've got real jobs and an overdue invoice loaded. have a go at a few things:"), { channel, supabase });
  await sendToUser(phone, sanitiseReply("text 'chase the henderson invoice', or 'order some treated pine decking for the toowoomba job' and i'll price it up across your suppliers, or send a photo of any job and i'll make you an invoice. i'll also flag a couple of things to you off my own bat."), { channel, supabase });

  // Accelerated proactivity — two unprompted nudges so the reviewer sees Flynn
  // come to THEM (matches the demo video's "4 days later" + "Thursday morning"
  // beats). Staggered so each parks its own action and a "yes" resolves the most
  // recent one. Invoice chase first (the money story), then the weather nudge.
  setTimeout(() => {
    fireInvoiceChaseNudge(phone, { supabase, channel, invoiceId, token: invToken }).catch((e) => console.warn('[demo] invoice nudge failed:', e?.message));
  }, INVOICE_NUDGE_DELAY_MS);
  setTimeout(() => {
    weatherScheduler.nudgeUserNow(phone, { demo: true }).catch((e) => console.warn('[demo] weather nudge failed:', e?.message));
  }, WEATHER_NUDGE_DELAY_MS);
}

// Proactively flag the overdue Henderson invoice and park a chase_invoice
// action so "yep" chases it (simulated email in demo). Mirrors what the real
// invoice chaser would do, fired early for the demo.
async function fireInvoiceChaseNudge(phone, { supabase, channel, invoiceId, token: invToken }) {
  const message = "heads up, henderson's $2,400 invoice is 4 days overdue and still unpaid. want me to chase it?";
  await sendToUser(phone, sanitiseReply(message), { channel, supabase });

  const toolArgs = {
    invoices: [{
      invoice_id: invoiceId,
      client_name: 'Henderson',
      client_email: process.env.DEMO_CLIENT_EMAIL || null,
      total_cents: 240000,
      currency: 'AUD',
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

module.exports = { provisionDemoAccount, isDemoCode, DEMO_CODE };
