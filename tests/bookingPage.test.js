/**
 * Regression tests for the booking page's timezone maths.
 *
 * These exist because the slot generator built business hours with
 * `setHours()`, i.e. in the *server's* timezone. Every booking page carries an
 * IANA `timezone` (default Australia/Sydney) that was read, returned to
 * clients, and then ignored — so on a UTC Fly machine a Sydney tradie's 9-5
 * came out ten or eleven hours off depending on daylight saving.
 *
 * There is no tz package in this repo, so the helpers use `Intl`. That's the
 * part worth pinning: it has to survive DST on both sides of the year, zones
 * that don't observe it at all, and month boundaries.
 */

// services/bookingPage.js pulls in the shared Supabase client at module load.
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-key';

const {
  zonedWallTimeToUtc,
  parseCalendarDate,
  weekdayForCalendarDate,
  formatSlotLabel,
  addDays,
  toDateString,
  slugify,
} = require('../services/bookingPage');

describe('booking page timezone helpers', () => {
  test('resolves AEST (UTC+10) in the southern winter', () => {
    expect(zonedWallTimeToUtc(2026, 8, 14, 9, 0, 'Australia/Sydney').toISOString())
      .toBe('2026-08-13T23:00:00.000Z');
  });

  test('resolves AEDT (UTC+11) in the southern summer', () => {
    // The same wall-clock 9am is an hour earlier in UTC once DST starts. This
    // is the case a fixed offset would silently get wrong for half the year.
    expect(zonedWallTimeToUtc(2026, 1, 15, 9, 0, 'Australia/Sydney').toISOString())
      .toBe('2026-01-14T22:00:00.000Z');
  });

  test('handles a zone with no daylight saving', () => {
    expect(zonedWallTimeToUtc(2026, 8, 14, 9, 0, 'Australia/Perth').toISOString())
      .toBe('2026-08-14T01:00:00.000Z');
    expect(zonedWallTimeToUtc(2026, 1, 14, 9, 0, 'Australia/Perth').toISOString())
      .toBe('2026-01-14T01:00:00.000Z');
  });

  test('handles New Zealand, the other half of the beachhead', () => {
    expect(zonedWallTimeToUtc(2026, 8, 14, 9, 0, 'Pacific/Auckland').toISOString())
      .toBe('2026-08-13T21:00:00.000Z');
  });

  test('round-trips: a slot renders as the wall-clock time it was built from', () => {
    for (const [month, day] of [[8, 14], [1, 15]]) {
      const instant = zonedWallTimeToUtc(2026, month, day, 9, 0, 'Australia/Sydney');
      expect(formatSlotLabel(instant, 'Australia/Sydney')).toBe('9:00 am');
    }
  });

  test('rejects anything that is not YYYY-MM-DD', () => {
    expect(parseCalendarDate('2026-08-14')).toEqual({ year: 2026, month: 8, day: 14 });
    expect(parseCalendarDate('14/08/2026')).toBeNull();
    expect(parseCalendarDate('2026-13-01')).toBeNull();
    expect(parseCalendarDate('')).toBeNull();
    expect(parseCalendarDate(undefined)).toBeNull();
  });

  test('derives the weekday from the calendar date, not the server zone', () => {
    expect(weekdayForCalendarDate({ year: 2026, month: 8, day: 14 })).toBe('friday');
    expect(weekdayForCalendarDate({ year: 2026, month: 8, day: 16 })).toBe('sunday');
  });

  test('walks across month and year boundaries', () => {
    expect(toDateString(addDays({ year: 2026, month: 8, day: 31 }, 1))).toBe('2026-09-01');
    expect(toDateString(addDays({ year: 2026, month: 12, day: 31 }, 1))).toBe('2027-01-01');
  });
});

describe('slugify', () => {
  test('produces a readable slug a tradie would recognise as their own', () => {
    expect(slugify("Joe's Plumbing & Gas")).toBe('joes-plumbing-gas');
    expect(slugify('  A.J. Removals  ')).toBe('a-j-removals');
  });

  test('never returns an empty slug', () => {
    expect(slugify('')).toBe('book');
    expect(slugify('!!!')).toBe('book');
    expect(slugify(null)).toBe('book');
  });
});

describe('mergeBusyIntervals', () => {
  const { mergeBusyIntervals } = require('../services/bookingCalendarSync');
  const iso = (h) => `2026-08-14T0${h}:00:00.000Z`;

  test('merges overlapping and touching intervals, keeps disjoint ones', () => {
    const merged = mergeBusyIntervals([
      { start: iso(3), end: iso(4) },
      { start: iso(1), end: iso(2) },   // unsorted on purpose
      { start: iso(2), end: iso(3) },   // touches the first two -> one block
      { start: iso(6), end: iso(7) },
    ]);
    expect(merged).toHaveLength(2);
    expect(merged[0].start.toISOString()).toBe(iso(1));
    expect(merged[0].end.toISOString()).toBe(iso(4));
    expect(merged[1].start.toISOString()).toBe(iso(6));
  });

  test('drops garbage rather than corrupting the availability check', () => {
    const merged = mergeBusyIntervals([
      { start: 'not-a-date', end: iso(2) },
      { start: iso(3), end: iso(3) },   // zero-length
      { start: iso(4), end: iso(5) },
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0].start.toISOString()).toBe(iso(4));
  });

  test('tolerates empty and missing input', () => {
    expect(mergeBusyIntervals([])).toEqual([]);
    expect(mergeBusyIntervals(undefined)).toEqual([]);
  });
});
