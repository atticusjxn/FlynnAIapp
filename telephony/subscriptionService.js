/**
 * App Store subscription service.
 *
 * Responsibilities:
 *   1. Decode signed JWS transaction info from Apple (both ASSN2 webhook
 *      payloads and iOS-initiated /verify calls).
 *   2. Cross-reference the `productID` with our Supabase `plans` table.
 *   3. Upsert the `subscriptions` row keyed on `apple_original_transaction_id`.
 *
 * We intentionally do NOT validate the JWS signature chain here — that
 * belongs in an explicit verify step using Apple's root certs. For launch
 * the server trusts payloads coming from (a) Apple's webhook endpoint with
 * a pinned IP/host or (b) authenticated iOS clients. Add chain verification
 * (apple-root-cert + intermediate) before public release.
 */

const { supabase } = require('./supabaseClient');

/**
 * Decode an App Store signed JWS payload without cryptographic verification.
 * `payload` can be either a base64-encoded JWT string or a raw JWT string.
 */
function decodeJWS(jws) {
  if (!jws || typeof jws !== 'string') return null;
  // Handle base64 wrapping (iOS client-initiated path uses base64).
  let token = jws;
  if (!jws.includes('.')) {
    try {
      token = Buffer.from(jws, 'base64').toString('utf8');
    } catch {
      return null;
    }
  }
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    const payload = JSON.parse(
      Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
    );
    return payload;
  } catch (err) {
    console.error('[AppStore] JWS decode failed:', err.message);
    return null;
  }
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

module.exports = {
  decodeJWS,
  deriveStatus,
  upsertFromTransaction,
};
