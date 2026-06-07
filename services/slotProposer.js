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

const WEEKDAY_WORDS = {
  sun: 0, sunday: 0,
  mon: 1, monday: 1,
  tue: 2, tues: 2, tuesday: 2,
  wed: 3, weds: 3, wednesday: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4,
  fri: 5, friday: 5,
  sat: 6, saturday: 6,
};

/**
 * Open/close UTC bounds (ms) for the business day that contains `instant`, in
 * tz. Returns null when that day is closed or has no parseable hours (caller
 * then skips the in-hours check).
 */
const businessDayBounds = (instant, businessHours, timeZone) => {
  const { year, month, day } = zonedYMD(instant, timeZone);
  const dow = new Date(Date.UTC(year, month, day)).getUTCDay();
  const hours = (businessHours || {})[DAY_KEYS[dow]];
  if (!hours || hours.closed) return null;
  const open = parseClock(hours.open);
  const close = parseClock(hours.close);
  if (!open || !close) return null;
  return {
    openUtc: zonedWallClockToUtc(year, month, day, open.h, open.m, timeZone).getTime(),
    closeUtc: zonedWallClockToUtc(year, month, day, close.h, close.m, timeZone).getTime(),
  };
};

/**
 * Pull a concrete proposed time out of a customer message, e.g. "does 10am
 * suit", "can you do tomorrow at 2:30pm", "thursday 9am works?". Conservative on
 * purpose: only returns a time when there's an UNAMBIGUOUS clock value (am/pm,
 * noon/midday, or a 24h HH:MM). Bare numbers ("can you do 2") are skipped so we
 * never guess am-vs-pm wrong. Day resolution: an explicit weekday/today/tomorrow
 * wins; otherwise the soonest future occurrence of that time.
 *
 * @returns {{start: Date, end: Date, label: string}|null}
 */
const parseProposedTime = (text, { now = new Date(), timeZone = 'Australia/Sydney', durationMins = 60 } = {}) => {
  if (typeof text !== 'string' || !text.trim()) return null;
  const s = text.toLowerCase();

  // --- time of day ---
  let hour = null;
  let minute = 0;
  const ampm = s.match(/\b(\d{1,2})(?::(\d{2}))?\s*([ap])\.?\s?m\.?\b/);
  const h24 = s.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (/\b(noon|midday)\b/.test(s)) {
    hour = 12; minute = 0;
  } else if (ampm) {
    hour = parseInt(ampm[1], 10);
    minute = ampm[2] ? parseInt(ampm[2], 10) : 0;
    const pm = ampm[3] === 'p';
    if (pm && hour < 12) hour += 12;
    if (!pm && hour === 12) hour = 0;
  } else if (h24) {
    hour = parseInt(h24[1], 10);
    minute = parseInt(h24[2], 10);
  } else {
    return null; // no unambiguous time → don't attempt an availability check
  }
  if (hour == null || hour > 23 || minute > 59) return null;

  // --- day ---
  const todayDow = new Date(Date.UTC(
    zonedYMD(now, timeZone).year, zonedYMD(now, timeZone).month, zonedYMD(now, timeZone).day
  )).getUTCDay();
  let dayOffset = null; // days from today (tz)
  if (/\b(today|tonight|this (morning|arvo|afternoon|evening))\b/.test(s)) {
    dayOffset = 0;
  } else if (/\b(tomorrow|tmrw|tmr|tomoz|2moro)\b/.test(s)) {
    dayOffset = 1;
  } else {
    const wd = s.match(/\b(sun|mon|tue|tues|wed|weds|thu|thur|thurs|fri|sat)(?:day|s|nesday|rsday|urday)?\b/);
    if (wd && WEEKDAY_WORDS[wd[1]] != null) {
      dayOffset = (WEEKDAY_WORDS[wd[1]] - todayDow + 7) % 7; // 0 == today; rolled below if passed
    }
  }

  const buildStart = (offset) => {
    const probe = new Date(now.getTime() + offset * 24 * 60 * 60000);
    const { year, month, day } = zonedYMD(probe, timeZone);
    return zonedWallClockToUtc(year, month, day, hour, minute, timeZone).getTime();
  };

  let startMs;
  if (dayOffset == null) {
    // No day given: today if the time is still ahead, else tomorrow.
    startMs = buildStart(0);
    if (startMs <= now.getTime()) startMs = buildStart(1);
  } else {
    startMs = buildStart(dayOffset);
    // A named weekday/today whose time already passed rolls to next week.
    if (startMs <= now.getTime()) startMs = buildStart(dayOffset + 7);
  }

  const start = new Date(startMs);
  const end = new Date(startMs + durationMins * 60000);
  return { start, end, label: formatSlotLabel(start, timeZone) };
};

/**
 * Is a specific proposed slot bookable? Returns:
 *   'free'   — inside business hours (when known) and not overlapping busy
 *   'busy'   — overlaps an existing calendar event
 *   'closed' — outside business hours for that day
 */
const checkProposedTime = ({ start, end, businessHours = {}, busy = [], timeZone = 'Australia/Sydney' }) => {
  const startMs = start.getTime();
  const endMs = end.getTime();

  // Only assert 'closed' when we actually know the hours for that day.
  if (businessHours && Object.keys(businessHours).length) {
    const bounds = businessDayBounds(start, businessHours, timeZone);
    if (!bounds) return 'closed';
    if (startMs < bounds.openUtc || endMs > bounds.closeUtc) return 'closed';
  }

  const clash = (busy || [])
    .map((b) => ({ start: new Date(b.start).getTime(), end: new Date(b.end).getTime() }))
    .filter((b) => Number.isFinite(b.start) && Number.isFinite(b.end))
    .some((b) => overlaps(startMs, endMs, b.start, b.end));
  if (clash) return 'busy';

  return 'free';
};

/**
 * The open slot nearest (in time) to a desired start — used to counter-offer
 * when the customer's requested time is busy or out of hours. Scans at fine
 * granularity (no anti-clustering skip) so the suggestion lands close.
 */
const findNearestOpenSlot = ({
  desired,
  businessHours = {},
  busy = [],
  timeZone = 'Australia/Sydney',
  durationMins = 60,
  from = new Date(),
  days = 7,
} = {}) => {
  const slots = findOpenSlots({
    businessHours, busy, timeZone, durationMins, from, days,
    maxSlots: 200, stepMins: 30, spacingMins: 30, leadMins: 60,
  });
  if (!slots.length) return null;
  const target = desired instanceof Date ? desired.getTime() : new Date(desired).getTime();
  return slots.reduce((best, s) =>
    Math.abs(s.start.getTime() - target) < Math.abs(best.start.getTime() - target) ? s : best
  );
};

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
 * @param {number} opts.spacingMins    minimum gap between proposed slots so we
 *                                      don't offer three back-to-back (default 120)
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
  spacingMins = 120,
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
      t += Math.max(0, spacingMins - stepMins) * 60000;
    }
  }

  return results;
};

const cleanStr = (v) => {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length ? t.slice(0, 120) : null;
};

/**
 * Title for a calendar event from the optional LLM-extracted booking metadata.
 * Prefers "<service> — <customer>", then customer or service alone, else a
 * generic fallback. Pure.
 */
const buildEventTitle = (booking = null) => {
  const customer = cleanStr(booking?.customer);
  const service = cleanStr(booking?.service);
  if (service && customer) return `${service} — ${customer}`;
  if (customer) return `Booking — ${customer}`;
  if (service) return service;
  return 'Booking';
};

/**
 * Build the structured calendar event to offer the user, ONLY when a concrete
 * time has been validated as genuinely free against their real calendar. The
 * START TIME always comes from the trusted slotProposer parse (`proposed`),
 * never the LLM — the LLM `booking` only enriches title/customer/location.
 *
 * Returns null unless `status === 'free'` and we have a parsed time, so a
 * tentative or busy time never produces a one-tap booking.
 *
 * @returns {{title, startISO, durationMin, location: string|null, customer: string|null}|null}
 */
const buildAgreedEvent = ({ proposed, status, booking = null, durationMins = 60 } = {}) => {
  if (!proposed || !(proposed.start instanceof Date) || status !== 'free') return null;
  return {
    title: buildEventTitle(booking),
    startISO: proposed.start.toISOString(),
    durationMin: durationMins,
    location: cleanStr(booking?.location),
    customer: cleanStr(booking?.customer),
  };
};

module.exports = {
  parseClock,
  tzOffsetMinutes,
  zonedWallClockToUtc,
  findOpenSlots,
  formatSlotLabel,
  parseProposedTime,
  checkProposedTime,
  findNearestOpenSlot,
  buildEventTitle,
  buildAgreedEvent,
};
