/**
 * Nango OAuth backbone routes (mounted only when NANGO_SECRET_KEY is set).
 *
 *   GET  /c/:code                     the short link Flynn texts users. Looks
 *                                     up the code in connect_links, mints a
 *                                     fresh Nango connect session at click time
 *                                     (their session tokens only live ~30 min),
 *                                     302s to the hosted Connect UI.
 *   GET  /connect/:provider?t=<jwt>   legacy form of the same link (verifies a
 *                                     7-day JWT instead of a short code); kept
 *                                     so links texted before the short-code
 *                                     switch still work.
 *   POST /webhooks/nango              auth webhook from Nango Cloud. Upserts
 *                                     user_connections, updates the brain's
 *                                     integration bookkeeping, resumes any
 *                                     action parked on this provider, and
 *                                     texts the user the outcome.
 */

const express = require('express');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const nango = require('../services/nango');
const { sendToUser } = require('../services/flynnOutbound');
const { recordNangoConnection, reconcileNangoConnection } = require('../services/agent/agentLoop');

const router = express.Router();

const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_KEY ||
  process.env.SUPABASE_SECRET;

const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

// PROVIDER_TO_BRAIN_SLUG / CONNECTED_BLURB and the connection-recording logic
// now live in services/agent/agentLoop.js so the webhook, the /connected
// landing page, and the inbound poll-reconcile all behave identically.

const SUCCESS_PAGE = (line) =>
  `<html><body style="font-family:-apple-system,sans-serif;padding:40px;text-align:center"><h2>You're connected ✅</h2><p>${line}</p><p style="color:#888">Head back to Messages, Flynn's got it from here.</p></body></html>`;

const EXPIRED_LINK_PAGE =
  '<html><body style="font-family:-apple-system,sans-serif;padding:40px;text-align:center"><h2>This link has expired</h2><p>Text Flynn and ask to connect again, you\'ll get a fresh one.</p></body></html>';

// ---------------------------------------------------------------------------
// GET /c/:code  — short connect link
// ---------------------------------------------------------------------------

router.get('/c/:code', async (req, res) => {
  try {
    const claims = await nango.resolveConnectCode(String(req.params.code || ''));
    if (!claims) throw new Error('unknown or expired code');

    const { connectUrl } = await nango.createConnectSession({
      userId: claims.uid,
      phone: claims.phone,
      provider: claims.provider,
    });
    return res.redirect(302, connectUrl);
  } catch (err) {
    console.warn('[NangoConnect] short link rejected:', err?.message);
    return res.status(410).send(EXPIRED_LINK_PAGE);
  }
});

// ---------------------------------------------------------------------------
// GET /connect/:provider?t=<jwt>  — legacy connect link
// ---------------------------------------------------------------------------

router.get('/connect/:provider', async (req, res) => {
  const { provider } = req.params;
  const token = req.query.t;

  try {
    const claims = nango.verifyConnectLinkToken(String(token || ''));
    if (claims.provider !== provider) throw new Error('provider mismatch');

    const { connectUrl } = await nango.createConnectSession({
      userId: claims.uid,
      phone: claims.phone,
      provider,
    });
    return res.redirect(302, connectUrl);
  } catch (err) {
    console.warn('[NangoConnect] connect link rejected:', err?.message);
    return res.status(410).send(EXPIRED_LINK_PAGE);
  }
});

// ---------------------------------------------------------------------------
// POST /webhooks/nango
// ---------------------------------------------------------------------------

function timingSafeHexEqual(expected, provided) {
  if (!provided || provided.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
}

// Current scheme: X-Nango-Hmac-Sha256 = HMAC-SHA256(rawBody) keyed with the
// webhook "Signing key" (Environment Settings -> Webhooks). Nango also sends a
// legacy X-Nango-Signature = SHA256(secretKey + rawBody); accepted as fallback
// when no signing key is configured.
function verifyNangoSignature(rawBody, headers) {
  const signingKey = (process.env.NANGO_WEBHOOK_SECRET || '').trim();
  if (signingKey) {
    const expected = crypto.createHmac('sha256', signingKey).update(rawBody).digest('hex');
    return timingSafeHexEqual(expected, String(headers['x-nango-hmac-sha256'] || ''));
  }
  const secret = (process.env.NANGO_SECRET_KEY || '').trim();
  if (!secret) return false;
  const expected = crypto.createHash('sha256').update(`${secret}${rawBody}`).digest('hex');
  return timingSafeHexEqual(expected, String(headers['x-nango-signature'] || ''));
}

router.post('/webhooks/nango', express.raw({ type: 'application/json' }), async (req, res) => {
  const rawBody = req.body instanceof Buffer ? req.body.toString('utf8') : JSON.stringify(req.body || {});

  if (!verifyNangoSignature(rawBody, req.headers)) {
    console.warn('[NangoWebhook] Invalid signature — ignoring');
    return res.sendStatus(401);
  }

  // Ack immediately; Nango retries on non-2xx and our work isn't its problem.
  res.sendStatus(200);

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return;
  }

  if (payload?.type !== 'auth' || payload?.operation !== 'creation' || payload?.success === false) return;
  if (!supabase) return;

  const provider = payload.providerConfigKey;
  const connectionId = payload.connectionId;
  // Current payloads carry the end user under tags; older shapes used endUser.
  const endUserId = payload.tags?.end_user_id || payload.endUser?.endUserId || payload.endUser?.id || null;

  try {
    // Resolve the user: end_user.id is set to users.id when the session is minted.
    let user = null;
    if (endUserId) {
      const { data } = await supabase
        .from('users')
        .select('id, phone, business_brain, preferred_channel')
        .eq('id', endUserId)
        .maybeSingle();
      user = data;
    }
    if (!user?.phone) {
      console.warn('[NangoWebhook] No user found for connection', { provider, connectionId, endUserId });
      return;
    }

    const accountLabel = payload.tags?.end_user_email || payload.endUser?.email || null;
    const bubbles = await recordNangoConnection({ supabase, user, provider, connectionId, accountLabel });
    await sendToUser(user.phone, bubbles, { channel: user.preferred_channel || 'imessage', supabase });
    console.log('[NangoWebhook] Connection stored + user notified', { provider, phone: user.phone });
  } catch (err) {
    console.error('[NangoWebhook] Error handling auth webhook:', err?.message || err);
  }
});

// ---------------------------------------------------------------------------
// GET /connected?c=<code>  — post-consent landing page
//
// The webhook-free completion path for self-hosted Nango (which has no
// webhooks on the free tier). The Connect UI can redirect here after consent;
// it can also be reached directly. We resolve the short code to the user +
// provider, poll Nango to confirm the connection is live, record it, resume
// any parked action, and show a friendly success page. The inbound
// poll-reconcile (services flynnSMS path) is the backstop if the browser never
// lands here.
// ---------------------------------------------------------------------------

router.get('/connected', async (req, res) => {
  if (!supabase) return res.status(500).send(EXPIRED_LINK_PAGE);
  try {
    const claims = await nango.resolveConnectCode(String(req.query.c || ''));
    if (!claims?.phone) throw new Error('unknown or expired code');

    const { data: user } = await supabase
      .from('users')
      .select('id, phone, business_brain, preferred_channel')
      .eq('phone', claims.phone)
      .maybeSingle();
    if (!user?.id) throw new Error('user not found');

    const { connected, bubbles } = await reconcileNangoConnection({
      supabase, user, provider: claims.provider,
    });
    if (!connected) {
      // Nango doesn't show the connection yet (user bailed at consent, or it's
      // still settling). Don't fail loudly — the inbound poll will catch it.
      return res.send(SUCCESS_PAGE("Almost there. If you just approved access, head back to Messages and Flynn will pick it up."));
    }

    if (bubbles.length) {
      await sendToUser(user.phone, bubbles, { channel: user.preferred_channel || 'imessage', supabase });
    }
    return res.send(SUCCESS_PAGE("Flynn can use this now."));
  } catch (err) {
    console.warn('[NangoConnect] /connected rejected:', err?.message);
    return res.status(410).send(EXPIRED_LINK_PAGE);
  }
});

module.exports = router;
