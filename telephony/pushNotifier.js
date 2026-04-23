/**
 * APNs push notifier.
 *
 * Uses Apple's HTTP/2 provider API with a token-based authentication
 * (`.p8` auth key + key id + team id). One notification per device token.
 *
 * Configuration via env:
 *   APNS_AUTH_KEY_PATH  — absolute path to the downloaded AuthKey_*.p8
 *   APNS_KEY_ID         — 10-char string printed alongside the key
 *   APNS_TEAM_ID        — Apple Developer team id
 *   APNS_BUNDLE_ID      — com.flynnai.app.native
 *   APNS_PRODUCTION     — '1' for production host, '0' (default) for dev
 *
 * The `apn` package isn't installed yet — we use HTTP/2 directly via Node's
 * built-in `http2` module so we have no new dependency until deploy time.
 */

const http2 = require('http2');
const fs = require('fs');
const jwt = require('jsonwebtoken'); // already pulled in transitively; falls back below

const { supabase } = require('./supabaseClient');

const PRODUCTION = process.env.APNS_PRODUCTION === '1';
const APNS_HOST = PRODUCTION ? 'api.push.apple.com' : 'api.sandbox.push.apple.com';
const BUNDLE_ID = process.env.APNS_BUNDLE_ID || 'com.flynnai.app.native';

let cachedToken = null;
let cachedTokenExpires = 0;

function apnsProviderToken() {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && now < cachedTokenExpires - 60) return cachedToken;

  const keyId = process.env.APNS_KEY_ID;
  const teamId = process.env.APNS_TEAM_ID;
  const keyPath = process.env.APNS_AUTH_KEY_PATH;
  if (!keyId || !teamId || !keyPath) {
    throw new Error('APNs env not set (APNS_KEY_ID, APNS_TEAM_ID, APNS_AUTH_KEY_PATH)');
  }
  const privateKey = fs.readFileSync(keyPath, 'utf8');
  cachedToken = jwt.sign({ iss: teamId, iat: now }, privateKey, {
    algorithm: 'ES256',
    header: { alg: 'ES256', kid: keyId },
  });
  cachedTokenExpires = now + 3000; // Apple accepts tokens up to ~1h old.
  return cachedToken;
}

/**
 * Sends a single push. Resolves when APNs returns a final status.
 *
 * @param {object} opts
 * @param {string} opts.deviceToken  — hex-encoded APNs token (from iOS).
 * @param {string} opts.title
 * @param {string} opts.body
 * @param {object} [opts.data]       — custom payload (deep-link target etc.)
 * @param {string} [opts.threadId]   — groups notifications in Notification Center
 */
async function sendPush({ deviceToken, title, body, data = {}, threadId }) {
  if (!deviceToken) return { success: false, reason: 'no_device_token' };

  const providerToken = apnsProviderToken();
  const payload = JSON.stringify({
    aps: {
      alert: { title, body },
      sound: 'default',
      'thread-id': threadId,
    },
    flynn: data,
  });

  return new Promise((resolve) => {
    const client = http2.connect(`https://${APNS_HOST}`);
    let settled = false;
    const settle = (result) => {
      if (settled) return;
      settled = true;
      try { client.close(); } catch {}
      resolve(result);
    };

    client.on('error', (err) => settle({ success: false, reason: err.message }));

    const req = client.request({
      ':method': 'POST',
      ':path': `/3/device/${deviceToken}`,
      'apns-topic': BUNDLE_ID,
      'apns-push-type': 'alert',
      'apns-priority': '10',
      authorization: `bearer ${providerToken}`,
      'content-type': 'application/json',
      'content-length': Buffer.byteLength(payload),
    });

    let statusCode = 0;
    let responseBody = '';
    req.on('response', (headers) => { statusCode = headers[':status']; });
    req.on('data', (chunk) => { responseBody += chunk.toString('utf8'); });
    req.on('end', () => {
      settle({
        success: statusCode === 200,
        statusCode,
        reason: statusCode === 200 ? null : (responseBody || `status_${statusCode}`),
      });
    });
    req.on('error', (err) => settle({ success: false, reason: err.message }));

    req.write(payload);
    req.end();
  });
}

/**
 * Convenience — resolves the user's current push_token + notification_prefs
 * and honours the per-category toggle before sending.
 *
 * @param {string} category  — 'new_call' | 'usage_warning' | 'trial_ending'
 */
async function sendToUser({ userId, category, title, body, data = {}, threadId }) {
  const { data: user } = await supabase
    .from('users')
    .select('push_token, notification_prefs')
    .eq('id', userId)
    .maybeSingle();
  if (!user?.push_token) return { success: false, reason: 'no_push_token' };
  const prefs = user.notification_prefs || {};
  if (prefs[category] === false) return { success: false, reason: 'user_disabled' };
  return sendPush({ deviceToken: user.push_token, title, body, data, threadId });
}

module.exports = {
  sendPush,
  sendToUser,
};
