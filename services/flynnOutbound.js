/**
 * Flynn outbound — one place that sends a reply to a user and logs it.
 *
 * Centralises the send+log that was duplicated across inbound routes, and adds
 * the thing the product needs on top of a bare Twilio call:
 *   1. Human texting — a reply can be several short bubbles (see splitBubbles),
 *      sent with a small gap so it reads like a real person texting, not a wall
 *      of product copy.
 *
 * SMS is the only client channel (see CLAUDE.md Non-Goals — the iMessage/
 * BlueBubbles relay was retired as platform risk). `resolveChannel` and the
 * `channel` field on `sendToUser`'s return value are kept for callers that
 * still branch on them, but they will only ever resolve to 'sms' now.
 */

const twilio = require('twilio');
const { splitBubbles } = require('./flynnTone');

const FLYNN_NUMBER = process.env.TWILIO_FLYNN_NUMBER || '+61480891471';
const BUBBLE_GAP_MS = Number(process.env.FLYNN_BUBBLE_GAP_MS || 700);

const twilioClient = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
  ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  : null;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Which channel should we use to reach this user? SMS only, always.
 * @param {{preferred_channel?: string}|null} user
 * @returns {'sms'}
 */
function resolveChannel(_user) {
  return 'sms';
}

async function logOutbound(supabase, phone, body, channel) {
  if (!supabase) return;
  await supabase
    .from('sms_messages')
    .insert({ user_phone: phone, direction: 'out', body, channel })
    .then(() => {})
    .catch(() => {});
}

async function sendOneSms(phone, text) {
  if (!twilioClient) throw new Error('Twilio not configured');
  await twilioClient.messages.create({ to: phone, from: FLYNN_NUMBER, body: text });
}

/**
 * Send a single media attachment (e.g. an invoice card image, a vCard) as an
 * MMS. `filename` is accepted for API parity with the old iMessage transport
 * but Twilio's MMS API has no filename field, so it's unused.
 * @param {string} phone E.164
 * @param {string} mediaUrl publicly reachable URL of the attachment
 * @param {string} [_filename]
 * @param {string} [caption] optional message body alongside the media
 */
async function sendAttachment(phone, mediaUrl, _filename, caption = '') {
  if (!twilioClient) throw new Error('Twilio not configured');
  await twilioClient.messages.create({ to: phone, from: FLYNN_NUMBER, body: caption, mediaUrl: [mediaUrl] });
}

/**
 * Send a reply to a user over SMS, as one or more bubbles, and log each bubble.
 *
 * @param {string} phone E.164
 * @param {string|string[]} content single reply or array of bubbles
 * @param {{channel?: string, supabase?: any}} opts channel is accepted for
 *        backwards compatibility with callers that still pass the inbound
 *        channel, but is ignored — SMS is the only outbound channel.
 * @returns {Promise<{channel: string, bubbles: number}>}
 */
async function sendToUser(phone, content, { supabase } = {}) {
  const bubbles = splitBubbles(content);
  if (bubbles.length === 0) return { channel: 'sms', bubbles: 0 };

  for (let i = 0; i < bubbles.length; i++) {
    const text = bubbles[i];
    if (i > 0) await sleep(BUBBLE_GAP_MS);

    await sendOneSms(phone, text);
    await logOutbound(supabase, phone, text, 'sms');
  }

  return { channel: 'sms', bubbles: bubbles.length };
}

module.exports = { sendToUser, resolveChannel, sendAttachment };
