/**
 * Nango Cloud — OAuth backbone for the iMessage agent's integrations.
 *
 * Nango holds the OAuth tokens (one provider config per integration:
 * google-calendar, google-mail, google-sheet, ...); our DB only stores
 * connection metadata in user_connections. connection_id = users.id, reused
 * across every provider config.
 *
 * Connect links texted to users are OURS, not Nango's: Nango connect-session
 * tokens expire in ~30 minutes and tradies tap links hours later. So Flynn
 * texts a short `${SERVER_URL}/c/<code>` link backed by the connect_links table
 * (7-day expiry); the route mints a fresh Nango session at click time, then
 * redirects to the Connect UI. The short code keeps the texted link tappable
 * instead of a 250-char JWT taking up half the screen. (A legacy
 * `/connect/:provider?t=<jwt>` form is still honoured for older texted links.)
 *
 * Env:
 *   NANGO_SECRET_KEY          secret key from the Nango dashboard environment
 *   NANGO_HOST                default https://api.nango.dev
 *   CONNECT_LINK_JWT_SECRET   signs the legacy textable connect links
 */

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');

const NANGO_HOST = (process.env.NANGO_HOST || 'https://api.nango.dev').replace(/\/$/, '');
const SERVER_URL = process.env.SERVER_URL || 'https://flynnai-telephony.fly.dev';
const CONNECT_LINK_TTL_MS = 7 * 24 * 60 * 60 * 1000;

let _supabase;
function supabase() {
  if (_supabase !== undefined) return _supabase;
  const url = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_SECRET;
  _supabase = url && key
    ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
    : null;
  return _supabase;
}

function secretKey() {
  const key = (process.env.NANGO_SECRET_KEY || '').trim();
  if (!key) throw new Error('NANGO_SECRET_KEY is not configured');
  return key;
}

function jwtSecret() {
  const s = (process.env.CONNECT_LINK_JWT_SECRET || '').trim();
  if (!s) throw new Error('CONNECT_LINK_JWT_SECRET is not configured');
  return s;
}

async function nangoFetch(path, { method = 'GET', body, headers = {} } = {}) {
  const res = await fetch(`${NANGO_HOST}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const err = new Error(`Nango ${method} ${path} failed (${res.status}): ${text.slice(0, 300)}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

/**
 * Mint a connect session for one provider and return the URL to send the user
 * to. We skip Nango's hosted Connect UI (it runs on a separate internal port we
 * don't expose) and use the server's direct OAuth-initiate endpoint instead:
 * GET /oauth/connect/:provider?connect_session_token=... 302s straight to the
 * provider's consent screen, redirect_uri on our own NANGO_HOST domain. Single
 * port, no Connect UI needed.
 */
async function createConnectSession({ userId, phone, provider }) {
  const json = await nangoFetch('/connect/sessions', {
    method: 'POST',
    body: {
      end_user: { id: userId, display_name: phone },
      allowed_integrations: [provider],
    },
  });
  const token = json?.data?.token || json?.token;
  if (!token) throw new Error('Nango connect session returned no token');
  const connectUrl = `${NANGO_HOST}/oauth/connect/${encodeURIComponent(provider)}?connect_session_token=${encodeURIComponent(token)}`;
  return { token, connectUrl };
}

/**
 * Find the Nango connection_id for an end user + provider, or null. The connect
 * session flow auto-generates the connection_id (it isn't our users.id), so the
 * webhook-free reconcile path looks it up by end user here.
 */
async function findConnectionId(provider, endUserId) {
  const json = await nangoFetch(`/connection?endUserId=${encodeURIComponent(endUserId)}`);
  const conns = json?.connections || json?.data || [];
  const match = conns.find((c) => (c.provider_config_key || c.provider) === provider);
  return match?.connection_id || match?.id || null;
}

/**
 * Fresh access token for a connection (Nango refreshes server-side).
 */
async function getToken(provider, connectionId) {
  const json = await nangoFetch(
    `/connection/${encodeURIComponent(connectionId)}?provider_config_key=${encodeURIComponent(provider)}`
  );
  const creds = json?.credentials || json?.data?.credentials;
  const token = creds?.access_token;
  if (!token) throw new Error(`No access token on Nango connection ${provider}/${connectionId}`);
  return token;
}

/**
 * Proxy an API call through Nango (it injects fresh auth). endpoint is the
 * path on the provider's API base configured in the Nango dashboard, or a
 * full URL when the provider config has no base URL set.
 */
async function proxy({ provider, connectionId, method = 'GET', endpoint, data, params }) {
  const qs = params ? `?${new URLSearchParams(params)}` : '';
  const res = await fetch(`${NANGO_HOST}/proxy${endpoint}${qs}`, {
    method,
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      'Content-Type': 'application/json',
      'Connection-Id': connectionId,
      'Provider-Config-Key': provider,
    },
    body: data ? JSON.stringify(data) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const err = new Error(`Nango proxy ${method} ${endpoint} failed (${res.status}): ${text.slice(0, 300)}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

/**
 * The short link Flynn texts a user to connect a provider. Stores a one-off
 * code in connect_links (7-day expiry); the /c/:code route swaps it for a
 * fresh Nango session on click. Short and tappable, so it doesn't dominate the
 * thread. Falls back to the legacy JWT link if the DB isn't available.
 */
async function createTextableConnectLink({ userId, phone, provider }) {
  const db = supabase();
  if (db) {
    // url-safe, unguessable, short (~11 chars).
    const code = crypto.randomBytes(8).toString('base64url');
    const { error } = await db.from('connect_links').insert({
      code,
      user_id: userId || null,
      user_phone: phone,
      provider,
      expires_at: new Date(Date.now() + CONNECT_LINK_TTL_MS).toISOString(),
    });
    if (!error) return `${SERVER_URL}/c/${code}`;
    console.warn('[Nango] connect_links insert failed, falling back to JWT link:', error.message);
  }
  // Fallback: stateless JWT link (long, but works without the table).
  const token = jwt.sign({ uid: userId, phone, provider }, jwtSecret(), { expiresIn: '7d' });
  return `${SERVER_URL}/connect/${encodeURIComponent(provider)}?t=${token}`;
}

/**
 * Resolve a short code to its claims, or null if missing/expired.
 * Consumes nothing — connecting is idempotent and a user may retap the link.
 */
async function resolveConnectCode(code) {
  const db = supabase();
  if (!db) return null;
  const { data } = await db
    .from('connect_links')
    .select('user_id, user_phone, provider, expires_at')
    .eq('code', code)
    .maybeSingle();
  if (!data) return null;
  if (new Date(data.expires_at).getTime() < Date.now()) return null;
  return { uid: data.user_id, phone: data.user_phone, provider: data.provider };
}

function verifyConnectLinkToken(token) {
  return jwt.verify(token, jwtSecret()); // throws on bad/expired
}

function isConfigured() {
  return Boolean((process.env.NANGO_SECRET_KEY || '').trim());
}

module.exports = {
  createConnectSession,
  getToken,
  proxy,
  createTextableConnectLink,
  resolveConnectCode,
  findConnectionId,
  verifyConnectLinkToken,
  isConfigured,
};
