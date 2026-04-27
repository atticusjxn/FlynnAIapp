/**
 * Supabase Auth "Send SMS Hook" handler.
 *
 * Supabase generates the OTP and POSTs the user + code to this endpoint.
 * We forward the SMS via Telnyx so Telnyx remains the only SMS carrier.
 *
 * Configure in Supabase Dashboard → Authentication → Hooks → Send SMS Hook:
 *   URL:    https://flynnai-telephony.fly.dev/api/auth/send-sms-hook
 *   Secret: paste the v1,whsec_... value into env SUPABASE_SMS_HOOK_SECRET
 *
 * Spec: https://supabase.com/docs/guides/auth/auth-hooks/send-sms-hook
 * Standard Webhooks: https://www.standardwebhooks.com/
 *
 * Payload shape:
 *   {
 *     "user": { "id": "uuid", "phone": "+61412345678", ... },
 *     "sms":  { "otp": "123456" }
 *   }
 *
 * Response: HTTP 200 + `{}` for success; non-2xx for failure (Supabase will
 * surface the error to the client).
 */

const crypto = require('crypto');
const telnyx = require('../telnyxClient');

/**
 * Verifies the Standard Webhooks signature on a Supabase Auth Hook request.
 * @param {string} secret   The full secret string (e.g. "v1,whsec_<base64>").
 * @param {object} headers  Express req.headers (lowercased keys).
 * @param {Buffer} rawBody  The raw request body buffer.
 * @returns {boolean}
 */
function verifySignature(secret, headers, rawBody) {
  if (!secret) {
    console.warn('[SupabaseAuthHook] No SUPABASE_SMS_HOOK_SECRET set — skipping signature verification');
    return true;
  }

  const id = headers['webhook-id'];
  const timestamp = headers['webhook-timestamp'];
  const signatureHeader = headers['webhook-signature'];
  if (!id || !timestamp || !signatureHeader) return false;

  // Reject anything older than 5 minutes (replay protection).
  const ageSeconds = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (ageSeconds > 5 * 60) return false;

  // Secret format from Supabase: "v1,whsec_<base64>". Strip prefix to get the
  // raw signing key bytes.
  const [, secretValue] = secret.split(',');
  if (!secretValue || !secretValue.startsWith('whsec_')) return false;
  const keyBytes = Buffer.from(secretValue.slice('whsec_'.length), 'base64');

  const signedPayload = `${id}.${timestamp}.${rawBody.toString('utf8')}`;
  const expectedSig = crypto
    .createHmac('sha256', keyBytes)
    .update(signedPayload)
    .digest('base64');

  // Header format: "v1,<base64sig> v1,<base64sig> ..." — pick any matching version.
  return signatureHeader
    .split(' ')
    .map((part) => part.split(',')[1])
    .some((sig) => sig && crypto.timingSafeEqual(
      Buffer.from(sig, 'base64'),
      Buffer.from(expectedSig, 'base64'),
    ));
}

/**
 * Express handler. Mounted with `express.raw({ type: 'application/json' })`
 * so we can verify the signature against the exact bytes Supabase signed.
 */
async function handleSendSmsHook(req, res) {
  const rawBody = req.body; // Buffer
  const valid = verifySignature(
    process.env.SUPABASE_SMS_HOOK_SECRET,
    req.headers,
    rawBody,
  );
  if (!valid) {
    return res.status(401).json({ error: 'invalid_signature' });
  }

  let payload;
  try {
    payload = JSON.parse(rawBody.toString('utf8'));
  } catch {
    return res.status(400).json({ error: 'invalid_json' });
  }

  const phone = payload?.user?.phone;
  const otp = payload?.sms?.otp;
  if (!phone || !otp) {
    return res.status(400).json({ error: 'missing_phone_or_otp' });
  }

  const text = `Your Flynn verification code is ${otp}. Don't share it with anyone.`;
  try {
    await telnyx.sendSMS({ to: phone, text });
    return res.status(200).json({});
  } catch (err) {
    console.error('[SupabaseAuthHook] Telnyx send failed:', err);
    return res.status(500).json({ error: 'sms_send_failed' });
  }
}

module.exports = { handleSendSmsHook, verifySignature };
