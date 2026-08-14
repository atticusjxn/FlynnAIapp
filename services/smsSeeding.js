/**
 * Number seeding — attribution and measurement.
 *
 * The problem this measures: inbound client SMS can only reach Flynn on a
 * number the client already has in their phone. AU carriers have no SMS
 * equivalent of the **61* conditional voice divert, and Twilio Hosted SMS
 * (voice stays with the carrier, SMS routes to Twilio) is US/Canada only — so
 * an org's Flynn number cannot be forwarded into, it has to be SEEDED: every
 * booking confirmation, invoice, quote and chase goes out from the org's own
 * number, landing a thread in the client's phone that they later reply to.
 * services/orgSmsSender.js is the send-side half of this.
 *
 * ── What can and cannot be measured ─────────────────────────────────────────
 * The tempting metric is "share of the client's texts that reach Flynn". That
 * is NOT computable: texts a client sends to the operator's personal mobile are
 * invisible to us by construction — that invisibility is the entire problem.
 * Any "share" number would silently use a denominator we cannot see.
 *
 * So the honest measure is a REPLY RATE on the population we can account for:
 *
 *   seeded_clients   distinct client numbers this org has texted FROM its own
 *                    Flynn number (the thread exists in their phone)
 *   replied_clients  distinct client numbers that have since texted that number
 *   seeding_rate     replied_clients / seeded_clients
 *
 * Both sides are directly observed, and the ratio answers the real question:
 * once a client has our thread, do they use it? Read the cohort curve, not a
 * single number — seeding compounds, so week 1 is meaningless and the shape
 * over weeks 1-8 is the signal. If the curve is flat by week 8, seeding does
 * not work and the strategy needs rethinking.
 *
 * Caveat worth remembering when reading the output: `seeded_clients` counts
 * threads created, not clients who still have them. It never decays.
 */

const { supabase: defaultSupabase } = require('../telephony/supabaseClient');

const normalize = (n) => (n ? String(n).replace(/[^\d+]/g, '') : '');

/** The shared platform number — Flynn-to-operator, never an org's identity. */
function platformNumbers() {
  return [process.env.TWILIO_FLYNN_NUMBER, process.env.TWILIO_FROM_NUMBER, process.env.TWILIO_SMS_FROM_NUMBER]
    .map(normalize)
    .filter(Boolean);
}

/**
 * Who sent this inbound message, and to which org's number?
 *
 * Classification is driven by the number it ARRIVED ON, not by the sender:
 * an org's Flynn number is only ever given out to that org's clients, so
 * traffic to it is client traffic unless the sender is the operator themselves.
 *
 * @param {{from: string, to: string, supabase?: any}} opts
 * @returns {Promise<{orgId: string|null, senderRole: 'boss'|'client'|'unknown', onOrgNumber: boolean, toNumber: string}>}
 */
async function classifyInbound({ from, to, supabase = defaultSupabase }) {
  const toNumber = normalize(to);
  const fromNumber = normalize(from);
  const result = { orgId: null, senderRole: 'unknown', onOrgNumber: false, toNumber };

  if (!supabase || !toNumber) return result;

  // Arrived on the shared platform number → this is the operator texting Flynn.
  if (platformNumbers().includes(toNumber)) {
    const { data: boss } = await supabase
      .from('users')
      .select('default_org_id')
      .eq('phone', fromNumber)
      .maybeSingle();
    result.orgId = boss?.default_org_id || null;
    result.senderRole = boss ? 'boss' : 'unknown';
    return result;
  }

  // Arrived on an assigned org number.
  const { data: owner } = await supabase
    .from('users')
    .select('id, phone, default_org_id')
    .eq('twilio_phone_number', toNumber)
    .maybeSingle();

  if (!owner) return result; // A number we don't recognise — leave it unknown.

  result.orgId = owner.default_org_id || null;
  result.onOrgNumber = true;
  // The operator texting their own Flynn number is not a client conversation.
  result.senderRole = normalize(owner.phone) === fromNumber ? 'boss' : 'client';
  return result;
}

/**
 * Record one message with full attribution. Never throws — logging must not
 * take down the message path it is observing.
 *
 * @param {{supabase?: any, phone: string, body: string, direction: 'in'|'out',
 *          toNumber?: string|null, orgId?: string|null,
 *          senderRole?: string|null, channel?: string|null}} opts
 */
async function recordMessage({
  supabase = defaultSupabase,
  phone,
  body,
  direction,
  toNumber = null,
  orgId = null,
  senderRole = null,
  channel = null,
}) {
  if (!supabase) return;
  const row = { user_phone: phone, direction, body };
  if (toNumber) row.to_number = normalize(toNumber);
  if (orgId) row.org_id = orgId;
  if (senderRole) row.sender_role = senderRole;
  if (channel) row.channel = channel;

  await supabase
    .from('sms_messages')
    .insert(row)
    .then(() => {}, (err) => console.warn('[smsSeeding] message log failed:', err?.message));
}

/**
 * Record a client-facing outbound send — the seeding half of the metric.
 *
 * This is what puts the org's number in the client's phone, so without it
 * `seeded_clients` is always zero and the cohort report reads as though nothing
 * works. Accepts `userId` as well as `orgId` because the send sites know one or
 * the other, not reliably both.
 *
 * Never throws: an analytics write must not fail a client's invoice.
 *
 * @param {{supabase?: any, to: string, body?: string, fromNumber?: string|null,
 *          orgId?: string|null, userId?: string|null}} opts
 */
async function recordClientSend({
  supabase = defaultSupabase,
  to,
  body = '',
  fromNumber = null,
  orgId = null,
  userId = null,
}) {
  if (!supabase || !to) return;
  try {
    let resolvedOrg = orgId;
    if (!resolvedOrg && userId) {
      const { data } = await supabase
        .from('users')
        .select('default_org_id')
        .eq('id', userId)
        .maybeSingle();
      resolvedOrg = data?.default_org_id || null;
    }

    // Only a send from the org's OWN number seeds anything — one from the
    // shared platform number leaves the client with a thread that belongs to
    // Flynn, not to the business, so it must not count toward seeded_clients.
    const from = normalize(fromNumber);
    if (!from || platformNumbers().includes(from)) return;

    await recordMessage({
      supabase,
      phone: to,
      body,
      direction: 'out',
      toNumber: from,
      orgId: resolvedOrg,
      senderRole: 'client',
      channel: 'sms',
    });
  } catch (err) {
    console.warn('[smsSeeding] client send log failed:', err?.message);
  }
}

/**
 * Seeding cohort report: per org, per week since its number was assigned, how
 * many clients have been seeded and how many have replied on that thread.
 *
 * Weeks are counted from `users.twilio_phone_number` assignment where we can
 * date it (falls back to the org's first outbound client SMS), because that is
 * when seeding becomes possible at all.
 *
 * @returns {Promise<Array<{org_id: string, week: number, seeded_clients: number,
 *          replied_clients: number, seeding_rate: number, inbound_messages: number}>>}
 */
async function seedingByCohort({ supabase = defaultSupabase, weeks = 12 } = {}) {
  if (!supabase) return [];

  const { data, error } = await supabase.rpc('sms_seeding_cohort', { p_weeks: weeks });
  if (error) {
    console.warn('[smsSeeding] cohort query failed:', error.message);
    return [];
  }
  return data || [];
}

/**
 * Whole-population summary, for the ops page header.
 * @returns {Promise<{seeded_clients: number, replied_clients: number, seeding_rate: number, orgs_with_number: number}>}
 */
async function seedingSummary({ supabase = defaultSupabase } = {}) {
  const rows = await seedingByCohort({ supabase });

  // Every column is cumulative through each week, so an org's true total is the
  // MAX across its weeks, not the sum — summing counts the same client once per
  // week and inflates the totals by the number of weeks reported.
  const byOrg = new Map();
  for (const r of rows) {
    const prev = byOrg.get(r.org_id) || { seeded: 0, replied: 0, inbound: 0 };
    byOrg.set(r.org_id, {
      seeded: Math.max(prev.seeded, Number(r.seeded_clients || 0)),
      replied: Math.max(prev.replied, Number(r.replied_clients || 0)),
      inbound: Math.max(prev.inbound, Number(r.inbound_messages || 0)),
    });
  }

  let totalSeeded = 0;
  let totalReplied = 0;
  let totalInbound = 0;
  for (const v of byOrg.values()) {
    totalSeeded += v.seeded;
    totalReplied += v.replied;
    totalInbound += v.inbound;
  }

  return {
    orgs_with_number: byOrg.size,
    seeded_clients: totalSeeded,
    replied_clients: totalReplied,
    seeding_rate: totalSeeded ? Number((totalReplied / totalSeeded).toFixed(3)) : 0,
    inbound_messages: totalInbound,
  };
}

module.exports = {
  classifyInbound,
  recordMessage,
  recordClientSend,
  seedingByCohort,
  seedingSummary,
  platformNumbers,
};
