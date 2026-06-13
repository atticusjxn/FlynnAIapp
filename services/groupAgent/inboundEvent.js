/**
 * Transport-agnostic inbound event normaliser.
 *
 * Today the only transport is BlueBubbles (iMessage relay). Apple Business
 * Messages is the eventual migration target — when it lands it produces the SAME
 * shape from this module, so the group pipeline (groupRouter, noteTaker) never
 * has to know which transport delivered a message.
 *
 * Shape:
 *   {
 *     transport,         'bluebubbles' (future: 'abm')
 *     chatGuid,          group or 1:1 chat id
 *     isGroup,           true when the chat has multiple participants
 *     senderPhone,       E.164 ('' if unresolved)
 *     senderName,        display name if the webhook carried one
 *     text,              trimmed body
 *     attachments,       [{ guid, mimeType }]
 *     messageGuid,       per-message id (dedupe)
 *     groupName,         group display name if present
 *     participants,      [{ phone, name }] (often sparse/empty from BlueBubbles)
 *     isFromMe,          outgoing echo — caller drops these
 *   }
 */

function toE164(raw = '') {
  if (!raw) return '';
  const s = String(raw).trim();
  if (s.includes('@')) return s.toLowerCase(); // iCloud email handle — keep as-is
  return s.startsWith('+') ? s : `+${s.replace(/\D/g, '')}`;
}

/**
 * A BlueBubbles 1:1 chat GUID is "iMessage;-;<address>"; a group chat GUID is
 * "iMessage;+;chat<hash>". The ";+;" marker is the reliable signal; participant
 * count is a fallback when the GUID is unusual.
 */
function detectGroup(chatGuid, participants) {
  if (typeof chatGuid === 'string' && chatGuid.includes(';+;')) return true;
  if (Array.isArray(participants) && participants.length > 1) return true;
  return false;
}

function normalizeInbound(payload) {
  const msg = payload?.data || {};
  const chat = Array.isArray(msg.chats) ? msg.chats[0] : null;
  const chatGuid = chat?.guid || '';

  const rawParticipants = Array.isArray(chat?.participants) ? chat.participants : [];
  const participants = rawParticipants
    .map((p) => ({ phone: toE164(p?.address || p), name: p?.displayName || null }))
    .filter((p) => p.phone);

  const attachments = (Array.isArray(msg.attachments) ? msg.attachments : [])
    .filter((a) => a?.guid)
    .map((a) => ({ guid: a.guid, mimeType: a.mimeType || '' }));

  return {
    transport: 'bluebubbles',
    chatGuid,
    isGroup: detectGroup(chatGuid, participants),
    senderPhone: toE164(msg?.handle?.address || ''),
    senderName: msg?.handle?.displayName || null,
    text: (msg?.text || '').trim(),
    attachments,
    messageGuid: msg?.guid || '',
    groupName: chat?.displayName || null,
    participants,
    isFromMe: msg?.isFromMe === true,
  };
}

module.exports = { normalizeInbound, toE164, detectGroup };
