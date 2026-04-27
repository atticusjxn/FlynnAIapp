/**
 * App Store Server Notifications v2 + client-initiated verify endpoint.
 *
 * ASSN2 envelope shape:
 *   {
 *     signedPayload: "<JWS>"  // body contains `data.signedTransactionInfo`
 *   }
 *
 * Client-initiated verify shape (iOS SubscriptionStore.forwardToBackend):
 *   {
 *     signedTransactionInfo: "<base64 JWT>",
 *     originalTransactionId: "..."
 *   }
 *
 * Both paths funnel into `subscriptionService.upsertFromTransaction`.
 */

const { decodeJWS, upsertFromTransaction } = require('../subscriptionService');
const { sendToUser } = require('../pushNotifier');

/**
 * Apple ASSN2 webhook handler.
 * Mount: POST /webhooks/appstore
 */
async function handleAssn2(req, res) {
  try {
    const signedPayload = req.body?.signedPayload;
    if (!signedPayload) {
      return res.status(400).json({ error: 'missing_signed_payload' });
    }

    const envelope = decodeJWS(signedPayload);
    if (!envelope) {
      return res.status(400).json({ error: 'invalid_jws' });
    }

    const notificationType = envelope.notificationType;
    const subtype = envelope.subtype;
    const signedTx = envelope.data?.signedTransactionInfo;
    const tx = signedTx ? decodeJWS(signedTx) : null;

    if (!tx) {
      // Some notification types (e.g. TEST) don't carry transaction info.
      console.log('[AppStore] ASSN2', notificationType, subtype, '(no transaction)');
      return res.status(200).json({ ok: true });
    }

    const result = await upsertFromTransaction(tx);
    console.log(
      '[AppStore] ASSN2',
      notificationType,
      subtype,
      '→',
      result.success ? 'upserted' : `skipped(${result.reason})`
    );

    // Trial-ending push: DID_RENEW notification signals a successful
    // (re)bill — the actual "trial ending in 3 days" notification is the
    // SUBSCRIBED/INITIAL_BUY path with offerType=1. Fire when we see it.
    if (
      result.success &&
      notificationType === 'SUBSCRIBED' &&
      (tx.isTrialPeriod || tx.offerType === 1)
    ) {
      sendToUser({
        userId: result.userId,
        category: 'trial_ending',
        title: 'Your Flynn trial is live',
        body: "14 days free — we'll remind you before it converts to a paid plan.",
        data: { deepLink: 'flynnai://settings/billing' },
        threadId: 'billing',
      }).catch((err) => console.error('[AppStore] push failed:', err.message));
    }

    return res.status(200).json({ ok: true, ...result });
  } catch (err) {
    console.error('[AppStore] ASSN2 handler threw:', err);
    return res.status(500).json({ error: err.message });
  }
}

/**
 * iOS client-initiated verify — called directly from SubscriptionStore right
 * after a successful purchase so the `subscriptions` row appears before ASSN2
 * arrives. Authenticated via the user's Supabase JWT (checked by upstream
 * Express middleware; this handler trusts req.userId if set).
 *
 * Mount: POST /webhooks/appstore/verify
 */
async function handleClientVerify(req, res) {
  try {
    const { signedTransactionInfo, originalTransactionId } = req.body || {};
    if (!signedTransactionInfo) {
      return res.status(400).json({ error: 'missing_signed_transaction_info' });
    }

    const tx = decodeJWS(signedTransactionInfo);
    if (!tx) {
      return res.status(400).json({ error: 'invalid_jws' });
    }

    // If iOS supplied originalTransactionId for cross-check, use it when the
    // JWS payload is missing (older transactions).
    if (!tx.originalTransactionId && originalTransactionId) {
      tx.originalTransactionId = originalTransactionId;
    }

    // Best-effort: stamp appAccountToken from auth context so the upsert can
    // resolve user_id without a prior subscriptions row.
    const authUserId = req.userId || req.user?.id;
    if (authUserId && !tx.appAccountToken) {
      tx.appAccountToken = authUserId;
    }

    const result = await upsertFromTransaction(tx);
    const statusCode = result.success ? 200 : 400;
    return res.status(statusCode).json(result);
  } catch (err) {
    console.error('[AppStore] /verify handler threw:', err);
    return res.status(500).json({ error: err.message });
  }
}

module.exports = {
  handleAssn2,
  handleClientVerify,
};
