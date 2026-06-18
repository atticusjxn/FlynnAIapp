/**
 * Apple Calendar via CalDAV (iCloud).
 *
 * Apple has no server OAuth — the only backend-reachable path is CalDAV against
 * caldav.icloud.com using the user's iCloud email + an APP-SPECIFIC PASSWORD
 * (appleid.apple.com -> Sign-In and Security -> App-Specific Passwords). Those
 * creds are stored encrypted (see services/credentialCrypto.js) and passed in
 * here as { email, password }.
 *
 * Interface mirrors services/googleCalendar.js so the calendar tools dispatch
 * to either provider transparently:
 *   queryFreeBusy(creds, { timeMin, timeMax }) -> [{ start, end }]  (ISO)
 *   insertEvent(creds, { summary, description, startISO, endISO, location }) -> { id }
 *
 * tsdav handles iCloud's principal/calendar-home discovery + partition hosts.
 * Unverified against a live iCloud account yet — treat as first-cut.
 */

const crypto = require('crypto');

const ICLOUD_URL = 'https://caldav.icloud.com';

async function getClient(creds) {
  if (!creds?.email || !creds?.password) throw new Error('iCloud email + app-specific password required');
  const { createDAVClient } = await import('tsdav');
  return createDAVClient({
    serverUrl: ICLOUD_URL,
    credentials: { username: creds.email, password: creds.password },
    authMethod: 'Basic',
    defaultAccountType: 'caldav',
  });
}

/** Pick the primary writable event calendar. */
async function primaryCalendar(client) {
  const cals = await client.fetchCalendars();
  const eventCals = (cals || []).filter((c) => {
    const comps = c.components || c.calendarComponents || [];
    return comps.length === 0 || comps.includes('VEVENT');
  });
  const writable = eventCals.filter((c) => !c.readOnly);
  return writable[0] || eventCals[0] || (cals || [])[0] || null;
}

// iCloud .ics dates: "20260612T040000Z" (UTC) or "TZID=...:20260612T140000" (local)
function icsDateToISO(raw) {
  if (!raw) return null;
  const v = raw.split(':').pop().trim(); // strip any TZID= prefix
  const m = v.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/);
  if (!m) { const d = new Date(v); return isNaN(d) ? null : d.toISOString(); }
  const [, Y, Mo, D, H, Mi, S, Z] = m;
  const iso = `${Y}-${Mo}-${D}T${H}:${Mi}:${S}${Z ? 'Z' : ''}`;
  const d = new Date(iso);
  return isNaN(d) ? null : d.toISOString();
}

function toICSStamp(iso) {
  // ISO -> UTC basic format 20260612T040000Z
  return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function escapeICS(s = '') {
  return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

function buildVEvent({ uid, summary, description, startISO, endISO, location }) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//FlynnAI//iMessage agent//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${toICSStamp(new Date().toISOString())}`,
    `DTSTART:${toICSStamp(startISO)}`,
    `DTEND:${toICSStamp(endISO)}`,
    `SUMMARY:${escapeICS(summary)}`,
    description ? `DESCRIPTION:${escapeICS(description)}` : null,
    location ? `LOCATION:${escapeICS(location)}` : null,
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean);
  return lines.join('\r\n');
}

async function queryFreeBusy(creds, { timeMin, timeMax }) {
  const client = await getClient(creds);
  const cal = await primaryCalendar(client);
  if (!cal) return [];
  const objects = await client.fetchCalendarObjects({
    calendar: cal,
    timeRange: { start: new Date(timeMin).toISOString(), end: new Date(timeMax).toISOString() },
  });
  const busy = [];
  for (const o of objects || []) {
    const ics = o.data || '';
    const start = icsDateToISO(ics.match(/DTSTART[^\r\n:]*:([^\r\n]+)/)?.[1]);
    const end = icsDateToISO(ics.match(/DTEND[^\r\n:]*:([^\r\n]+)/)?.[1]);
    if (start && end) busy.push({ start, end });
  }
  return busy;
}

async function insertEvent(creds, { summary, description, startISO, endISO, location }) {
  const client = await getClient(creds);
  const cal = await primaryCalendar(client);
  if (!cal) throw new Error('no writable iCloud calendar found');
  const uid = `${crypto.randomUUID()}@flynnai.app`;
  const iCalString = buildVEvent({ uid, summary, description, startISO, endISO, location });
  await client.createCalendarObject({ calendar: cal, filename: `${uid}.ics`, iCalString });
  return { id: uid };
}

module.exports = { queryFreeBusy, insertEvent };
