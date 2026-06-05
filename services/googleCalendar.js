/**
 * Google Calendar service
 *
 * Reads availability (free/busy) to propose real open slots and writes events
 * when a time is agreed. Reuses the OAuth tokens stored in integration_connections
 * by the existing /api/integrations/google-calendar/callback flow (keyed by
 * org_id, provider='google_calendar').
 *
 * Adds the token-refresh that didn't previously exist: short-lived Google access
 * tokens are refreshed from the stored refresh_token on demand.
 */

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_CAL_BASE = 'https://www.googleapis.com/calendar/v3';

/**
 * Resolve the Google Calendar connection row for a user (via their org).
 * Returns { connection, orgId } or { connection: null }.
 */
const getConnectionForUser = async (supabase, userId) => {
  const { data: userRow } = await supabase
    .from('users')
    .select('default_org_id')
    .eq('id', userId)
    .maybeSingle();
  const orgId = userRow?.default_org_id;
  if (!orgId) return { connection: null, orgId: null };

  const { data: connection } = await supabase
    .from('integration_connections')
    .select('*')
    .eq('org_id', orgId)
    .eq('provider', 'google_calendar')
    .eq('status', 'connected')
    .maybeSingle();

  return { connection: connection || null, orgId };
};

/**
 * Return a valid (refreshed if needed) access token for a connection row.
 * Persists a refreshed token back to integration_connections.
 */
const ensureFreshAccessToken = async (supabase, connection) => {
  const expiresAt = connection?.token_expires_at ? new Date(connection.token_expires_at).getTime() : 0;
  const stillValid = expiresAt - Date.now() > 60 * 1000; // 60s safety margin
  if (stillValid && connection.access_token) {
    return connection.access_token;
  }

  const clientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('Google Calendar OAuth credentials not configured');
  }
  if (!connection?.refresh_token) {
    throw new Error('No Google refresh token on file; user must reconnect');
  }

  const resp = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: connection.refresh_token,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    const err = new Error('Google token refresh failed');
    err.status = resp.status;
    err.body = body;
    throw err;
  }
  const tokens = await resp.json();
  const newExpiresAt = new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString();

  await supabase
    .from('integration_connections')
    .update({
      access_token: tokens.access_token,
      token_expires_at: newExpiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq('id', connection.id);

  return tokens.access_token;
};

/**
 * Query free/busy for a calendar over a time range.
 * Returns an array of { start, end } busy intervals (ISO strings).
 */
const queryFreeBusy = async (accessToken, { timeMin, timeMax, calendarId = 'primary' }) => {
  const resp = await fetch(`${GOOGLE_CAL_BASE}/freeBusy`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ timeMin, timeMax, items: [{ id: calendarId }] }),
  });
  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    const err = new Error('Google freeBusy query failed');
    err.status = resp.status;
    err.body = body;
    throw err;
  }
  const json = await resp.json();
  return json?.calendars?.[calendarId]?.busy || [];
};

/**
 * Insert an event. start/end are ISO datetimes; timeZone is an IANA id so Google
 * interprets the wall-clock correctly. Returns the created event.
 */
const insertEvent = async (accessToken, {
  calendarId = 'primary',
  summary,
  description = '',
  startISO,
  endISO,
  timeZone = 'Australia/Sydney',
  location,
}) => {
  const body = {
    summary,
    description,
    start: { dateTime: startISO, timeZone },
    end: { dateTime: endISO, timeZone },
  };
  if (location) body.location = location;

  const resp = await fetch(
    `${GOOGLE_CAL_BASE}/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  );
  if (!resp.ok) {
    const errBody = await resp.text().catch(() => '');
    const err = new Error('Google event insert failed');
    err.status = resp.status;
    err.body = errBody;
    throw err;
  }
  return resp.json();
};

module.exports = {
  getConnectionForUser,
  ensureFreshAccessToken,
  queryFreeBusy,
  insertEvent,
};
