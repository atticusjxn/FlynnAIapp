/**
 * App Store subscription service.
 *
 * Responsibilities:
 *   1. Decode + verify signed JWS transaction info from Apple (ASSN2 webhook
 *      payloads and iOS-initiated /verify calls). Verification uses x5c chain
 *      validation against Apple's root CA when configured.
 *   2. Cross-reference the `productID` with our Supabase `plans` table.
 *   3. Upsert the `subscriptions` row keyed on `apple_original_transaction_id`.
 */

const crypto = require('crypto');
const fs = require('fs');
const { supabase } = require('./supabaseClient');

const APPLE_ROOT_CERT_PATH = process.env.APPLE_ROOT_CA_PATH;
const EXPECTED_BUNDLE_ID = process.env.APPLE_BUNDLE_ID || 'com.flynnai.app';
const EXPECTED_ENVIRONMENT = process.env.APPLE_ENVIRONMENT; // 'Sandbox' | 'Production' | undefined (allow either)

let appleRootCert = null;
const _loadAppleCert = () => {
  // Prefer raw PEM in env var (works in containerised/serverless deploy without
  // needing the cert file on disk). Fall back to file path for local dev.
  const pemContent = process.env.APPLE_ROOT_CA_PEM;
  if (pemContent) {
    return new crypto.X509Certificate(pemContent);
  }
  if (APPLE_ROOT_CERT_PATH) {
    const pem = fs.readFileSync(APPLE_ROOT_CERT_PATH, 'utf8');
    return new crypto.X509Certificate(pem);
  }
  return null;
};
try {
  appleRootCert = _loadAppleCert();
  if (appleRootCert) {
    console.log('[AppStore] Apple root CA loaded — JWS chain verification enabled.');
  } else {
    console.warn('[AppStore] Neither APPLE_ROOT_CA_PEM nor APPLE_ROOT_CA_PATH set — JWS chain verification disabled. SET BEFORE PRODUCTION.');
  }
} catch (err) {
  console.error('[AppStore] Failed to load Apple root CA:', err.message);
}

function b64urlDecode(str) {
  return Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

/**
 * Verify the JWS signature using the leaf cert's public key, then validate the
 * x5c chain terminates at Apple's root CA. Returns the payload on success,
 * null on failure. If APPLE_ROOT_CA_PATH is not configured, falls back to
 * decode-only with a one-time warning above (sandbox/internal-test escape hatch).
 */
function verifyAndDecodeJWS(jws) {
  if (!jws || typeof jws !== 'string') return null;
  let token = jws;
  if (!jws.includes('.')) {
    try { token = Buffer.from(jws, 'base64').toString('utf8'); } catch { return null; }
  }
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [headerB64, payloadB64, signatureB64] = parts;

  let header;
  let payload;
  try {
    header = JSON.parse(b64urlDecode(headerB64).toString('utf8'));
    payload = JSON.parse(b64urlDecode(payloadB64).toString('utf8'));
  } catch (err) {
    console.error('[AppStore] JWS parse failed:', err.message);
    return null;
  }

  // Always-on cheap checks — block trivial spoofing even without cert chain.
  if (payload.bundleId && !payload.bundleId.startsWith(EXPECTED_BUNDLE_ID)) {
    console.error('[AppStore] JWS bundleId mismatch:', payload.bundleId, '!= expected prefix', EXPECTED_BUNDLE_ID);
    return null;
  }
  if (EXPECTED_ENVIRONMENT && payload.environment && payload.environment !== EXPECTED_ENVIRONMENT) {
    console.error('[AppStore] JWS environment mismatch:', payload.environment, '!=', EXPECTED_ENVIRONMENT);
    return null;
  }

  // If root cert not configured, accept the payload but stay loud.
  if (!appleRootCert) return payload;

  // x5c chain verification.
  const x5c = header.x5c;
  if (!Array.isArray(x5c) || x5c.length === 0) {
    console.error('[AppStore] JWS missing x5c header');
    return null;
  }

  let leafCert;
  let chain;
  try {
    chain = x5c.map((b64) => new crypto.X509Certificate(Buffer.from(b64, 'base64')));
    leafCert = chain[0];
  } catch (err) {
    console.error('[AppStore] x5c parse failed:', err.message);
    return null;
  }

  // Verify each cert in the chain is signed by the next one, and the last is
  // signed by Apple root.
  for (let i = 0; i < chain.length - 1; i += 1) {
    if (!chain[i].verify(chain[i + 1].publicKey)) {
      console.error('[AppStore] x5c chain link', i, 'failed to verify against next cert');
      return null;
    }
  }
  if (!chain[chain.length - 1].verify(appleRootCert.publicKey)) {
    console.error('[AppStore] x5c chain root does not verify against Apple root CA');
    return null;
  }

  // Verify JWS signature with leaf cert public key (ES256).
  const signingInput = `${headerB64}.${payloadB64}`;
  const signatureRaw = b64urlDecode(signatureB64);
  // ES256 sig is r||s (64 bytes); convert to DER for crypto.verify.
  const derSig = ecdsaRawToDer(signatureRaw);
  const verifier = crypto.createVerify('SHA256');
  verifier.update(signingInput);
  if (!verifier.verify(leafCert.publicKey, derSig)) {
    console.error('[AppStore] JWS signature verification failed');
    return null;
  }

  return payload;
}

// Convert raw ECDSA r||s signature to ASN.1 DER (Node's verify expects DER).
function ecdsaRawToDer(raw) {
  const half = raw.length / 2;
  const r = trimLeadingZeros(raw.subarray(0, half));
  const s = trimLeadingZeros(raw.subarray(half));
  const rEnc = encodeInt(r);
  const sEnc = encodeInt(s);
  return Buffer.concat([Buffer.from([0x30, rEnc.length + sEnc.length]), rEnc, sEnc]);
}
function trimLeadingZeros(buf) {
  let i = 0;
  while (i < buf.length - 1 && buf[i] === 0) i += 1;
  return buf.subarray(i);
}
function encodeInt(buf) {
  // Prepend 0x00 if high bit is set so it's interpreted as positive.
  const needsPad = buf[0] & 0x80;
  const body = needsPad ? Buffer.concat([Buffer.from([0]), buf]) : buf;
  return Buffer.concat([Buffer.from([0x02, body.length]), body]);
}

/**
 * Backwards-compatible name used by webhook handlers. Prefer verifyAndDecodeJWS
 * for new code; this is just an alias for clarity at call sites.
 */
function decodeJWS(jws) {
  return verifyAndDecodeJWS(jws);
}

/**
 * Map Apple's transaction payload to our `subscriptions.status` enum.
 * Reference: https://developer.apple.com/documentation/appstoreservernotifications/notificationtype
 */
function deriveStatus(tx) {
  const now = Date.now();
  if (tx.revocationDate) return 'refunded';
  if (tx.expiresDate && tx.expiresDate < now) return 'expired';
  if (tx.gracePeriodExpiresDate && tx.gracePeriodExpiresDate > now) return 'grace_period';
  if (tx.isTrialPeriod || tx.offerType === 1) return 'trialing';
  return 'active';
}

async function planForProductId(productId) {
  const { data, error } = await supabase
    .from('plans')
    .select('id, ai_minutes_monthly')
    .eq('apple_product_id', productId)
    .maybeSingle();
  if (error) {
    console.error('[AppStore] plans lookup failed:', error.message);
    return null;
  }
  return data;
}

async function userIdForTransaction(tx) {
  // Apple provides an `appAccountToken` (a UUID) — iOS should set it at
  // purchase time to the Supabase user_id. If missing, fall back to lookup
  // by original transaction id (existing subscription record).
  if (tx.appAccountToken) return tx.appAccountToken;

  const originalTx = tx.originalTransactionId;
  if (!originalTx) return null;

  const { data } = await supabase
    .from('subscriptions')
    .select('user_id')
    .eq('apple_original_transaction_id', String(originalTx))
    .maybeSingle();
  return data?.user_id || null;
}

/**
 * Upsert a subscription row from a decoded Apple transaction payload.
 *
 * @param {object} tx — decoded JWS body (productId, expiresDate, originalTransactionId,
 *                     transactionId, revocationDate, appAccountToken, purchaseDate …)
 */
async function upsertFromTransaction(tx) {
  if (!tx || !tx.productId || !tx.originalTransactionId) {
    console.warn('[AppStore] upsertFromTransaction called with incomplete payload');
    return { success: false, reason: 'incomplete_payload' };
  }

  const plan = await planForProductId(tx.productId);
  if (!plan) return { success: false, reason: 'unknown_product_id' };

  const userId = await userIdForTransaction(tx);
  if (!userId) return { success: false, reason: 'unresolved_user' };

  const status = deriveStatus(tx);
  const currentPeriodStart = tx.purchaseDate
    ? new Date(tx.purchaseDate).toISOString()
    : new Date().toISOString();
  const currentPeriodEnd = tx.expiresDate
    ? new Date(tx.expiresDate).toISOString()
    : null;
  const trialEndAt = tx.isTrialPeriod && tx.expiresDate
    ? new Date(tx.expiresDate).toISOString()
    : null;

  const row = {
    user_id: userId,
    plan_id: plan.id,
    status,
    trial_end_at: trialEndAt,
    current_period_start: currentPeriodStart,
    current_period_end: currentPeriodEnd,
    apple_original_transaction_id: String(tx.originalTransactionId),
    apple_latest_transaction_id: tx.transactionId ? String(tx.transactionId) : null,
    cancelled_at: tx.revocationDate ? new Date(tx.revocationDate).toISOString() : null,
  };

  const { error } = await supabase
    .from('subscriptions')
    .upsert(row, { onConflict: 'apple_original_transaction_id' });

  if (error) {
    console.error('[AppStore] subscriptions upsert failed:', error.message);
    return { success: false, reason: error.message };
  }
  return { success: true, userId, planId: plan.id, status };
}

/**
 * Upsert a subscription row from a verified Google Play SubscriptionPurchaseV2.
 *
 * Requires migration adding columns to `subscriptions`:
 *   google_purchase_token text unique
 *   google_product_id text
 *   google_linked_purchase_token text
 * And to `plans`:
 *   google_product_id text
 *
 * @param {string} userId — Supabase user id (resolved from authenticated request)
 * @param {string} productId — Play product id (e.g. com.flynnai.starter.monthly)
 * @param {string} purchaseToken — original purchase token from Play Billing
 * @param {object} purchase — SubscriptionPurchaseV2 resource from Play Developer API
 */
async function upsertFromGoogleSubscription(userId, productId, purchaseToken, purchase) {
  if (!userId || !productId || !purchaseToken) {
    return { success: false, reason: 'incomplete_payload' };
  }

  const { data: plan } = await supabase
    .from('plans')
    .select('id')
    .eq('google_product_id', productId)
    .maybeSingle();
  if (!plan) return { success: false, reason: 'unknown_product_id' };

  // SubscriptionPurchaseV2 fields:
  //   subscriptionState: SUBSCRIPTION_STATE_ACTIVE | _CANCELED | _IN_GRACE_PERIOD | ...
  //   lineItems[0].expiryTime
  //   startTime
  //   linkedPurchaseToken (set on upgrade/downgrade — old token)
  const state = purchase.subscriptionState || '';
  let status = 'active';
  if (state === 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD') status = 'grace_period';
  else if (state === 'SUBSCRIPTION_STATE_CANCELED' || state === 'SUBSCRIPTION_STATE_EXPIRED') status = 'expired';
  else if (state === 'SUBSCRIPTION_STATE_ACTIVE' && purchase.lineItems?.[0]?.offerDetails?.basePlanId?.includes('trial')) status = 'trialing';
  // Cheap trial detector: most setups put the intro offer on the base plan;
  // if your Play Console uses a separate offer phase, refine this.
  if (purchase.paused) status = 'paused';

  const expiry = purchase.lineItems?.[0]?.expiryTime;
  const start = purchase.startTime;

  const row = {
    user_id: userId,
    plan_id: plan.id,
    status,
    current_period_start: start || new Date().toISOString(),
    current_period_end: expiry || null,
    trial_end_at: status === 'trialing' ? expiry : null,
    google_purchase_token: purchaseToken,
    google_product_id: productId,
    google_linked_purchase_token: purchase.linkedPurchaseToken || null,
    cancelled_at: state === 'SUBSCRIPTION_STATE_CANCELED' ? new Date().toISOString() : null,
  };

  const { error } = await supabase
    .from('subscriptions')
    .upsert(row, { onConflict: 'google_purchase_token' });
  if (error) {
    console.error('[PlayBilling] subscriptions upsert failed:', error.message);
    return { success: false, reason: error.message };
  }
  return { success: true, userId, planId: plan.id, status };
}

module.exports = {
  decodeJWS,
  verifyAndDecodeJWS,
  deriveStatus,
  upsertFromTransaction,
  upsertFromGoogleSubscription,
};
