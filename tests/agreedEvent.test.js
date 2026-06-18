const {
  parseProposedTime,
  checkProposedTime,
  buildEventTitle,
  buildAgreedEvent,
} = require('../services/slotProposer');
const { parseBooking } = require('../services/draftReplies');

const TZ = 'Australia/Sydney';
// A fixed "now": Mon 2 Jun 2025, 08:00 Sydney (22:00 UTC Sun 1 Jun).
const NOW = new Date('2025-06-01T22:00:00.000Z');
// Open all week 7am–5pm so the named times land inside hours.
const HOURS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
  .reduce((acc, d) => { acc[d] = { open: '7am', close: '5pm' }; return acc; }, {});

const proposeAndCheck = (text, busy = []) => {
  const proposed = parseProposedTime(text, { now: NOW, timeZone: TZ });
  const status = proposed
    ? checkProposedTime({ start: proposed.start, end: proposed.end, businessHours: HOURS, busy, timeZone: TZ })
    : null;
  return { proposed, status };
};

describe('buildEventTitle', () => {
  test('service + customer', () => {
    expect(buildEventTitle({ service: 'Gutter clean', customer: 'Dave' })).toBe('Gutter clean — Dave');
  });
  test('customer only', () => {
    expect(buildEventTitle({ customer: 'Dave' })).toBe('Booking — Dave');
  });
  test('service only', () => {
    expect(buildEventTitle({ service: 'Quote visit' })).toBe('Quote visit');
  });
  test('empty / null fallback', () => {
    expect(buildEventTitle(null)).toBe('Booking');
    expect(buildEventTitle({ customer: '   ' })).toBe('Booking');
  });
});

describe('parseBooking', () => {
  test('extracts trimmed fields', () => {
    const b = parseBooking('{"read":"x","drafts":["a"],"booking":{"customer":" Dave ","service":"Gutter clean","location":"12 Oak St"}}');
    expect(b).toEqual({ customer: 'Dave', service: 'Gutter clean', location: '12 Oak St' });
  });
  test('null when no booking key', () => {
    expect(parseBooking('{"read":"x","drafts":["a"]}')).toBeNull();
  });
  test('null on garbage / non-object booking', () => {
    expect(parseBooking('not json')).toBeNull();
    expect(parseBooking('{"booking":"nope"}')).toBeNull();
    expect(parseBooking('{"booking":{}}')).toBeNull();
  });
  test('tolerates a wrapped JSON block', () => {
    const b = parseBooking('here you go: {"drafts":["a"],"booking":{"customer":"Sam"}} thanks');
    expect(b).toEqual({ customer: 'Sam' });
  });
});

describe('buildAgreedEvent', () => {
  test('produces an event for a free, agreed time with trusted start', () => {
    const { proposed, status } = proposeAndCheck('does tomorrow 2pm suit?');
    expect(status).toBe('free');
    const ev = buildAgreedEvent({ proposed, status, booking: { customer: 'Dave', service: 'Gutter clean' } });
    expect(ev).not.toBeNull();
    expect(ev.title).toBe('Gutter clean — Dave');
    expect(ev.durationMin).toBe(60);
    expect(ev.customer).toBe('Dave');
    // Tue 3 Jun 2pm Sydney == 04:00 UTC.
    expect(ev.startISO).toBe('2025-06-03T04:00:00.000Z');
  });

  test('null when the named time is busy', () => {
    // Block tomorrow 2–3pm Sydney (04:00–05:00 UTC Tue).
    const busy = [{ start: '2025-06-03T04:00:00.000Z', end: '2025-06-03T05:00:00.000Z' }];
    const { proposed, status } = proposeAndCheck('does tomorrow 2pm suit?', busy);
    expect(status).toBe('busy');
    expect(buildAgreedEvent({ proposed, status, booking: { customer: 'Dave' } })).toBeNull();
  });

  test('null when outside business hours (closed)', () => {
    const { proposed, status } = proposeAndCheck('can you do tomorrow 9pm?');
    expect(status).toBe('closed');
    expect(buildAgreedEvent({ proposed, status })).toBeNull();
  });

  test('null when no concrete time was parsed', () => {
    const { proposed, status } = proposeAndCheck('what time can you come?');
    expect(proposed).toBeNull();
    expect(buildAgreedEvent({ proposed, status })).toBeNull();
  });

  test('event still builds with no booking metadata (generic title)', () => {
    const { proposed, status } = proposeAndCheck('thursday 9am works');
    expect(status).toBe('free');
    const ev = buildAgreedEvent({ proposed, status, booking: null });
    expect(ev.title).toBe('Booking');
    expect(ev.location).toBeNull();
  });
});
