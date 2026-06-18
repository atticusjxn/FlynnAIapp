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
const { sendMessage: bbSend, sendAttachment, downloadAttachment, setTyping, markRead } = require('../services/blueBubbles');
const { sendToUser } = require('../services/flynnOutbound');
const { sanitiseReply } = require('../services/flynnTone');
const { ensureAuthUser } = require('../services/authLink');
const metaCapi = require('../services/metaCapi');
const generator = require('../services/dashboard/manifestGenerator');
const { createDashboardLoginLink } = require('../services/dashboardLink');

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

  // Group chats route to the silent note-taker (groupRouter), never the 1:1
  // brain. Detected from the chat GUID (a group is "iMessage;+;chat..."). Flynn
  // stays quiet in the group and DMs the boss privately.
  const { normalizeInbound } = require('../services/groupAgent/inboundEvent');
  const event = normalizeInbound(payload);
  if (event.isGroup) {
    const g = event.messageGuid;
    if (g && recentGuids.has(g)) return;
    if (g) { recentGuids.add(g); setTimeout(() => recentGuids.delete(g), 60_000); }
    try {
      const { processGroupMessage } = require('../services/groupAgent/groupRouter');
      await processGroupMessage(event, { supabase });
    } catch (err) {
      console.error('[iMessageInbound] group handler error:', err?.message || err);
    }
    return;
  }

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

  // Image attachments (receipts etc.) are processed even with no text.
  const attachments = Array.isArray(msg?.attachments) ? msg.attachments : [];
  const imageAttachments = attachments.filter(
    (a) => a?.guid && String(a?.mimeType || '').startsWith('image/')
  );

  if (!from || (!body && !imageAttachments.length)) return;

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
        .select('id, phone, business_brain, onboarding_step, preferred_channel, subscription_status, trial_end_date, stripe_customer_id')
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
            .then(() => {}, () => {});
        } else {
          // Fallback: phone-only row so messaging never breaks (no app handoff).
          await supabase
            .from('users')
            .insert({ phone: from, signup_source: 'imessage', onboarding_step: 'brain_pending' })
            .then(() => {}, () => {});
        }
        const { data: created } = await supabase
          .from('users')
          .select('id, phone, business_brain, onboarding_step, preferred_channel, subscription_status, trial_end_date, stripe_customer_id')
          .eq('phone', from)
          .maybeSingle();
        user = created;

        // Send vCard so they can save Flynn as a contact with the logo. This is
        // the one thing we push up front — "save me as a contact" reads as
        // natural and is part of the wow. The app-handoff link is deliberately
        // NOT sent here: a brand-new texter's first experience should be plain
        // conversation (read receipt, typing, a real reply), not a big link.
        // The app is a secondary surface; we offer it later once they're engaged.
        await sendAttachment(from, `${SERVER_URL}/api/signup/contact.vcf`, 'Flynn.vcf')
          .catch(err => console.warn('[iMessageInbound] vCard send failed:', err?.message));
      }
    }

    // Honour an explicit opt-out (carrier STOP convention). A standalone "stop"
    // turns off proactive re-engagement; we confirm once and don't run the brain.
    if (supabase && /^\s*(stop|stop all|unsubscribe|opt out)\s*$/i.test(body)) {
      await supabase.from('users').update({ reengagement_opted_out: true }).eq('phone', from).then(() => {}, () => {});
      await sendToUser(from, "all good, i won't message you unless you text me first.", { channel: 'imessage', supabase });
      console.log('[iMessageInbound] Opt-out recorded', { from });
      return;
    }

    // Remember we can reach this user on iMessage (where they just texted from).
    if (supabase && user?.preferred_channel !== 'imessage') {
      await supabase.from('users').update({ preferred_channel: 'imessage' }).eq('phone', from).then(() => {}, () => {});
    }

    // CAPI attribution bridge: if the pre-filled body carries the ref token we
    // minted at the "Message Flynn" tap, claim it for this phone so the later
    // Activated event attributes back to the ad click. Cheap, idempotent.
    if (supabase && body) {
      const refMatch = body.match(/\[([a-z0-9]{6})\]/i);
      if (refMatch) {
        await supabase
          .from('capi_click_bridge')
          .update({ user_phone: from })
          .eq('ref', refMatch[1].toLowerCase())
          .is('user_phone', null)
          .then(() => {}, () => {});
      }
    }

    // Load unexpired pending action + integrations + connections in parallel
    let pendingAction = null;
    let userIntegrations = {};
    let connections = new Map();
    let openActionItems = [];
    if (supabase) {
      const [pendingRes, integrationsRes, connectionsRes, openItemsRes] = await Promise.all([
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
        supabase
          .from('user_connections')
          .select('*')
          .eq('user_phone', from),
        // Open suggestions Flynn raised from this user's team group chat(s), so a
        // plain-language reply ("order the MDF") can action them in this turn.
        supabase
          .from('group_action_items')
          .select('id, summary, category, suggested_tool, suggested_args, urgency')
          .eq('owner_phone', from)
          .in('status', ['new', 'sent'])
          .order('created_at', { ascending: true })
          .limit(20),
      ]);

      pendingAction = pendingRes.data || null;
      openActionItems = openItemsRes.data || [];

      const { decryptCredentials } = require('../services/credentialCrypto');
      for (const row of (integrationsRes.data || [])) {
        userIntegrations[row.integration_type] = decryptCredentials(row.credentials_encrypted);
      }
      for (const row of (connectionsRes.data || [])) {
        connections.set(row.provider, row);
      }
    }

    // Log inbound message
    if (supabase) {
      await supabase.from('sms_messages').insert({
        user_phone: from,
        direction: 'in',
        body: body || '[photo]',
        channel: 'imessage',
      }).then(() => {}, () => {});
    }

    // Image attachments: download from BlueBubbles, run receipt extraction,
    // and hand the agent loop a structured note (never the raw image — parked
    // tool args after a connect gate must stay JSON).
    let imageNote = null;
    if (imageAttachments.length) {
      try {
        const sharp = require('sharp');
        const { extractReceipt } = require('../services/receiptExtractor');
        const { storeJobPhoto } = require('../services/photoInvoice');
        const MAX_IMAGES = Number(process.env.FLYNN_MAX_IMAGES_PER_MSG || 12);
        const receipts = [];
        const others = [];
        let jobPhotoCount = 0;

        // Each photo is treated as its own receipt. Big iPhone/HEIC photos are
        // downscaled + re-encoded to a small legible JPEG (no hard size cap —
        // the old 8MB skip dropped real receipts), then read by the vision model.
        for (const att of imageAttachments.slice(0, MAX_IMAGES)) {
          let buf;
          try { buf = await downloadAttachment(att.guid); } catch { continue; }
          let dataUrl;
          let jpegBuf = buf;
          try {
            const jpeg = await sharp(buf, { failOn: 'none' })
              .rotate()
              .resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true })
              .jpeg({ quality: 82 })
              .toBuffer();
            jpegBuf = jpeg;
            dataUrl = `data:image/jpeg;base64,${jpeg.toString('base64')}`;
          } catch {
            // Odd format sharp couldn't read — send raw unless absurdly large.
            if (buf.length > 18 * 1024 * 1024) continue;
            dataUrl = `data:${att.mimeType || 'image/jpeg'};base64,${buf.toString('base64')}`;
          }
          const ex = await extractReceipt([dataUrl]);
          if (ex?.is_receipt) {
            receipts.push(ex);
          } else if (ex) {
            const summary = ex.image_summary || 'a photo';
            others.push(summary);
            // Not a receipt → treat as a job photo: store it so a later
            // "invoice the henderson job" can embed it.
            try {
              const stored = await storeJobPhoto({ supabase, userPhone: from, jpegBuffer: jpegBuf, summary });
              if (stored) jobPhotoCount += 1;
            } catch (e) {
              console.warn('[iMessageInbound] job-photo store failed:', e?.message);
            }
          }
        }

        if (receipts.length) {
          const plural = receipts.length > 1;
          imageNote = `The user just sent ${receipts.length} receipt photo${plural ? 's' : ''}. Per-receipt extractions: ${JSON.stringify(receipts)}. Log EACH ONE to their expense destination: check their business details for expense_destination. If it's "xero", call xero_log_expense once per receipt; if it's the google sheet (or they say so), call sheets_log_expense once per receipt${plural ? ' (one tool call per receipt either way)' : ''}, using those values and don't re-ask amounts you already have. If you DON'T know where they keep expenses yet, ask once: xero, or a google sheet? Then call remember with expense_destination. (quickbooks and myob aren't hooked up yet, so if they ask for those, remember it and offer xero or the sheet meanwhile.)`;
        } else if (others.length) {
          const savedBit = jobPhotoCount
            ? ` ${jobPhotoCount} of them are saved and ready to attach to an invoice — if the user asks you to invoice this job, call create_photo_invoice and they'll be embedded automatically (don't ask them to re-send the photos).`
            : '';
          imageNote = `The user just sent ${others.length} job photo(s) (not receipts): ${others.join('; ')}.${savedBit}`;
        }
      } catch (err) {
        console.warn('[iMessageInbound] attachment processing failed:', err?.message);
      }
    }

    // Connect-completion without webhooks (free self-hosted Nango has none):
    // if we're parked waiting on a Nango OAuth connection, check whether it's
    // gone live and, if so, record it + resume the parked action right now.
    // Gated on the awaiting_connection row, so it only fires mid-connect and
    // resumeParkedAction deletes the row, so it never double-announces.
    const NANGO_OAUTH_PROVIDERS = ['google-calendar', 'google-mail', 'google-sheet', 'xero', 'outlook'];
    if (supabase && user?.id
      && pendingAction?.status === 'awaiting_connection'
      && NANGO_OAUTH_PROVIDERS.includes(pendingAction.required_provider)) {
      try {
        const { reconcileNangoConnection } = require('../services/agent/agentLoop');
        const r = await reconcileNangoConnection({ supabase, user, provider: pendingAction.required_provider });
        if (r.connected && r.bubbles.length) {
          await setTyping(from, false);
          await sendToUser(from, r.bubbles, { channel: 'imessage', supabase });
          console.log('[iMessageInbound] Resumed via poll-reconcile', { from, provider: pendingAction.required_provider });
          return;
        }
      } catch (err) {
        console.warn('[iMessageInbound] poll-reconcile failed:', err?.message);
      }
    }

    // Process with Flynn brain
    const result = await processMessage({
      phone: from,
      message: body || 'sent a photo',
      businessBrain: user?.business_brain || null,
      onboardingStep: user?.onboarding_step || 'brain_pending',
      pendingAction,
      userIntegrations,
      user,
      supabase,
      connections,
      imageNote,
      openActionItems,
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
        .then(() => {}, () => {});
    }

    // Activation event: the first successful "doing" action (e.g. first receipt
    // logged) — the strategy's activation metric. Gated on a brain flag so the
    // extra read stops the moment a user activates. May land one message late
    // (tool_call_events is written async), which is fine for attribution.
    if (supabase && user?.id) {
      try {
        const brainNow = result.updatedBrain || user.business_brain || {};
        if (!brainNow._capi_activated) {
          const registry = require('../services/agent/toolRegistry');
          const { count } = await supabase
            .from('tool_call_events')
            .select('id', { count: 'exact', head: true })
            .eq('user_phone', from)
            .eq('success', true)
            .in('tool_name', [...registry.METERED_TOOLS]);
          if ((count || 0) > 0) {
            // Pull the browser identity bridged from the ad click (if any) so
            // the off-site activation attributes back to the original click.
            const { data: bridge } = await supabase
              .from('capi_click_bridge')
              .select('fbp, fbc, fbclid, event_source_url')
              .eq('user_phone', from)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();
            metaCapi.trackActivated(from, bridge || {}).catch(() => {});
            await supabase.from('users')
              .update({ business_brain: { ...brainNow, _capi_activated: true } })
              .eq('id', user.id)
              .then(() => {}, () => {});
          }
        }
      } catch (err) {
        console.warn('[iMessageInbound] activation check failed:', err?.message);
      }
    }

    // Save newly collected integration credentials (mirrored into
    // user_connections so the tool registry sees them as connected), then
    // resume any action that was parked waiting on this provider.
    if (result.newCredential && supabase) {
      const { integration_type, email, password } = result.newCredential;
      if (integration_type && email) {
        const now = new Date().toISOString();
        await supabase
          .from('user_integrations')
          .upsert({
            user_phone: from,
            integration_type,
            credentials_encrypted: require('../services/credentialCrypto').encryptCredentials({ email, password: password || null }),
            connected_at: now,
            updated_at: now,
          }, { onConflict: 'user_phone,integration_type' })
          .then(() => {}, () => {});
        await supabase
          .from('user_connections')
          .upsert({
            user_id: user?.id || null,
            user_phone: from,
            provider: integration_type,
            auth_kind: 'credentials_browserbase',
            status: 'connected',
            connected_at: now,
            updated_at: now,
          }, { onConflict: 'user_phone,provider' })
          .then(() => {}, () => {});

        try {
          const { resumeParkedAction } = require('../services/agent/agentLoop');
          const resumed = await resumeParkedAction(from, integration_type, supabase);
          if (resumed.handled && resumed.bubbles.length) {
            await sendToUser(from, resumed.bubbles, { channel: 'imessage', supabase });
          }
        } catch (err) {
          console.warn('[iMessageInbound] resume after credential save failed:', err?.message);
        }
      }
    }

    // Handle pending action changes
    if (supabase) {
      if (result.clearPending && pendingAction?.id) {
        await supabase
          .from('pending_actions')
          .delete()
          .eq('id', pendingAction.id)
          .then(() => {}, () => {});
      }

      if (result.pendingAction) {
        const expiresAt = result.pendingAction.expires_at
          || new Date(Date.now() + 30 * 60 * 1000).toISOString();
        await supabase
          .from('pending_actions')
          .upsert({
            user_phone: from,
            action_type: result.pendingAction.action_type,
            action_data: result.pendingAction.action_data,
            confirmation_message: result.pendingAction.confirmation_message,
            expires_at: expiresAt,
            // Tool-loop fields: how the action resumes (yes/no vs connect-then-run)
            status: result.pendingAction.status || 'awaiting_confirmation',
            required_provider: result.pendingAction.required_provider || null,
            tool_name: result.pendingAction.tool_name || null,
            tool_args: result.pendingAction.tool_args || null,
          }, { onConflict: 'user_phone' })
          .then(() => {}, () => {});
      }
    }

    // Send reply (one or more bubbles) via the user's channel — iMessage here.
    const reply = result.bubbles ?? result.reply;
    if (reply) {
      await setTyping(from, false);
      await sendToUser(from, reply, { channel: 'imessage', supabase });
    }

    console.log('[iMessageInbound] Replied', { from, intent: result.intent });

    // Once a user has used Flynn enough, build their custom dashboard and text
    // the login link — once. Runs after the reply so it never delays it.
    if (supabase && user?.id) {
      const latestBrain = result.updatedBrain || user.business_brain || {};
      if (!latestBrain._dashboard_announced_at) {
        try {
          const ready = await generator.isReadyForDashboard({ phone: from, supabase });
          if (ready.ready) {
            await generator.generateManifest({ phone: from, supabase, force: false });
            const link = await createDashboardLoginLink({ userId: user.id, phone: from });
            if (link) {
              await sendToUser(from, [
                'built you a little dashboard for the business, your invoices, jobs and the bits you use most all in one spot',
                link,
              ], { channel: 'imessage', supabase });
              await supabase
                .from('users')
                .update({ business_brain: { ...latestBrain, _dashboard_announced_at: new Date().toISOString() } })
                .eq('id', user.id)
                .then(() => {}, () => {});
            }
          }
        } catch (err) {
          console.warn('[iMessageInbound] dashboard readiness check failed:', err?.message);
        }
      }
    }
  } catch (err) {
    console.error('[iMessageInbound] Error:', err?.message || err);

    await setTyping(from, false);
    await sendToUser(from, sanitiseReply("sorry, something went wrong on my end. give it another go in a moment."), { channel: 'imessage', supabase })
      .catch(() => {});
  }
});

module.exports = router;
