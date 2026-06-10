/**
 * BlueBubbles iMessage relay.
 *
 * BlueBubbles is an open-source Mac server that relays iMessages via REST API.
 * It must be running on a Mac that is signed in to an iMessage-capable Apple ID.
 *
 * Docs: https://docs.bluebubbles.app/server/advanced/http-api
 *
 * Required env vars:
 *   BLUEBUBBLES_URL      e.g. https://imessage.flynnai.app  (or ngrok URL in dev)
 *   BLUEBUBBLES_PASSWORD server password set in BlueBubbles settings
 */

const BB_URL = process.env.BLUEBUBBLES_URL;
const BB_PASSWORD = process.env.BLUEBUBBLES_PASSWORD;

function bbHeaders() {
  return { 'Content-Type': 'application/json' };
}

function bbUrl(path) {
  const base = (BB_URL || '').replace(/\/$/, '');
  const sep = path.includes('?') ? '&' : '?';
  return `${base}${path}${sep}password=${encodeURIComponent(BB_PASSWORD || '')}`;
}

/**
 * Send an iMessage to a phone number.
 * @param {string} to   E.164 phone number, e.g. "+61412345678"
 * @param {string} text Message body
 */
async function sendMessage(to, text) {
  if (!BB_URL || !BB_PASSWORD) {
    throw new Error('BLUEBUBBLES_URL and BLUEBUBBLES_PASSWORD are required');
  }

  // BlueBubbles expects the "address" as the recipient (phone or email)
  const res = await fetch(bbUrl('/api/v1/message/text'), {
    method: 'POST',
    headers: bbHeaders(),
    body: JSON.stringify({
      chatGuid: `iMessage;-;${to}`,
      message: text,
      method: 'private-api', // requires Private API plugin for reliable delivery
      tempGuid: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`BlueBubbles sendMessage failed (${res.status}): ${body}`);
  }

  const data = await res.json();
  console.log('[BlueBubbles] Sent iMessage', { to, guid: data?.data?.guid });
  return data;
}

/**
 * Send an attachment (file URL) via iMessage.
 * @param {string} to      E.164 phone number
 * @param {string} fileUrl Publicly accessible URL of the file
 * @param {string} name    Filename to display
 */
async function sendAttachment(to, fileUrl, name = 'file') {
  if (!BB_URL || !BB_PASSWORD) {
    throw new Error('BLUEBUBBLES_URL and BLUEBUBBLES_PASSWORD are required');
  }

  // BlueBubbles v1 attachment: download locally on Mac then send
  const res = await fetch(bbUrl('/api/v1/message/attachment'), {
    method: 'POST',
    headers: bbHeaders(),
    body: JSON.stringify({
      chatGuid: `iMessage;-;${to}`,
      name,
      attachment: fileUrl, // remote URL — BlueBubbles server downloads it
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`BlueBubbles sendAttachment failed (${res.status}): ${body}`);
  }

  return res.json();
}

/**
 * Download an inbound attachment's bytes by its GUID (from the webhook's
 * data.attachments array). Returns a Buffer.
 * Endpoint: GET /api/v1/attachment/:guid/download
 */
async function downloadAttachment(guid) {
  if (!BB_URL || !BB_PASSWORD) {
    throw new Error('BLUEBUBBLES_URL and BLUEBUBBLES_PASSWORD are required');
  }
  const res = await fetch(bbUrl(`/api/v1/attachment/${encodeURIComponent(guid)}/download`));
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`BlueBubbles downloadAttachment failed (${res.status}): ${body.slice(0, 200)}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

/**
 * Check if BlueBubbles server is reachable.
 */
async function ping() {
  if (!BB_URL) return false;
  try {
    const res = await fetch(bbUrl('/api/v1/server/info'), { method: 'GET' });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Show or hide the typing indicator (the "..." bubble) in the chat.
 * @param {string} to      E.164 phone number
 * @param {boolean} active true = show typing, false = stop typing
 */
async function setTyping(to, active = true) {
  if (!BB_URL || !BB_PASSWORD) return;
  try {
    await fetch(bbUrl('/api/v1/chat/typing'), {
      method: 'POST',
      headers: bbHeaders(),
      body: JSON.stringify({
        chatGuid: `iMessage;-;${to}`,
        typing: active,
      }),
    });
  } catch {
    // Non-fatal — typing indicators are best-effort
  }
}

/**
 * Mark all messages in a chat as read (sends read receipt to sender).
 * @param {string} to E.164 phone number
 */
async function markRead(to) {
  if (!BB_URL || !BB_PASSWORD) return;
  try {
    await fetch(bbUrl('/api/v1/chat/read'), {
      method: 'POST',
      headers: bbHeaders(),
      body: JSON.stringify({ chatGuid: `iMessage;-;${to}` }),
    });
  } catch {
    // Non-fatal
  }
}

module.exports = { sendMessage, sendAttachment, downloadAttachment, setTyping, markRead, ping };
