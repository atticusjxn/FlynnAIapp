/**
 * Per-org SMS sender identity.
 *
 * Why this exists: every client-facing text Flynn sends (booking confirmation,
 * quote, invoice, reminder, chase) is also how the org's Flynn number gets into
 * the client's phone. A client who has a thread with that number replies to the
 * thread — they don't go looking up a number on a website. That reply lands on
 * Flynn, which is the only way inbound client text ever reaches us: AU carriers
 * have no SMS equivalent of the **61* conditional voice divert, and Twilio's
 * Hosted SMS (voice stays with the carrier, SMS routes to Twilio) is US/Canada
 * only. So the number cannot be forwarded into Flynn — it has to be *seeded*
 * outbound, one conversation at a time.
 *
 * That only works if every client-facing send goes out from the org's OWN
 * number. Sending from a shared platform number seeds nothing: the client ends
 * up with a thread belonging to Flynn-the-vendor rather than to the business
 * they hired, and their reply is unattributable.
 *
 * Source of truth is `users.twilio_phone_number` (unique-indexed, assigned in
 * routes/voiceOnboarding.js). The org-spine `phone_numbers` table exists but is
 * empty — nothing writes it yet, so it is deliberately not consulted here; when
 * number assignment moves onto it, change `lookup()` and nothing else.
 *
 * NOT for boss-facing messages. Flynn texting its own customer (services/
 * flynnOutbound.js) should keep the one consistent Flynn identity — that thread
 * is the product talking, not the business talking.
 */

const { supabase: defaultSupabase } = require('../telephony/supabaseClient');

// Numbers change ~never; a short TTL keeps the scheduler paths from doing a
// round trip per message without making reassignment need a redeploy.
const TTL_MS = 5 * 60 * 1000;
const cache = new Map(); // cacheKey -> { number, expiresAt }

/** The shared platform number. Last resort only — it seeds nothing. */
function fallbackNumber() {
  return process.env.TWILIO_FROM_NUMBER || process.env.TWILIO_FLYNN_NUMBER || null;
}

function readCache(key) {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (hit.expiresAt <= Date.now()) {
    cache.delete(key);
    return undefined;
  }
  return hit.number;
}

async function lookup(key, kind, id, supabase) {
  if (kind === 'user') {
    const { data } = await supabase
      .from('users')
      .select('twilio_phone_number')
      .eq('id', id)
      .maybeSingle();
    return data?.twilio_phone_number || null;
  }

  // org -> owner's number. `org_members` carries no number of its own; the
  // owner row is the one whose user account holds the assignment.
  const { data: owner } = await supabase
    .from('org_members')
    .select('user_id')
    .eq('org_id', id)
    .eq('role', 'owner')
    .eq('status', 'active')
    .maybeSingle();

  if (!owner?.user_id) return null;

  const { data } = await supabase
    .from('users')
    .select('twilio_phone_number')
    .eq('id', owner.user_id)
    .maybeSingle();
  return data?.twilio_phone_number || null;
}

/**
 * The number a client-facing SMS for this org should come from.
 *
 * Prefers userId (a direct hit) over orgId (one extra hop). Falls back to the
 * shared platform number so a send never fails just because a number hasn't
 * been assigned yet — callers that care can compare against fallbackNumber().
 *
 * @param {{userId?: string|null, orgId?: string|null, supabase?: any}} opts
 * @returns {Promise<string|null>} E.164, or null if nothing is configured.
 */
async function resolveSenderNumber({ userId = null, orgId = null, supabase = defaultSupabase } = {}) {
  const kind = userId ? 'user' : orgId ? 'org' : null;
  if (!kind || !supabase) return fallbackNumber();

  const id = userId || orgId;
  const key = `${kind}:${id}`;

  const cached = readCache(key);
  if (cached !== undefined) return cached || fallbackNumber();

  let number = null;
  try {
    number = await lookup(key, kind, id, supabase);
  } catch (err) {
    // A lookup failure must not block the send — fall through to the shared
    // number rather than dropping a client's invoice on the floor.
    console.warn('[orgSmsSender] sender lookup failed:', err?.message);
    return fallbackNumber();
  }

  cache.set(key, { number, expiresAt: Date.now() + TTL_MS });

  if (!number) {
    console.warn(
      `[orgSmsSender] no Flynn number for ${key} — sending from the shared number. ` +
      'This send will not seed the org\'s number into the client\'s thread.'
    );
    return fallbackNumber();
  }
  return number;
}

/** Drop a cached entry (call after assigning or releasing a number). */
function invalidate({ userId = null, orgId = null } = {}) {
  if (userId) cache.delete(`user:${userId}`);
  if (orgId) cache.delete(`org:${orgId}`);
}

module.exports = { resolveSenderNumber, invalidate, fallbackNumber };
