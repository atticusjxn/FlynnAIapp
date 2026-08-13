/**
 * Calendar I/O for the public booking page.
 *
 * Two jobs:
 *   1. `busyIntervalsForOrg` — the tradie's real busy times, so the page never
 *      offers a slot they can't attend. Until this existed, availability only
 *      subtracted the page's own `bookings` rows; a job booked over the phone
 *      and sitting in Google Calendar was invisible, and a customer could
 *      double-book straight over it.
 *   2. `createCalendarEventsForBooking` — write the booked slot back, so the
 *      job lands in the calendar the tradie actually lives in.
 *
 * Both reuse the working backend services (services/googleCalendar.js,
 * services/appleCalendar.js). The old bookingRoutes code tried to require
 * ../src/services/CalendarIntegrationService — a React Native *TypeScript*
 * file Node can't load — so it logged "calendar sync disabled" on every boot
 * and silently did neither of these things.
 *
 * Everything here fails open: a calendar outage must degrade to
 * "bookings-table-only availability", never to a dead booking page.
 */

const { supabase } = require('../telephony/supabaseClient');
const googleCalendar = require('./googleCalendar');
const appleCalendar = require('./appleCalendar');

/** Merge overlapping/touching {start, end} ISO intervals into a minimal set. */
function mergeBusyIntervals(intervals) {
  const parsed = (intervals || [])
    .map((b) => ({ start: new Date(b.start), end: new Date(b.end) }))
    .filter((b) => !Number.isNaN(b.start.getTime()) && !Number.isNaN(b.end.getTime()) && b.end > b.start)
    .sort((a, b) => a.start - b.start);
  const merged = [];
  for (const cur of parsed) {
    const last = merged[merged.length - 1];
    if (last && cur.start <= last.end) {
      if (cur.end > last.end) last.end = cur.end;
    } else {
      merged.push({ start: cur.start, end: cur.end });
    }
  }
  return merged;
}

/**
 * The org's Google Calendar connection (the app's own OAuth flow, org-keyed),
 * refreshed to a usable access token. Null when not connected.
 */
async function googleAccessForOrg(orgId) {
  const { data: connection } = await supabase
    .from('integration_connections')
    .select('*')
    .eq('org_id', orgId)
    .eq('provider', 'google_calendar')
    .eq('status', 'connected')
    .maybeSingle();
  if (!connection) return null;
  const accessToken = await googleCalendar.ensureFreshAccessToken(supabase, connection);
  return { accessToken, connection };
}

/**
 * Apple Calendar credentials for the org's owner, if they saved them through
 * the SMS agent (user_integrations, phone-keyed, encrypted at rest).
 */
async function appleCredsForOrg(orgId) {
  const { data: user } = await supabase
    .from('users')
    .select('phone')
    .eq('default_org_id', orgId)
    .not('phone', 'is', null)
    .limit(1)
    .maybeSingle();
  if (!user?.phone) return null;
  const { data: row } = await supabase
    .from('user_integrations')
    .select('credentials_encrypted')
    .eq('user_phone', user.phone)
    .eq('integration_type', 'apple-calendar')
    .maybeSingle();
  if (!row?.credentials_encrypted) return null;
  const { decryptCredentials } = require('./credentialCrypto');
  const creds = decryptCredentials(row.credentials_encrypted);
  return creds?.email ? creds : null;
}

/**
 * Real busy intervals for an org across [timeMin, timeMax]: Google and Apple
 * where connected, merged. Sources that error are skipped with a warning —
 * fail open, not closed.
 */
async function busyIntervalsForOrg({ orgId, timeMin, timeMax, googleCalendarId = 'primary' }) {
  const results = await Promise.allSettled([
    (async () => {
      const google = await googleAccessForOrg(orgId);
      if (!google) return [];
      return googleCalendar.queryFreeBusy(google.accessToken, {
        timeMin,
        timeMax,
        calendarId: googleCalendarId || 'primary',
      });
    })(),
    (async () => {
      const creds = await appleCredsForOrg(orgId);
      if (!creds) return [];
      return appleCalendar.queryFreeBusy(creds, { timeMin, timeMax });
    })(),
  ]);

  const busy = [];
  const labels = ['google', 'apple'];
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      busy.push(...(r.value || []));
    } else {
      console.warn(`[BookingCalendar] ${labels[i]} free/busy failed (continuing without it):`, r.reason?.message || r.reason);
    }
  });
  return mergeBusyIntervals(busy);
}

/**
 * Write the booked slot into the tradie's calendar(s). Returns whatever event
 * ids were created; never throws.
 */
async function createCalendarEventsForBooking({ orgId, bookingPage, booking }) {
  const timeZone = bookingPage?.timezone || 'Australia/Sydney';
  const details = {
    summary: `${booking.customer_name} — booked online`,
    description: [
      `Booked via your Flynn booking page.`,
      `Phone: ${booking.customer_phone}`,
      booking.customer_email ? `Email: ${booking.customer_email}` : null,
      booking.notes ? `\n${booking.notes}` : null,
    ].filter(Boolean).join('\n'),
    startISO: booking.start_time,
    endISO: booking.end_time,
  };

  const out = {};

  try {
    const google = await googleAccessForOrg(orgId);
    if (google) {
      const event = await googleCalendar.insertEvent(google.accessToken, {
        calendarId: bookingPage?.google_calendar_id || 'primary',
        summary: details.summary,
        description: details.description,
        startISO: details.startISO,
        endISO: details.endISO,
        timeZone,
      });
      if (event?.id) out.google_event_id = event.id;
    }
  } catch (err) {
    console.warn('[BookingCalendar] Google event insert failed:', err.message);
  }

  try {
    const creds = await appleCredsForOrg(orgId);
    if (creds) {
      const event = await appleCalendar.insertEvent(creds, {
        summary: details.summary,
        description: details.description,
        startISO: details.startISO,
        endISO: details.endISO,
      });
      if (event?.id) out.apple_event_id = event.id;
    }
  } catch (err) {
    console.warn('[BookingCalendar] Apple event insert failed:', err.message);
  }

  return out;
}

module.exports = {
  mergeBusyIntervals,
  busyIntervalsForOrg,
  createCalendarEventsForBooking,
};
