/**
 * Google Play Billing webhooks.
 *
 *   POST /webhooks/playbilling/verify  — authenticated, called by the RN app
 *     right after a successful purchase. Body: { purchaseToken, productId }.
 *     We hit Play Developer API to verify, then upsert the subscription.
 *
 *   POST /webhooks/playbilling/rtdn    — Pub/Sub push subscription target for
 *     Real-Time Developer Notifications (subscription state changes). Body
 *     follows the standard Pub/Sub push envelope:
 *       { message: { data: <base64-json-rtdn>, messageId, ... }, subscription }
 *     RTDN payload (decoded): { version, packageName, eventTimeMillis,
 *       subscriptionNotification: { version, notificationType, purchaseToken,
 *       subscriptionId } | voidedPurchaseNotification | testNotification }
 */

const { getSubscriptionPurchase } = require('../playBillingClient');
const { upsertFromGoogleSubscription } = require('../subscriptionService');
const { supabase } = require('../supabaseClient');

async function handleClientVerify(req, res) {
  try {
    const { purchaseToken, productId } = req.body || {};
    if (!purchaseToken || !productId) {
      return res.status(400).json({ error: 'missing_purchase_token_or_product_id' });
    }

    const userId = req.user?.id || req.userId;
    if (!userId) return res.status(401).json({ error: 'unauthenticated' });

    let purchase;
    try {
      purchase = await getSubscriptionPurchase(purchaseToken);
    } catch (err) {
      console.error('[PlayBilling] verify Play API call failed:', err.message);
      return res.status(502).json({ error: 'play_api_failed', detail: err.message });
    }

    const result = await upsertFromGoogleSubscription(userId, productId, purchaseToken, purchase);
    const statusCode = result.success ? 200 : 400;
    return res.status(statusCode).json(result);
  } catch (err) {
    console.error('[PlayBilling] /verify handler threw:', err);
    return res.status(500).json({ error: err.message });
  }
}

async function handleRtdn(req, res) {
  try {
    const message = req.body?.message;
    if (!message?.data) {
      // Pub/Sub sometimes sends an empty config-test push.
      return res.status(200).json({ ok: true, ignored: 'no_data' });
    }

    let decoded;
    try {
      decoded = JSON.parse(Buffer.from(message.data, 'base64').toString('utf8'));
    } catch (err) {
      console.error('[PlayBilling] RTDN base64/json decode failed:', err.message);
      return res.status(400).json({ error: 'invalid_data' });
    }

    if (decoded.testNotification) {
      console.log('[PlayBilling] RTDN test notification received');
      return res.status(200).json({ ok: true, test: true });
    }

    const subNotif = decoded.subscriptionNotification;
    if (!subNotif) {
      console.log('[PlayBilling] RTDN non-subscription event:', Object.keys(decoded));
      return res.status(200).json({ ok: true, ignored: 'non_subscription' });
    }

    const { purchaseToken, subscriptionId } = subNotif;
    if (!purchaseToken || !subscriptionId) {
      return res.status(400).json({ error: 'missing_token_or_sub_id' });
    }

    // Look up existing subscription to find user_id (we don't have it from the
    // RTDN payload directly).
    const { data: existing } = await supabase
      .from('subscriptions')
      .select('user_id')
      .eq('google_purchase_token', purchaseToken)
      .maybeSingle();

    if (!existing?.user_id) {
      console.warn('[PlayBilling] RTDN for unknown purchase token:', purchaseToken);
      // Still 200 so Pub/Sub doesn't retry forever — log and move on.
      return res.status(200).json({ ok: true, ignored: 'unknown_token' });
    }

    let purchase;
    try {
      purchase = await getSubscriptionPurchase(purchaseToken);
    } catch (err) {
      console.error('[PlayBilling] RTDN Play API call failed:', err.message);
      return res.status(502).json({ error: 'play_api_failed' });
    }

    const result = await upsertFromGoogleSubscription(
      existing.user_id,
      subscriptionId,
      purchaseToken,
      purchase
    );
    console.log('[PlayBilling] RTDN', subNotif.notificationType, '→', result);
    return res.status(200).json({ ok: true, ...result });
  } catch (err) {
    console.error('[PlayBilling] RTDN handler threw:', err);
    return res.status(500).json({ error: err.message });
  }
}

module.exports = { handleClientVerify, handleRtdn };
