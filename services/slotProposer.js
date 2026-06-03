/**
 * Slot proposer
 *
 * The killer feature: read the user's real availability (busy intervals from
 * Google free/busy) and their business hours, and compute a few genuinely-open
 * slots to offer the customer (e.g. "Tue 2pm or Thu 9:30am").
 *
 * Timezone handling: business hours are wall-clock in the business's timezone;
 * busy intervals come back from Google as UTC instants. We convert candidate
 * wall-clock slots to UTC using the IANA timezone (via Intl) so the overlap
 * check is correct, and format human labels back in that timezone.
 *
 * Pure functions, no network — unit-testable. Google I/O lives in
 * services/googleCalendar.js.
 */

const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/**
 * Parse a business-hours clock string into {h, m}. Accepts "7am", "7:30am",
 * "7:00 AM", "14:00", "9". Returns null if unparseable.
 */
const parseClock = (value) => {
  if (typeof value !== 'string') return null;
  const s = value.trim().toLowerCase();
  const m = s.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = m[2] ? parseInt(m[2], 10) : 0;
  const ap = m[3];
  if (Number.isNaN(h) || Number.isNaN(min) || h > 23 || min > 59) return null;
  if (ap === 'pm' && h < 12) h += 12;
  if (ap === 'am' && h === 12) h = 0;
  return { h, m: min };
};

/**
 * Offset (minutes) of the given timezone at the given instant, e.g. +600 for
 * Australia/Sydney in winter. Uses the Intl formatToParts trick.
 */
const tzOffsetMinutes = (date, timeZone) => {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const parts = dtf.formatToParts(date).reduce((acc, p) => {
    acc[p.type] = p.value;
    return acc;
  }, {});
  // The instant as it reads on the wall clock in `timeZone`, interpreted as UTC.
  const asUTC = Date.UTC(
    Number(parts.year), Number(parts.month) - 1, Number(parts.day),
    Number(parts.hour === '24' ? '00' : parts.hour), Number(parts.minute), Number(parts.second)
  );
  return Math.round((asUTC - date.getTime()) / 60000);
};

/** Convert a wall-clock time in `timeZone` to a UTC Date. */
const zonedWallClockToUtc = (year, month, day, hour, minute, timeZone) => {
  const naiveUtc = Date.UTC(year, month, day, hour, minute, 0);
  // Two passes handle the offset depending on date (DST) well enough.
  let offset = tzOffsetMinutes(new Date(naiveUtc), timeZone);
  let utc = naiveUtc - offset * 60000;
  offset = tzOffsetMinutes(new Date(utc), timeZone);
  return new Date(naiveUtc - offset * 60000);
};

/** Wall-clock Y/M/D in `timeZone` for a given instant. */
const zonedYMD = (date, timeZone) => {
  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  });
  const [y, m, d] = dtf.format(date).split('-').map(Number);
  return { year: y, month: m - 1, day: d };
};

const overlaps = (aStart, aEnd, bStart, bEnd) => aStart < bEnd && bStart < aEnd;

/**
 * Format a slot for the draft prompt, e.g. "Tue 3 Jun 2:00pm".
 */
const formatSlotLabel = (startUtc, timeZone) => {
  const dtf = new Intl.DateTimeFormat('en-AU', {
    timeZone, weekday: 'short', day: 'numeric', month: 'short',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
  return dtf.format(startUtc).replace(/ /g, ' ');
};

/**
 * Find open slots.
 *
 * @param {Object} opts
 * @param {Object} opts.businessHours  hours_json: { monday:{open,close,closed}, ... }
 * @param {Array}  opts.busy           [{ start: ISO, end: ISO }] busy intervals (UTC)
 * @param {string} opts.timeZone       IANA tz of the business (default Australia/Sydney)
 * @param {number} opts.durationMins   slot length (default 60)
 * @param {Date}   opts.from           earliest start (default now)
 * @param {number} opts.days           lookahead window in days (default 7)
 * @param {number} opts.maxSlots       how many to return (default 3)
 * @param {number} opts.stepMins       granularity of candidate starts (default 30)
 * @param {number} opts.leadMins       minimum notice from `from` (default 120)
 * @returns {Array<{start: Date, end: Date, label: string}>}
 */
const findOpenSlots = ({
  businessHours = {},
  busy = [],
  timeZone = 'Australia/Sydney',
  durationMins = 60,
  from = new Date(),
  days = 7,
  maxSlots = 3,
  stepMins = 30,
  leadMins = 120,
} = {}) => {
  const busyIntervals = (busy || [])
    .map((b) => ({ start: new Date(b.start).getTime(), end: new Date(b.end).getTime() }))
    .filter((b) => Number.isFinite(b.start) && Number.isFinite(b.end));

  const earliest = from.getTime() + leadMins * 60000;
  const results = [];

  for (let dayOffset = 0; dayOffset < days && results.length < maxSlots; dayOffset++) {
    // Determine the calendar date `dayOffset` days from `from`, in the tz.
    const probe = new Date(from.getTime() + dayOffset * 24 * 60 * 60000);
    const { year, month, day } = zonedYMD(probe, timeZone);
    const dow = new Date(Date.UTC(year, month, day)).getUTCDay();
    const hours = businessHours[DAY_KEYS[dow]];
    if (!hours || hours.closed) continue;

    const open = parseClock(hours.open);
    const close = parseClock(hours.close);
    if (!open || !close) continue;

    const dayOpenUtc = zonedWallClockToUtc(year, month, day, open.h, open.m, timeZone).getTime();
    const dayCloseUtc = zonedWallClockToUtc(year, month, day, close.h, close.m, timeZone).getTime();

    for (let t = dayOpenUtc; t + durationMins * 60000 <= dayCloseUtc; t += stepMins * 60000) {
      if (results.length >= maxSlots) break;
      const slotStart = t;
      const slotEnd = t + durationMins * 60000;
      if (slotStart < earliest) continue;
      const clash = busyIntervals.some((b) => overlaps(slotStart, slotEnd, b.start, b.end));
      if (clash) continue;
      results.push({
        start: new Date(slotStart),
        end: new Date(slotEnd),
        label: formatSlotLabel(new Date(slotStart), timeZone),
      });
      // Skip ahead so we don't propose three back-to-back slots in one morning.
      t += Math.max(0, 120 - stepMins) * 60000;
    }
  }

  return results;
};

module.exports = {
  parseClock,
  tzOffsetMinutes,
  zonedWallClockToUtc,
  findOpenSlots,
  formatSlotLabel,
};
