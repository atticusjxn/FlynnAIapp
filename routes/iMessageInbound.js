/**
 * POST /webhooks/imessage/inbound
 *
 * Receives incoming iMessage events from the BlueBubbles server webhook.
 * Mirrors the logic in smsInbound.js but handles the BlueBubbles payload
 * format and replies via BlueBubbles instead of Twilio.
 *
 * BlueBubbles webhook payload (new-message event):
 * {
 *   type: "new-message",
 *   data: {
 *     guid: "...",
 *     text: "...",
 *     handle: { address: "+61412345678" },
 *     isFromMe: false,
 *     chats: [{ guid: "iMessage;-;+61412345678" }]
 *   }
 * }
 */

const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { processMessage } = require('../services/flynnSMS');
const { sendMessage: bbSend, sendAttachment, setTyping, markRead } = require('../services/blueBubbles');
const { sendToUser } = require('../services/flynnOutbound');
const { sanitiseReply } = require('../services/flynnTone');
const { ensureAuthUser, generateAppLink } = require('../services/authLink');

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

const SERVER_URL = process.env.SERVER_URL || 'https://flynnai-telephony.fly.dev';

// In-memory dedup set — prevents double-processing if BB fires the webhook twice
const recentGuids = new Set();

// BlueBubbles signs webhooks with a shared secret if configured
const BB_WEBHOOK_SECRET = process.env.BLUEBUBBLES_WEBHOOK_SECRET;

function verifyBBSignature(req) {
  if (!BB_WEBHOOK_SECRET) return true; // not configured — skip in dev
  const sig = req.headers['x-bb-signature'] || req.headers['authorization'] || '';
  return sig === BB_WEBHOOK_SECRET;
}

// POST /webhooks/imessage/inbound
router.post('/inbound', async (req, res) => {
  // Always 200 immediately so BlueBubbles doesn't retry
  res.sendStatus(200);

  if (!verifyBBSignature(req)) {
    console.warn('[iMessageInbound] Invalid signature — ignoring');
    return;
  }

  const payload = req.body;

  // BlueBubbles sends various event types; only process new inbound messages
  if (payload?.type !== 'new-message') return;

  const msg = payload?.data;

  // Drop outgoing messages — isFromMe should catch it, but also check
  // that the sender address isn't Flynn's own number/iCloud account
  if (!msg) return;
  if (msg.isFromMe === true) return;

  // Normalise the sender address to E.164
  const rawAddress = msg?.handle?.address || '';
  if (!rawAddress) return;

  // Drop if the sender is Flynn's own Apple ID / iCloud address
  const FLYNN_APPLE_IDS = [
    (process.env.FLYNN_APPLE_ID || '').toLowerCase(),
    'atticusjxn@icloud.com',
  ].filter(Boolean);
  if (FLYNN_APPLE_IDS.includes(rawAddress.toLowerCase())) return;

  const from = rawAddress.startsWith('+') ? rawAddress : `+${rawAddress.replace(/\D/g, '')}`;
  const body = (msg?.text || '').trim();

  if (!from || !body) return;

  // Deduplicate: ignore if we've processed this message GUID in the last 60s
  const msgGuid = msg?.guid || '';
  if (msgGuid && recentGuids.has(msgGuid)) {
    console.log('[iMessageInbound] Duplicate GUID, skipping:', msgGuid);
    return;
  }
  if (msgGuid) {
    recentGuids.add(msgGuid);
    setTimeout(() => recentGuids.delete(msgGuid), 60_000);
  }

  console.log('[iMessageInbound] Received', { from, bodyLength: body.length });

  // Read receipt + typing indicator — fire immediately, non-blocking
  markRead(from);
  setTyping(from, true);

  try {
    // Look up or create user
    let user = null;
    if (supabase) {
      const { data } = await supabase
        .from('users')
        .select('id, phone, business_brain, onboarding_step, preferred_channel')
        .eq('phone', from)
        .maybeSingle();

      if (data) {
        user = data;
      } else {
        // New texter: create an auth-backed, id-aligned user (trigger mirrors
        // auth.users.id -> public.users.id) so they can later open the app with no OTP.
        const ensured = await ensureAuthUser(from).catch(() => null);
        if (ensured?.id) {
          await supabase
            .from('users')
            .update({ phone: from, signup_source: 'imessage', onboarding_step: 'brain_pending' })
            .eq('id', ensured.id)
            .catch(() => {});
        } else {
          // Fallback: phone-only row so messaging never breaks (no app handoff).
          await supabase
            .from('users')
            .insert({ phone: from, signup_source: 'imessage', onboarding_step: 'brain_pending' })
            .catch(() => {});
        }
        const { data: created } = await supabase
          .from('users')
          .select('id, phone, business_brain, onboarding_step, preferred_channel')
          .eq('phone', from)
          .maybeSingle();
        user = created;

        // Send vCard so they can save Flynn as a contact with the logo
        await sendAttachment(from, `${SERVER_URL}/api/signup/contact.vcf`, 'Flynn.vcf')
          .catch(err => console.warn('[iMessageInbound] vCard send failed:', err?.message));

        // Offer the app handoff link (single-use; opens the app already signed in).
        try {
          const link = await generateAppLink(from);
          if (link?.httpsUrl) {
            await bbSend(from, `want the app too? open Flynn already signed in: ${link.httpsUrl}`);
          }
        } catch (err) {
          console.warn('[iMessageInbound] app-link send failed:', err?.message);
        }
      }
    }

    // Honour an explicit opt-out (carrier STOP convention). A standalone "stop"
    // turns off proactive re-engagement; we confirm once and don't run the brain.
    if (supabase && /^\s*(stop|stop all|unsubscribe|opt out)\s*$/i.test(body)) {
      await supabase.from('users').update({ reengagement_opted_out: true }).eq('phone', from).catch(() => {});
      await sendToUser(from, "all good, i won't message you unless you text me first.", { channel: 'imessage', supabase });
      console.log('[iMessageInbound] Opt-out recorded', { from });
      return;
    }

    // Remember we can reach this user on iMessage (where they just texted from).
    if (supabase && user?.preferred_channel !== 'imessage') {
      await supabase.from('users').update({ preferred_channel: 'imessage' }).eq('phone', from).catch(() => {});
    }

    // Load unexpired pending action + integrations in parallel
    let pendingAction = null;
    let userIntegrations = {};
    if (supabase) {
      const [pendingRes, integrationsRes] = await Promise.all([
        supabase
          .from('pending_actions')
          .select('*')
          .eq('user_phone', from)
          .gt('expires_at', new Date().toISOString())
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('user_integrations')
          .select('integration_type, credentials_encrypted')
          .eq('user_phone', from),
      ]);

      pendingAction = pendingRes.data || null;

      for (const row of (integrationsRes.data || [])) {
        userIntegrations[row.integration_type] = row.credentials_encrypted || {};
      }
    }

    // Log inbound message
    if (supabase) {
      await supabase.from('sms_messages').insert({
        user_phone: from,
        direction: 'in',
        body,
        channel: 'imessage',
      }).catch(() => {});
    }

    // Process with Flynn brain
    const result = await processMessage({
      phone: from,
      message: body,
      businessBrain: user?.business_brain || null,
      onboardingStep: user?.onboarding_step || 'brain_pending',
      pendingAction,
      userIntegrations,
    });

    // Update business brain if onboarding produced one
    if (result.updatedBrain && supabase && user?.id) {
      await supabase
        .from('users')
        .update({
          business_brain: result.updatedBrain,
          onboarding_step: result.updatedStep || user.onboarding_step,
        })
        .eq('id', user.id)
        .catch(() => {});
    }

    // Save newly collected integration credentials
    if (result.newCredential && supabase) {
      const { integration_type, email, password } = result.newCredential;
      if (integration_type && email) {
        await supabase
          .from('user_integrations')
          .upsert({
            user_phone: from,
            integration_type,
            credentials_encrypted: { email, password: password || null },
            connected_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }, { onConflict: 'user_phone,integration_type' })
          .catch(() => {});
      }
    }

    // Handle pending action changes
    if (supabase) {
      if (result.clearPending && pendingAction?.id) {
        await supabase
          .from('pending_actions')
          .delete()
          .eq('id', pendingAction.id)
          .catch(() => {});
      }

      if (result.pendingAction) {
        const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
        await supabase
          .from('pending_actions')
          .upsert({
            user_phone: from,
            action_type: result.pendingAction.action_type,
            action_data: result.pendingAction.action_data,
            confirmation_message: result.pendingAction.confirmation_message,
            expires_at: expiresAt,
          }, { onConflict: 'user_phone' })
          .catch(() => {});
      }
    }

    // Send reply (one or more bubbles) via the user's channel — iMessage here.
    const reply = result.bubbles ?? result.reply;
    if (reply) {
      await setTyping(from, false);
      await sendToUser(from, reply, { channel: 'imessage', supabase });
    }

    console.log('[iMessageInbound] Replied', { from, intent: result.intent });
  } catch (err) {
    console.error('[iMessageInbound] Error:', err?.message || err);

    await setTyping(from, false);
    await sendToUser(from, sanitiseReply("sorry, something went wrong on my end. give it another go in a moment."), { channel: 'imessage', supabase })
      .catch(() => {});
  }
});

module.exports = router;
