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
 * texts `${SERVER_URL}/connect/:provider?t=<jwt>` (7-day expiry) and the route
 * mints a fresh Nango session at click time, then redirects to the Connect UI.
 *
 * Env:
 *   NANGO_SECRET_KEY          secret key from the Nango dashboard environment
 *   NANGO_HOST                default https://api.nango.dev
 *   CONNECT_LINK_JWT_SECRET   signs the textable connect links
 */

const jwt = require('jsonwebtoken');

const NANGO_HOST = (process.env.NANGO_HOST || 'https://api.nango.dev').replace(/\/$/, '');
const SERVER_URL = process.env.SERVER_URL || 'https://flynnai-telephony.fly.dev';

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
 * Mint a connect session for one provider. Called at link-click time.
 * Returns { token, connectUrl } — connectUrl is the hosted Connect UI.
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
  const connectUrl = json?.data?.connect_ui_url
    || `https://connect.nango.dev?session_token=${encodeURIComponent(token)}`;
  return { token, connectUrl };
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
 * The link Flynn texts a user to connect a provider. Long-lived (7 days);
 * the /connect/:provider route swaps it for a fresh Nango session on click.
 */
function createTextableConnectLink({ userId, phone, provider }) {
  const token = jwt.sign({ uid: userId, phone, provider }, jwtSecret(), { expiresIn: '7d' });
  return `${SERVER_URL}/connect/${encodeURIComponent(provider)}?t=${token}`;
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
  verifyConnectLinkToken,
  isConfigured,
};
