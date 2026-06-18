/**
 * Flynn outbound — one place that sends a reply to a user and logs it.
 *
 * Centralises the send+log that was duplicated across the iMessage and SMS
 * inbound routes, and adds two things the product needs:
 *   1. Channel awareness — each user has a preferred_channel ('imessage' | 'sms').
 *      iMessage is primary for now (BlueBubbles); Twilio SMS is the fallback when
 *      iMessage isn't deliverable. Designed so Apple Business Messenger can slot
 *      in later as another channel without touching callers.
 *   2. Human texting — a reply can be several short bubbles (see splitBubbles),
 *      sent with a typing indicator and a small gap so it reads like a real person
 *      texting, not a wall of product copy.
 */

const twilio = require('twilio');
const blueBubbles = require('./blueBubbles');
const { splitBubbles } = require('./flynnTone');

const FLYNN_NUMBER = process.env.TWILIO_FLYNN_NUMBER || '+61480891471';
const DEFAULT_CHANNEL = process.env.FLYNN_DEFAULT_CHANNEL || 'imessage';
const BUBBLE_GAP_MS = Number(process.env.FLYNN_BUBBLE_GAP_MS || 700);

const twilioClient = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
  ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  : null;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Which channel should we use to reach this user?
 * @param {{preferred_channel?: string}|null} user
 * @returns {'imessage'|'sms'}
 */
function resolveChannel(user) {
  const pref = user?.preferred_channel;
  return pref === 'imessage' || pref === 'sms' ? pref : DEFAULT_CHANNEL;
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

// iMessage sends can blip (BlueBubbles server/network); retry before we give up
// and fall back to green SMS, so transient hiccups don't turn replies green.
async function sendImessageWithRetry(phone, text, tries = 2) {
  let lastErr;
  for (let t = 0; t < tries; t++) {
    try { await blueBubbles.sendMessage(phone, text); return; }
    catch (err) { lastErr = err; if (t < tries - 1) await sleep(800); }
  }
  throw lastErr;
}

/**
 * Send a reply to a user across the resolved channel, as one or more bubbles,
 * and log each bubble. iMessage failures fall back to SMS once (and the user's
 * preferred_channel is flipped to 'sms' so we stop trying iMessage).
 *
 * @param {string} phone E.164
 * @param {string|string[]} content single reply or array of bubbles
 * @param {{channel?: string, supabase?: any}} opts channel = the inbound channel
 *        (lets callers honour where the user just texted from); falls back to the
 *        user's stored preference / the default.
 * @returns {Promise<{channel: string, bubbles: number}>}
 */
async function sendToUser(phone, content, { channel, supabase } = {}) {
  const bubbles = splitBubbles(content);
  if (bubbles.length === 0) return { channel: channel || DEFAULT_CHANNEL, bubbles: 0 };

  let activeChannel = channel === 'imessage' || channel === 'sms' ? channel : DEFAULT_CHANNEL;

  for (let i = 0; i < bubbles.length; i++) {
    const text = bubbles[i];
    if (i > 0) await sleep(BUBBLE_GAP_MS);

    if (activeChannel === 'imessage') {
      try {
        await blueBubbles.setTyping(phone, true);
        await sendImessageWithRetry(phone, text);
        await blueBubbles.setTyping(phone, false);
      } catch (err) {
        // iMessage send failed even after retries — fall back to SMS for the
        // rest of THIS reply only. Deliberately NOT persisting preferred_channel
        // = 'sms': a transient BlueBubbles blip shouldn't strand a real iMessage
        // user on green forever. The inbound route re-affirms imessage on their
        // next text, and we retry iMessage first on the next reply.
        console.warn('[FlynnOutbound] iMessage send failed after retries, SMS fallback:', err?.message || err);
        await blueBubbles.setTyping(phone, false).catch(() => {});
        activeChannel = 'sms';
        await sendOneSms(phone, text);
      }
    } else {
      await sendOneSms(phone, text);
    }

    await logOutbound(supabase, phone, text, activeChannel);
  }

  return { channel: activeChannel, bubbles: bubbles.length };
}

module.exports = { sendToUser, resolveChannel };
