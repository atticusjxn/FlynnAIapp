// services/filmSeed.js
//
// Org-keyed backdated history for a demo shoot.
//
// services/demoAccount.js seeds the *iMessage-era* persona: every row it writes
// is keyed by `user_phone` with no org_id. The iOS app reads the org spine
// (InvoicesRepository / ClientsRepository / OrgResolver all filter on org_id),
// so that seed leaves the app looking like a fresh install. This module fills
// that gap: it writes clients / jobs / invoices / parts_orders against the org
// of a real, freshly-signed-up phone number, backdated, so the app looks lived
// in on camera.
//
// Deliberately does NOT touch business_brain or business_profiles: on a shoot
// the operator configures the business live on the funnel call, and clobbering
// that afterwards would undo the take.
//
// Every row carries a marker so re-seeding between takes wipes only what this
// module wrote and never the operator's real data.

const { sendPushNotificationsToUser } = require('../notifications/pushService');
const crypto = require('crypto');

const FILM_MARKER = '[film-seed]';
const PARTS_MARKER = 'FILM-SEED';

const token = () => crypto.randomBytes(9).toString('base64url');
const daysAgoIso = (n) => new Date(Date.now() - n * 86400000).toISOString();
const daysAgoDate = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
const daysAheadDate = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const money = (cents, currency = 'AUD') =>
  `$${(cents / 100).toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

// ---------------------------------------------------------------------------
// Default profile — a one-man Brisbane decking business (Jake's Decking), the
// persona the demo narrates. Override any part of it via the director
// endpoint's `profile` body so the shoot can be re-cut (different trade, names,
// amounts) without a redeploy.
//
// `overdue: true` marks the invoice the chase beat fires on. Exactly one.
// ---------------------------------------------------------------------------
const DEFAULT_PROFILE = {
  currency: 'AUD',
  clients: [
    { key: 'dave',  name: 'Dave Mullins',     phone: '+61412330184', address: '8 Kedron Park Rd, Wooloowin', last_job_type: 'Deck rebuild',       total_jobs: 3, last_job_days_ago: 14 },
    { key: 'priya', name: 'Priya Raman',      phone: '+61423771905', address: '14 Miller St, Bardon',        last_job_type: 'Deck repair',        total_jobs: 1, last_job_days_ago: 9 },
    { key: 'tom',   name: 'Tom Kelleher',     phone: '+61438220716', address: '3/61 Ferny Ave, Ashgrove',    last_job_type: 'Pergola',            total_jobs: 2, last_job_days_ago: 21 },
    { key: 'megan', name: 'Megan Achterberg', phone: '+61402886331', address: '77 Days Rd, Grange',          last_job_type: 'Restain and reseal', total_jobs: 1, last_job_days_ago: 4 },
  ],
  jobs: [
    { client: 'dave',  title: 'Deck rebuild — Wooloowin',       service_type: 'Decking', status: 'completed', days_ago: 14, time: '07:30' },
    { client: 'priya', title: 'Deck repair — Bardon',           service_type: 'Decking', status: 'completed', days_ago: 9,  time: '08:00' },
    { client: 'megan', title: 'Restain and reseal — Grange',    service_type: 'Decking', status: 'completed', days_ago: 4,  time: '13:00' },
    { client: 'tom',   title: 'Pergola build — Ashgrove',       service_type: 'Decking', status: 'scheduled', days_ahead: 3, time: '09:00' },
  ],
  invoices: [
    {
      client: 'priya', title: 'Deck repair — Bardon', days_ago: 9, status: 'paid', paid_days_ago: 7,
      line_items: [
        { description: 'Replace rotted boards and joists', quantity: 1, unit_price: 680 },
        { description: 'Merbau decking boards',            quantity: 14, unit_price: 12.5 },
      ],
    },
    {
      client: 'megan', title: 'Restain and reseal — Grange', days_ago: 4, status: 'paid', paid_days_ago: 2,
      line_items: [
        { description: 'Sand, restain and reseal (1 day)', quantity: 1, unit_price: 540 },
      ],
    },
    {
      // The chase beat fires on this one. Sent 13 days ago on 7-day terms, so
      // it lands exactly 6 days past due — the number the demo script says.
      client: 'dave', title: 'Deck rebuild — Wooloowin', days_ago: 13, status: 'sent', overdue: true,
      line_items: [
        { description: 'Deck rebuild, labour (3 days)', quantity: 3, unit_price: 340 },
        { description: 'Treated pine frame and bearers', quantity: 1, unit_price: 220 },
      ],
    },
  ],
  parts_order: {
    supplier: 'Bunnings',
    days_ago: 5,
    status: 'picked_up',
    line_items: [
      { description: 'Treated pine 90x45 (2.4m)', quantity: 18, unit_price: 12.9 },
      { description: 'Decking screws 10g (500pk)', quantity: 2, unit_price: 46 },
    ],
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Resolve the signed-up operator: their users row, and the org the iOS app
// reads through (users.default_org_id — same source as OrgResolver.swift).
async function resolveTarget(phone, supabase) {
  const { data, error } = await supabase
    .from('users')
    .select('id, phone, default_org_id')
    .eq('phone', phone)
    .maybeSingle();

  if (error) throw new Error(`user lookup failed: ${error.message}`);
  if (!data) throw new Error(`no user row for ${phone} — sign up on the funnel first`);
  if (!data.default_org_id) throw new Error(`user ${phone} has no default_org_id — the org trigger has not run`);

  return { userId: data.id, orgId: data.default_org_id };
}

async function insertRow(supabase, table, row, label, select = 'id') {
  const { data, error } = await supabase.from(table).insert(row).select(select).single();
  if (error) {
    console.warn(`[film] ${label} insert failed:`, error.message);
    return null;
  }
  return data;
}

function lineItemTotals(items) {
  const priced = items.map((li) => ({
    description: li.description,
    quantity: li.quantity,
    unit_price: li.unit_price,
    total: Math.round(li.quantity * li.unit_price * 100) / 100,
  }));
  const subtotal = Math.round(priced.reduce((sum, li) => sum + li.total, 0) * 100) / 100;
  return { priced, subtotal };
}

// Wipe only rows this module wrote. Marker-scoped rather than org-scoped so a
// re-seed between takes can never touch anything the operator created live on
// camera (the hero invoice, the job the receptionist booked).
async function wipeFilmSeed(orgId, supabase) {
  const wipes = [
    supabase.from('invoices').delete().eq('org_id', orgId).like('notes', `%${FILM_MARKER}%`),
    supabase.from('parts_orders').delete().eq('org_id', orgId).eq('confirmation_ref', PARTS_MARKER),
    supabase.from('jobs').delete().eq('org_id', orgId).like('notes', `%${FILM_MARKER}%`),
    supabase.from('clients').delete().eq('org_id', orgId).like('notes', `%${FILM_MARKER}%`),
  ];
  // Sequential: invoices and jobs reference clients, so order matters.
  for (const w of wipes) {
    await w.then(() => {}, (e) => console.warn('[film] wipe failed:', e?.message));
  }
}

// ---------------------------------------------------------------------------
// wipe — clean slate for a funnel take
//
// Clears BOTH this module's org-keyed seed and the leftovers from the
// LATITUDE-era demo persona (phone-keyed rows written by demoAccount.js), then
// resets the user row so the funnel call configures the business from scratch
// and the app opens empty on camera. Repeatable between takes.
//
// `is_demo` is deliberately LEFT ON: it's what puts order_parts and the email
// tools on the simulated path (services/agent/toolRegistry.js SIMULATED_TOOLS),
// which both makes the parts beat work without a real supplier account and
// stops a chase firing a real SMS at the fictional client numbers seeded below.
// ---------------------------------------------------------------------------
async function wipeForFunnelTake(phone, { supabase, clearDemoFlag = false } = {}) {
  if (!supabase) throw new Error('supabase not configured');
  const { userId, orgId } = await resolveTarget(phone, supabase);

  const deleted = {};
  const del = async (table, apply) => {
    const { error, count } = await apply(
      supabase.from(table).delete({ count: 'exact' })
    );
    deleted[table] = error ? `error: ${error.message}` : (count ?? 0);
  };

  // Phone-keyed demo-persona rows (demoAccount.js WIPE_TABLES + invoices).
  for (const table of ['pending_actions', 'agent_quotes', 'agent_invoices',
                       'job_photo_buffer', 'sms_messages', 'weather_nudges', 'invoices']) {
    await del(table, (q) => q.eq('user_phone', phone));
  }

  // Org-keyed seed from this module.
  await del('parts_orders', (q) => q.eq('org_id', orgId).eq('confirmation_ref', PARTS_MARKER));
  await del('jobs', (q) => q.eq('org_id', orgId).like('notes', `%${FILM_MARKER}%`));
  await del('clients', (q) => q.eq('org_id', orgId).like('notes', `%${FILM_MARKER}%`));

  // Staged funnel sessions, so a re-shoot starts the call flow fresh.
  await del('voice_onboarding_sessions', (q) => q.eq('caller_phone', phone));

  // Reset the operator row to pre-onboarding, matching what a web signup
  // writes (routes/webSignup.js) so the funnel treats them as new.
  const patch = {
    business_brain: null,
    signup_source: null,
    onboarding_step: 'brain_pending',
  };
  if (clearDemoFlag) patch.is_demo = false;

  const { error: userErr } = await supabase.from('users').update(patch).eq('id', userId);

  return {
    org_id: orgId,
    user_id: userId,
    deleted,
    user_reset: userErr ? `error: ${userErr.message}` : patch,
    is_demo: clearDemoFlag ? false : true,
  };
}

// ---------------------------------------------------------------------------
// seed — backdated org-keyed history
// ---------------------------------------------------------------------------
async function seedFilmHistory(phone, { supabase, profile: override = {} } = {}) {
  if (!supabase) throw new Error('supabase not configured');

  const profile = { ...DEFAULT_PROFILE, ...override };
  const currency = profile.currency || 'AUD';
  const { userId, orgId } = await resolveTarget(phone, supabase);

  await wipeFilmSeed(orgId, supabase);

  // --- clients -------------------------------------------------------------
  const clientIds = {};
  for (const c of profile.clients || []) {
    const row = await insertRow(supabase, 'clients', {
      org_id: orgId,
      user_id: userId, // clients.user_id is NOT NULL (pre-org-spine shape)
      name: c.name,
      phone: c.phone || null,
      email: c.email || null,
      address: c.address || null,
      notes: FILM_MARKER,
      total_jobs: c.total_jobs ?? 1,
      last_job_type: c.last_job_type || null,
      last_job_date: c.last_job_days_ago != null ? daysAgoIso(c.last_job_days_ago) : null,
      created_at: daysAgoIso((c.last_job_days_ago ?? 10) + 30),
    }, `client ${c.name}`);
    if (row?.id) clientIds[c.key] = row.id;
  }

  // --- jobs ----------------------------------------------------------------
  const jobIds = {};
  for (const j of profile.jobs || []) {
    const client = (profile.clients || []).find((c) => c.key === j.client);
    const scheduledDate = j.days_ahead != null ? daysAheadDate(j.days_ahead) : daysAgoDate(j.days_ago ?? 0);
    const row = await insertRow(supabase, 'jobs', {
      org_id: orgId,
      user_id: userId, // jobs.user_id is NOT NULL (pre-org-spine shape, like clients)
      client_id: clientIds[j.client] || null,
      client_name: client?.name || null,
      title: j.title,
      service_type: j.service_type || null,
      status: j.status || 'completed',
      scheduled_date: scheduledDate,
      scheduled_time: j.time || null,
      scheduled_at: `${scheduledDate}T${(j.time || '09:00')}:00+10:00`,
      location: client?.address || null,
      notes: FILM_MARKER,
      created_at: j.days_ahead != null ? daysAgoIso(2) : daysAgoIso((j.days_ago ?? 0) + 1),
    }, `job ${j.title}`);
    if (row?.id) jobIds[j.client] = row.id;
  }

  // --- invoices ------------------------------------------------------------
  let overdueInvoice = null;
  let invoiceSeq = 1041;
  for (const inv of profile.invoices || []) {
    const client = (profile.clients || []).find((c) => c.key === inv.client);
    const { priced, subtotal } = lineItemTotals(inv.line_items || []);
    const isPaid = inv.status === 'paid';
    const issued = daysAgoDate(inv.days_ago ?? 0);

    const row = await insertRow(supabase, 'invoices', {
      org_id: orgId,
      user_phone: phone, // keeps the phone-keyed agent tools able to find it
      client_id: clientIds[inv.client] || null,
      job_id: jobIds[inv.client] || null,
      client_name: client?.name || null,
      client_handle: client?.name ? client.name.toLowerCase() : null,
      client_email: inv.client_email || null,
      invoice_number: `INV-${invoiceSeq++}`,
      title: inv.title,
      line_items: priced,
      subtotal,
      tax_rate: 0,
      tax_amount: 0,
      total: subtotal,
      amount_paid: isPaid ? subtotal : 0,
      amount_due: isPaid ? 0 : subtotal,
      currency,
      public_token: token(),
      status: isPaid ? 'paid' : 'sent',
      issued_date: issued,
      due_date: daysAgoDate((inv.days_ago ?? 0) - 7), // 7-day terms
      sent_at: daysAgoIso(inv.days_ago ?? 0),
      paid_at: isPaid ? daysAgoIso(inv.paid_days_ago ?? 0) : null,
      notes: FILM_MARKER,
      created_at: daysAgoIso(inv.days_ago ?? 0),
    }, `invoice ${inv.title}`, 'id, client_name, client_email, total, currency, public_token');

    if (row && inv.overdue) overdueInvoice = row;
  }

  // --- parts order (simulated supplier order) -------------------------------
  if (profile.parts_order) {
    const po = profile.parts_order;
    const { priced, subtotal } = lineItemTotals(po.line_items || []);
    await insertRow(supabase, 'parts_orders', {
      org_id: orgId,
      supplier: po.supplier,
      line_items: priced,
      cart_total_cents: Math.round(subtotal * 100),
      status: po.status || 'placed',
      confirmation_ref: PARTS_MARKER,
      created_at: daysAgoIso(po.days_ago ?? 3),
    }, `parts order ${po.supplier}`);
  }

  return {
    org_id: orgId,
    user_id: userId,
    clients: Object.keys(clientIds).length,
    jobs: Object.keys(jobIds).length,
    invoices: (profile.invoices || []).length,
    overdue_invoice_id: overdueInvoice?.id || null,
  };
}

// ---------------------------------------------------------------------------
// app_chase — the overdue nudge as a PUSH notification (not a text)
//
// The demo beat is Flynn raising it unprompted while the operator is working on
// something else, so it has to arrive on the lock screen. Also parks the
// pending_action so answering "yes" in the agent bar resolves to a real chase.
// ---------------------------------------------------------------------------
async function fireAppChase(phone, { supabase } = {}) {
  if (!supabase) throw new Error('supabase not configured');
  const { userId, orgId } = await resolveTarget(phone, supabase);

  // Prefer the seeded overdue invoice; fall back to the newest unpaid one so
  // the beat still works if the operator invoiced someone live on camera.
  const columns = 'id, client_name, client_email, total, currency, public_token, sent_at, due_date';
  let { data: inv } = await supabase
    .from('invoices')
    .select(columns)
    .eq('org_id', orgId)
    .neq('status', 'paid')
    .like('notes', `%${FILM_MARKER}%`)
    .order('sent_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!inv) {
    const { data } = await supabase
      .from('invoices')
      .select(columns)
      .eq('org_id', orgId)
      .neq('status', 'paid')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    inv = data;
  }
  if (!inv) throw new Error('no unpaid invoice to chase');

  const totalCents = Math.round(Number(inv.total || 0) * 100);
  // Overdue counts from the due date, not the send date — an invoice inside its
  // payment terms isn't late, and the on-screen number has to survive scrutiny.
  const reference = inv.due_date || inv.sent_at;
  // floor, not round: due_date is a date (midnight), so rounding ticks over to
  // the next day by lunchtime and the invoice reads a day later than it is.
  const daysOverdue = reference
    ? Math.max(1, Math.floor((Date.now() - new Date(reference).getTime()) / 86400000))
    : 6;
  const firstName = String(inv.client_name || 'that client').split(' ')[0];
  const amount = money(totalCents, inv.currency);
  const body = `${firstName}'s ${amount} invoice is ${daysOverdue} days overdue. Want me to chase it?`;

  // Park the action so "yes" in the agent bar resolves against a real invoice.
  const toolArgs = {
    invoices: [{
      invoice_id: inv.id,
      client_name: inv.client_name,
      client_email: inv.client_email || null,
      total_cents: totalCents,
      currency: inv.currency || 'AUD',
      public_token: inv.public_token,
    }],
  };
  await supabase.from('pending_actions').delete()
    .eq('user_phone', phone).eq('tool_name', 'chase_invoice').eq('status', 'awaiting_confirmation')
    .then(() => {}, () => {});
  await supabase.from('pending_actions').insert({
    user_phone: phone,
    action_type: 'chase_invoice',
    action_data: toolArgs,
    confirmation_message: body,
    status: 'awaiting_confirmation',
    tool_name: 'chase_invoice',
    tool_args: toolArgs,
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  }).then(() => {}, (e) => console.warn('[film] park chase failed:', e?.message));

  const push = await sendPushNotificationsToUser({
    userId,
    title: 'Unpaid invoice',
    body,
    data: { type: 'invoice_chase', invoiceId: inv.id },
  });

  return { invoice_id: inv.id, days_overdue: daysOverdue, body, push };
}

// ---------------------------------------------------------------------------
// status — confirm a seed landed without opening the app
// ---------------------------------------------------------------------------
async function filmStatus(phone, { supabase } = {}) {
  if (!supabase) throw new Error('supabase not configured');
  const { userId, orgId } = await resolveTarget(phone, supabase);

  const count = async (table) => {
    const q = table === 'parts_orders'
      ? supabase.from(table).select('id', { count: 'exact', head: true }).eq('org_id', orgId).eq('confirmation_ref', PARTS_MARKER)
      : supabase.from(table).select('id', { count: 'exact', head: true }).eq('org_id', orgId).like('notes', `%${FILM_MARKER}%`);
    const { count: n, error } = await q;
    return error ? `error: ${error.message}` : n;
  };

  const { data: tokens } = await supabase
    .from('notification_tokens')
    .select('platform')
    .eq('user_id', userId);

  return {
    org_id: orgId,
    user_id: userId,
    seeded: {
      clients: await count('clients'),
      jobs: await count('jobs'),
      invoices: await count('invoices'),
      parts_orders: await count('parts_orders'),
    },
    push_tokens: (tokens || []).map((t) => t.platform),
  };
}

module.exports = { seedFilmHistory, fireAppChase, filmStatus, wipeForFunnelTake, DEFAULT_PROFILE };
