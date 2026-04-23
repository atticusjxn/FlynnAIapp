/**
 * Telnyx REST + webhook helpers.
 *
 * Telnyx Call Control is webhook-driven: incoming calls hit our webhook, and we
 * respond by POSTing actions (answer, speak, gather_using_speak, hangup) back
 * to the Telnyx API referencing the call's call_control_id.
 *
 * Env vars:
 *   TELNYX_API_KEY                  — Bearer token for api.telnyx.com
 *   TELNYX_MESSAGING_PROFILE_ID     — Messaging Profile UUID for SMS
 *   TELNYX_PHONE_NUMBER             — E.164 sender number
 *   TELNYX_CONNECTION_ID            — Call Control Application ID (voice)
 *   TELNYX_WEBHOOK_SIGNING_SECRET   — ed25519 public key for webhook signature verification
 */

const crypto = require('crypto');

const TELNYX_API = 'https://api.telnyx.com/v2';

function authHeaders() {
  const key = process.env.TELNYX_API_KEY;
  if (!key) throw new Error('TELNYX_API_KEY is not set');
  return {
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  };
}

async function telnyxRequest(method, path, body) {
  const res = await fetch(`${TELNYX_API}${path}`, {
    method,
    headers: authHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const json = text ? safeJson(text) : null;
  if (!res.ok) {
    const err = new Error(
      `[Telnyx] ${method} ${path} → ${res.status}: ${
        json?.errors?.[0]?.detail || text
      }`
    );
    err.status = res.status;
    err.body = json;
    throw err;
  }
  return json;
}

function safeJson(text) {
  try { return JSON.parse(text); } catch { return null; }
}

// ---------------------------------------------------------------------------
// Call Control actions — callControlId is the `call_control_id` from Telnyx
// webhooks. See https://developers.telnyx.com/api/call-control
// ---------------------------------------------------------------------------

function answer(callControlId, extra = {}) {
  return telnyxRequest('POST', `/calls/${callControlId}/actions/answer`, extra);
}

function speak(callControlId, payload) {
  // payload: { payload: "...", voice: "Polly.Nicole-Neural", language: "en-AU" }
  // or via `audio_url` for pre-recorded greetings.
  return telnyxRequest('POST', `/calls/${callControlId}/actions/speak`, payload);
}

function gatherUsingSpeak(callControlId, payload) {
  // payload: { payload, voice, language, maximum_digits, minimum_digits, timeout_millis, terminating_digit, valid_digits, invalid_payload, client_state? }
  return telnyxRequest(
    'POST',
    `/calls/${callControlId}/actions/gather_using_speak`,
    payload
  );
}

function playAudio(callControlId, payload) {
  // payload: { audio_url }
  return telnyxRequest('POST', `/calls/${callControlId}/actions/playback_start`, payload);
}

function startRecording(callControlId, opts = {}) {
  // opts: { format: 'mp3' | 'wav', channels: 'single' | 'dual' }
  return telnyxRequest('POST', `/calls/${callControlId}/actions/record_start`, {
    format: opts.format || 'mp3',
    channels: opts.channels || 'single',
  });
}

function hangup(callControlId) {
  return telnyxRequest('POST', `/calls/${callControlId}/actions/hangup`, {});
}

function transfer(callControlId, to) {
  return telnyxRequest('POST', `/calls/${callControlId}/actions/transfer`, { to });
}

// ---------------------------------------------------------------------------
// Messaging
// ---------------------------------------------------------------------------

async function sendSMS({ to, from, text, messagingProfileId }) {
  const body = {
    to,
    from: from || process.env.TELNYX_PHONE_NUMBER,
    text,
    messaging_profile_id:
      messagingProfileId || process.env.TELNYX_MESSAGING_PROFILE_ID,
  };
  return telnyxRequest('POST', '/messages', body);
}

// ---------------------------------------------------------------------------
// Webhook signature verification
//
// Telnyx signs webhook payloads with ed25519. Header keys:
//   telnyx-signature-ed25519
//   telnyx-timestamp
// Signed data is `${timestamp}|${rawBody}`.
// ---------------------------------------------------------------------------

function verifyWebhookSignature({ rawBody, timestamp, signature, publicKey }) {
  const key = publicKey || process.env.TELNYX_WEBHOOK_SIGNING_SECRET;
  if (!key) {
    console.warn('[Telnyx] No webhook signing key configured; skipping verification');
    return true;
  }
  try {
    const data = Buffer.from(`${timestamp}|${rawBody}`, 'utf8');
    const sig = Buffer.from(signature, 'base64');
    const pubKey = crypto.createPublicKey({
      key: Buffer.from(key, 'base64'),
      format: 'der',
      type: 'spki',
    });
    return crypto.verify(null, data, pubKey, sig);
  } catch (err) {
    console.error('[Telnyx] Webhook signature verification failed:', err.message);
    return false;
  }
}

module.exports = {
  telnyxRequest,
  answer,
  speak,
  gatherUsingSpeak,
  playAudio,
  startRecording,
  hangup,
  transfer,
  sendSMS,
  verifyWebhookSignature,
};
