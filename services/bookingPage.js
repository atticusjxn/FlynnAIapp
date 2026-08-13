/**
 * Booking pages: provisioning, URLs, and timezone-correct slot maths.
 *
 * Why this exists
 * ---------------
 * The AI receptionist tells every caller "I'll send you a booking link by SMS
 * right now" (telephony/deepgramVoiceAgent.js). Nothing sent one, and nothing
 * could have: `booking_pages` rows were only ever created from a legacy React
 * Native settings screen, and `business_profiles.booking_link_url` is a
 * free-text field the user had to retype by hand. In production that left 130
 * business profiles with `booking_link_enabled = true` and exactly zero URLs.
 *
 * So the link is provisioned here, server-side, at the same moment a tenant
 * gets their Flynn number — the point at which they become able to receive a
 * call at all.
 *
 * Timezone
 * --------
 * A booking page carries an IANA `timezone` (default Australia/Sydney) but the
 * old slot generator built slots with `setHours()`, i.e. in the *server's* zone.
 * On a UTC Fly machine that put a Sydney tradie's 9-5 out by ten or eleven
 * hours depending on DST. There's no tz package in this repo, so the helpers
 * below do it with `Intl`, which carries the full zone database and handles DST
 * transitions correctly.
 */

const crypto = require('crypto');
const { supabase } = require('../telephony/supabaseClient');

/** Public origin for hosted pages. Mirrors routes/invoicePage.js. */
function bookingBaseUrl() {
  const raw =
    process.env.PUBLIC_BASE_URL ||
    process.env.SERVER_PUBLIC_URL ||
    process.env.SERVER_URL ||
    'https://flynnai-telephony.fly.dev';
  return String(raw).replace(/\/+$/, '');
}

function bookingUrlForSlug(slug) {
  return `${bookingBaseUrl()}/b/${slug}`;
}

/**
 * "Joe's Plumbing & Gas" -> "joes-plumbing-gas".
 * Kept readable rather than random: the link is read aloud, texted, and shown
 * on an invoice, so it should look like the business, not like a token.
 */
function slugify(name) {
  const base = String(name || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/, '');
  return base || 'book';
}

// ---------------------------------------------------------------- timezone --

/**
 * How far `instant` is ahead of UTC in `timeZone`, in milliseconds.
 * Positive east of Greenwich. DST-aware because Intl resolves the offset for
 * that specific instant, not a fixed rule.
 */
function zoneOffsetMs(instant, timeZone) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = {};
  for (const p of dtf.formatToParts(instant)) {
    if (p.type !== 'literal') parts[p.type] = p.value;
  }
  const hour = parts.hour === '24' ? '00' : parts.hour;
  const asIfUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(hour),
    Number(parts.minute),
    Number(parts.second)
  );
  return asIfUtc - instant.getTime();
}

/**
 * Wall-clock time in `timeZone` -> the UTC instant it refers to.
 *
 * Resolved twice: the first offset is looked up using a naive guess, which is
 * wrong for wall times within an hour of a DST transition, and the second pass
 * corrects it.
 */
function zonedWallTimeToUtc(year, month, day, hour, minute, timeZone) {
  const naive = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  const firstGuess = naive - zoneOffsetMs(new Date(naive), timeZone);
  const corrected = naive - zoneOffsetMs(new Date(firstGuess), timeZone);
  return new Date(corrected);
}

/** Parse "YYYY-MM-DD" into numbers without going through the server's zone. */
function parseCalendarDate(dateStr) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr || '').trim());
  if (!m) return null;
  const [, y, mo, d] = m;
  const year = Number(y);
  const month = Number(mo);
  const day = Number(d);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/** Weekday name for a calendar date. Zone-independent by construction. */
function weekdayForCalendarDate({ year, month, day }) {
  return DAY_NAMES[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
}

/** "9:00 am" style label for an instant, rendered in the business's zone. */
function formatSlotLabel(instant, timeZone) {
  return new Intl.DateTimeFormat('en-AU', {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(instant);
}

/** "Thursday 14 August" for an instant, in the business's zone. */
function formatDayLabel(instant, timeZone) {
  return new Intl.DateTimeFormat('en-AU', {
    timeZone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(instant);
}

/** Today's calendar date in a given zone, as {year, month, day}. */
function todayInZone(timeZone, now = new Date()) {
  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const [year, month, day] = dtf.format(now).split('-').map(Number);
  return { year, month, day };
}

/** Add whole days to a calendar date, returning a new {year, month, day}. */
function addDays(cal, days) {
  const d = new Date(Date.UTC(cal.year, cal.month - 1, cal.day));
  d.setUTCDate(d.getUTCDate() + days);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

function toDateString({ year, month, day }) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// ------------------------------------------------------------ provisioning --

async function slugIsTaken(slug) {
  const { data } = await supabase
    .from('booking_pages')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();
  return Boolean(data);
}

/**
 * Find a free slug near `preferred`. Numeric suffixes first so the common case
 * stays readable, then a short random one so a pathological run of collisions
 * can't spin.
 */
async function allocateSlug(preferred) {
  const base = slugify(preferred);
  if (!(await slugIsTaken(base))) return base;
  for (let i = 2; i <= 6; i += 1) {
    const candidate = `${base}-${i}`;
    if (!(await slugIsTaken(candidate))) return candidate;
  }
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = `${base}-${crypto.randomBytes(3).toString('hex')}`;
    if (!(await slugIsTaken(candidate))) return candidate;
  }
  throw new Error('could_not_allocate_booking_slug');
}

/**
 * Idempotently give a tenant a booking page and make sure the URL is reflected
 * on `business_profiles` so every existing reader (the IVR branch, the SMS
 * sender) picks it up without changes.
 *
 * Safe to call repeatedly — that's the point, since it runs on every number
 * assignment. Returns null rather than throwing when the org can't be resolved:
 * a missing booking page must never fail number provisioning.
 */
async function ensureBookingPage({ userId, orgId = null, businessName = null }) {
  try {
    if (!userId && !orgId) return null;

    let resolvedOrgId = orgId;
    let resolvedName = businessName;

    if (!resolvedOrgId || !resolvedName) {
      const { data: user } = await supabase
        .from('users')
        .select('default_org_id, business_name')
        .eq('id', userId)
        .maybeSingle();
      resolvedOrgId = resolvedOrgId || user?.default_org_id || null;
      resolvedName = resolvedName || user?.business_name || null;
    }

    if (!resolvedName && userId) {
      const { data: profile } = await supabase
        .from('business_profiles')
        .select('business_name')
        .eq('user_id', userId)
        .maybeSingle();
      resolvedName = resolvedName || profile?.business_name || null;
    }

    if (!resolvedOrgId) {
      console.warn('[BookingPage] No org for user, skipping provisioning', { userId });
      return null;
    }

    // One page per org — the table has a unique index on org_id.
    const { data: existing } = await supabase
      .from('booking_pages')
      .select('id, slug, business_name')
      .eq('org_id', resolvedOrgId)
      .maybeSingle();

    let slug = existing?.slug || null;

    if (!existing) {
      slug = await allocateSlug(resolvedName || 'book');
      const { error } = await supabase.from('booking_pages').insert({
        org_id: resolvedOrgId,
        slug,
        business_name: resolvedName || 'Bookings',
        // The column default is 24h notice, which would hide today and most of
        // tomorrow. Flynn's whole pitch is booking the job on the call, so new
        // pages get a short notice window instead.
        booking_notice_hours: 2,
      });
      if (error) {
        // Someone else won the race; re-read rather than fail.
        const { data: raced } = await supabase
          .from('booking_pages')
          .select('slug')
          .eq('org_id', resolvedOrgId)
          .maybeSingle();
        if (!raced?.slug) {
          console.error('[BookingPage] Insert failed:', error.message);
          return null;
        }
        slug = raced.slug;
      }
    }

    const url = bookingUrlForSlug(slug);

    // Mirror onto business_profiles so every existing reader (the IVR branch,
    // smsLinkSender) picks it up without changes. Keyed on org_id, not user_id:
    // in production all 130 profiles carry an org but only 27 carry a user, so
    // keying on the user would silently skip most tenants.
    const { error: mirrorError } = await supabase
      .from('business_profiles')
      .update({ booking_link_url: url, booking_link_enabled: true })
      .eq('org_id', resolvedOrgId);
    if (mirrorError) {
      console.error('[BookingPage] Mirror to business_profiles failed:', mirrorError.message);
    }

    return { slug, url, created: !existing };
  } catch (err) {
    console.error('[BookingPage] ensureBookingPage threw:', err.message);
    return null;
  }
}

/** The tenant's booking URL, or null. Cheap read for the call-completion path. */
async function bookingUrlForUser(userId) {
  if (!userId) return null;
  try {
    const { data: user } = await supabase
      .from('users')
      .select('default_org_id')
      .eq('id', userId)
      .maybeSingle();
    if (!user?.default_org_id) return null;
    const { data: page } = await supabase
      .from('booking_pages')
      .select('slug')
      .eq('org_id', user.default_org_id)
      .eq('is_active', true)
      .maybeSingle();
    return page?.slug ? bookingUrlForSlug(page.slug) : null;
  } catch (err) {
    console.error('[BookingPage] bookingUrlForUser threw:', err.message);
    return null;
  }
}

module.exports = {
  bookingBaseUrl,
  bookingUrlForSlug,
  slugify,
  allocateSlug,
  ensureBookingPage,
  bookingUrlForUser,
  // timezone helpers, shared with routes/bookingRoutes.js
  zoneOffsetMs,
  zonedWallTimeToUtc,
  parseCalendarDate,
  weekdayForCalendarDate,
  formatSlotLabel,
  formatDayLabel,
  todayInZone,
  addDays,
  toDateString,
};
