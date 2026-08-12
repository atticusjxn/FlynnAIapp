/**
 * POST /webhooks/sendblue/inbound
 *
 * Receives inbound iMessage events from Sendblue and reuses the exact same
 * brain/reply flow as the BlueBubbles route by translating Sendblue's payload
 * into the BlueBubbles `new-message` shape and handing it to
 * iMessageInbound.processInbound().
 *
 * Sendblue inbound payload (https://docs.sendblue.com/getting-started/webhooks):
 * {
 *   accountEmail, content, is_outbound:false, status:"RECEIVED",
 *   message_handle, date_sent, from_number, number, to_number,
 *   media_url, message_type:"message", group_id, participants, service
 * }
 *
 * Set FLYNN_IMESSAGE_PROVIDER=sendblue so outbound replies + typing/read/vCard
 * go back through services/sendblue.js (via services/imessageTransport.js).
 */

const express = require('express');
const { processInbound } = require('./iMessageInbound');

const router = express.Router();

// Optional shared secret. Sendblue includes a configured per-webhook/global
// secret in the request headers; the exact header name isn't documented, so we
// accept the secret appearing in ANY header value. Skipped if not configured.
const SB_WEBHOOK_SECRET = process.env.SENDBLUE_WEBHOOK_SECRET;

function verifySendblueSecret(req) {
  if (!SB_WEBHOOK_SECRET) return true; // not configured — skip
  return Object.values(req.headers || {}).some(
    (v) => typeof v === 'string' && v.includes(SB_WEBHOOK_SECRET)
  );
}

function guessImageMime(url = '') {
  const ext = String(url).split('?')[0].split('.').pop().toLowerCase();
  if (ext === 'png') return 'image/png';
  if (ext === 'gif') return 'image/gif';
  if (ext === 'heic') return 'image/heic';
  if (ext === 'webp') return 'image/webp';
  return 'image/jpeg';
}

/**
 * Translate a Sendblue inbound webhook into the BlueBubbles `new-message`
 * shape. Returns null for anything we shouldn't process (outbound status
 * callbacks, non-received, group messages, missing sender).
 */
function translateSendblue(p) {
  if (!p || typeof p !== 'object') return null;
  if (p.is_outbound === true) return null;                       // status callback for a sent msg
  if (p.status && p.status !== 'RECEIVED') return null;          // delivery/queued/error updates
  if (p.message_type && p.message_type !== 'message') return null; // meta events
  if (p.group_id) return null;                                   // groups not supported on this provider
  const from = p.from_number || p.number;
  if (!from) return null;

  const attachments = p.media_url
    ? [{ guid: p.media_url, mimeType: guessImageMime(p.media_url) }]
    : [];

  return {
    type: 'new-message',
    data: {
      guid: p.message_handle || `sb-${Date.now()}`,
      text: p.content || '',
      handle: { address: from },
      isFromMe: false,
      chats: [{ guid: `iMessage;-;${from}` }],
      attachments,
    },
  };
}

router.post('/inbound', async (req, res) => {
  // 200 immediately so Sendblue doesn't retry.
  res.sendStatus(200);

  if (!verifySendblueSecret(req)) {
    console.warn('[sendblueInbound] Invalid secret — ignoring');
    return;
  }

  const event = translateSendblue(req.body);
  if (!event) return;

  console.log('[sendblueInbound] Inbound', {
    from: event.data.handle.address,
    hasMedia: event.data.attachments.length > 0,
  });

  await processInbound(event).catch((err) =>
    console.error('[sendblueInbound] Unhandled error:', err?.message || err));
});

module.exports = router;
