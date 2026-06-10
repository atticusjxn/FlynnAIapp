/**
 * Nango OAuth backbone routes (mounted only when NANGO_SECRET_KEY is set).
 *
 *   GET  /connect/:provider?t=<jwt>   the link Flynn texts users. Verifies the
 *                                     7-day JWT, mints a fresh Nango connect
 *                                     session at click time (their session
 *                                     tokens only live ~30 min), 302s to the
 *                                     hosted Connect UI.
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
const { resumeParkedAction } = require('../services/agent/agentLoop');

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

// Nango provider config keys → the slugs used in business_brain bookkeeping.
const PROVIDER_TO_BRAIN_SLUG = {
  'google-calendar': 'google_calendar',
  'google-mail': 'gmail',
  'google-sheet': 'google_sheets',
};

const CONNECTED_BLURB = {
  'google-calendar': "calendar's in. i can check your week and book jobs straight into it now",
  'google-mail': "gmail's connected. i can find emails and send them for you now",
  'google-sheet': "sheets is connected. text me receipts and i'll log them for you",
};

// ---------------------------------------------------------------------------
// GET /connect/:provider?t=<jwt>
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
    return res
      .status(410)
      .send('<html><body style="font-family:-apple-system,sans-serif;padding:40px;text-align:center"><h2>This link has expired</h2><p>Text Flynn and ask to connect again, you\'ll get a fresh one.</p></body></html>');
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

    const now = new Date().toISOString();
    await supabase
      .from('user_connections')
      .upsert({
        user_id: user.id,
        user_phone: user.phone,
        provider,
        auth_kind: 'nango_oauth',
        status: 'connected',
        nango_connection_id: connectionId,
        account_label: payload.tags?.end_user_email || payload.endUser?.email || null,
        connected_at: now,
        updated_at: now,
      }, { onConflict: 'user_phone,provider' });

    // Brain bookkeeping: pending → connected, and clear any deferral.
    const slug = PROVIDER_TO_BRAIN_SLUG[provider] || provider;
    const brain = user.business_brain || {};
    const pending = (brain._pending_integrations || []).filter((s) => s !== slug);
    const deferred = (brain._deferred_integrations || []).filter((s) => s !== slug);
    const connected = brain._connected_integrations || [];
    if (!connected.includes(slug)) connected.push(slug);
    await supabase
      .from('users')
      .update({
        business_brain: {
          ...brain,
          _pending_integrations: pending,
          _connected_integrations: connected,
          _deferred_integrations: deferred,
        },
      })
      .eq('id', user.id);

    // Resume whatever was parked on this connection, otherwise just confirm.
    const resumed = await resumeParkedAction(user.phone, provider, supabase);
    const bubbles = resumed.handled && resumed.bubbles.length
      ? [CONNECTED_BLURB[provider] ? `${CONNECTED_BLURB[provider].split('.')[0]}.` : 'connected.', ...resumed.bubbles]
      : [CONNECTED_BLURB[provider] || `${provider} is connected`];

    await sendToUser(user.phone, bubbles, { channel: user.preferred_channel || 'imessage', supabase });
    console.log('[NangoWebhook] Connection stored + user notified', { provider, phone: user.phone, resumed: resumed.handled });
  } catch (err) {
    console.error('[NangoWebhook] Error handling auth webhook:', err?.message || err);
  }
});

module.exports = router;
