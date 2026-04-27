/**
 * Google Play Developer API client for subscription verification.
 *
 * Uses a service-account JWT exchanged for an OAuth2 access token, then calls
 * androidpublisher v3 to verify a purchase token. No `googleapis` dep — keeps
 * the bundle small and the surface auditable.
 *
 * Required env:
 *   GOOGLE_PLAY_SERVICE_ACCOUNT_JSON  — full JSON of the service account
 *   GOOGLE_PLAY_PACKAGE_NAME          — Android package name (e.g. com.flynnai)
 *
 * The service account must have the "View financial data" + "Manage orders"
 * permissions in Google Play Console > Setup > API access.
 */

const jwt = require('jsonwebtoken');

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/androidpublisher';

let cachedToken = null;
let cachedTokenExpiry = 0;
let serviceAccount = null;

function loadServiceAccount() {
  if (serviceAccount) return serviceAccount;
  const raw = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON not set');
  try {
    serviceAccount = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Invalid GOOGLE_PLAY_SERVICE_ACCOUNT_JSON: ${err.message}`);
  }
  if (!serviceAccount.client_email || !serviceAccount.private_key) {
    throw new Error('Service account JSON missing client_email or private_key');
  }
  return serviceAccount;
}

async function getAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedTokenExpiry - 60 > now) return cachedToken;

  const sa = loadServiceAccount();
  const assertion = jwt.sign(
    {
      iss: sa.client_email,
      scope: SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    },
    sa.private_key,
    { algorithm: 'RS256' }
  );

  const params = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion,
  });

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OAuth2 token exchange failed (${res.status}): ${body}`);
  }
  const json = await res.json();
  cachedToken = json.access_token;
  cachedTokenExpiry = now + json.expires_in;
  return cachedToken;
}

/**
 * Verify a subscription purchase token via androidpublisher v3.
 * Returns the SubscriptionPurchaseV2 resource on success.
 * Docs: https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.subscriptionsv2/get
 */
async function getSubscriptionPurchase(purchaseToken) {
  const packageName = process.env.GOOGLE_PLAY_PACKAGE_NAME;
  if (!packageName) throw new Error('GOOGLE_PLAY_PACKAGE_NAME not set');

  const accessToken = await getAccessToken();
  const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(packageName)}/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Play Developer API verify failed (${res.status}): ${body}`);
  }
  return res.json();
}

module.exports = {
  getSubscriptionPurchase,
};
