/**
 * Sendblue iMessage relay.
 *
 * Managed blue-bubble iMessage API — no Mac/iPhone to run. Drop-in alternative
 * to services/blueBubbles.js: exposes the same function surface so the inbound
 * route and flynnOutbound can talk to either provider through
 * services/imessageTransport.js (selected by FLYNN_IMESSAGE_PROVIDER).
 *
 * Docs: https://docs.sendblue.com  — API base https://api.sendblue.co/api
 *
 * Required env vars:
 *   SENDBLUE_API_KEY_ID    "sb-api-key-id" header
 *   SENDBLUE_API_SECRET    "sb-api-secret-key" header
 *   SENDBLUE_FROM_NUMBER   E.164 sender (free sandbox shares +13472812048;
 *                          a dedicated/AU line replaces it once on a paid plan)
 */

const SB_BASE = process.env.SENDBLUE_API_BASE || 'https://api.sendblue.co/api';
const SB_KEY = process.env.SENDBLUE_API_KEY_ID;
const SB_SECRET = process.env.SENDBLUE_API_SECRET;
const SB_FROM = process.env.SENDBLUE_FROM_NUMBER || '+13472812048';

function sbHeaders() {
  return {
    'sb-api-key-id': SB_KEY || '',
    'sb-api-secret-key': SB_SECRET || '',
    'Content-Type': 'application/json',
  };
}

function assertConfigured() {
  if (!SB_KEY || !SB_SECRET) {
    throw new Error('SENDBLUE_API_KEY_ID and SENDBLUE_API_SECRET are required');
  }
}

/**
 * Send an iMessage to a phone number.
 * @param {string} to   E.164 phone number, e.g. "+61412345678"
 * @param {string} text Message body
 */
async function sendMessage(to, text) {
  assertConfigured();
  const res = await fetch(`${SB_BASE}/send-message`, {
    method: 'POST',
    headers: sbHeaders(),
    body: JSON.stringify({ from_number: SB_FROM, number: to, content: text }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Sendblue sendMessage failed (${res.status}): ${body.slice(0, 300)}`);
  }
  const data = await res.json().catch(() => ({}));
  console.log('[Sendblue] Sent iMessage', { to, handle: data?.message_handle });
  return data;
}

/**
 * Groups aren't part of the Sendblue path (the silent group note-taker runs on
 * BlueBubbles only). No-op so a misrouted group send can't crash the loop.
 */
async function sendToGroup(chatGuid, text) {
  console.warn('[Sendblue] sendToGroup is unsupported on this provider — skipping');
}

/**
 * Send an attachment by public URL (used for the Flynn vCard + photo invoices).
 * Sendblue takes a media_url and delivers it over iMessage.
 * @param {string} to      E.164 phone number
 * @param {string} fileUrl Publicly accessible URL of the file
 * @param {string} name    Filename (unused by Sendblue; kept for interface parity)
 */
async function sendAttachment(to, fileUrl, name = 'file') {
  assertConfigured();
  const res = await fetch(`${SB_BASE}/send-message`, {
    method: 'POST',
    headers: sbHeaders(),
    body: JSON.stringify({ from_number: SB_FROM, number: to, content: '', media_url: fileUrl }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Sendblue sendAttachment failed (${res.status}): ${body.slice(0, 300)}`);
  }
  return res.json().catch(() => ({}));
}

/**
 * Download an inbound attachment's bytes. Unlike BlueBubbles (which keys by
 * GUID), Sendblue delivers a CDN media_url; the inbound translator stores that
 * URL as the attachment "guid", so here we just fetch it.
 * @param {string} mediaUrl CDN URL from the inbound webhook's media_url
 */
async function downloadAttachment(mediaUrl) {
  const res = await fetch(mediaUrl);
  if (!res.ok) {
    throw new Error(`Sendblue downloadAttachment failed (${res.status})`);
  }
  return Buffer.from(await res.arrayBuffer());
}

/**
 * Show the typing indicator. Sendblue has no explicit "stop" (it auto-expires),
 * so only the active=true case sends. Best-effort.
 * @param {string} to     E.164 phone number
 * @param {boolean} active true = show typing
 */
async function setTyping(to, active = true) {
  if (!active || !SB_KEY || !SB_SECRET) return;
  try {
    await fetch(`${SB_BASE}/send-typing-indicator`, {
      method: 'POST',
      headers: sbHeaders(),
      body: JSON.stringify({ from_number: SB_FROM, number: to }),
    });
  } catch {
    // Non-fatal — typing indicators are best-effort
  }
}

/**
 * Send a read receipt to the contact. Best-effort.
 * @param {string} to E.164 phone number
 */
async function markRead(to) {
  if (!SB_KEY || !SB_SECRET) return;
  try {
    await fetch(`${SB_BASE}/mark-read`, {
      method: 'POST',
      headers: sbHeaders(),
      body: JSON.stringify({ from_number: SB_FROM, number: to }),
    });
  } catch {
    // Non-fatal
  }
}

async function ping() {
  return Boolean(SB_KEY && SB_SECRET);
}

module.exports = { sendMessage, sendToGroup, sendAttachment, downloadAttachment, setTyping, markRead, ping };
