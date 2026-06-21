const express = require('express');
const twilio = require('twilio');
const { createClient } = require('@supabase/supabase-js');
const { processMessage } = require('../services/flynnSMS');
const { sendToUser } = require('../services/flynnOutbound');
const { sanitiseReply } = require('../services/flynnTone');
const { ensureAuthUser, generateAppLink } = require('../services/authLink');
const { provisionDemoAccount, isDemoCode } = require('../services/demoAccount');

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

const twilioClient = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
  ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  : null;

const FLYNN_NUMBER = process.env.TWILIO_FLYNN_NUMBER || '+61480891471';
const SERVER_URL = process.env.SERVER_URL || 'https://flynnai-telephony.fly.dev';
const shouldValidate = process.env.TWILIO_VALIDATE_SIGNATURE !== 'false';

// POST /webhooks/sms/inbound
router.post('/inbound', async (req, res) => {
  // Validate Twilio signature in production
  if (shouldValidate) {
    const sig = req.headers['x-twilio-signature'];
    const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    const valid = twilio.validateRequest(
      process.env.TWILIO_AUTH_TOKEN,
      sig,
      url,
      req.body
    );
    if (!valid) {
      console.warn('[SMSInbound] Invalid Twilio signature');
      return res.status(403).send('Forbidden');
    }
  }

  // Twilio sends urlencoded body
  const from = (req.body?.From || '').trim();
  const body = (req.body?.Body || '').trim();

  if (!from || !body) {
    return res.sendStatus(200);
  }

  console.log('[SMSInbound] Received', { from, bodyLength: body.length });

  // Reviewer demo code (LATITUDE) over SMS — provision the seeded James persona
  // for Android reviewers, then return. Re-texting resets.
  if (supabase && isDemoCode(body)) {
    try { await provisionDemoAccount(from, { supabase, channel: 'sms' }); }
    catch (e) { console.error('[demo] sms provision failed:', e?.message || e); }
    return res.sendStatus(200);
  }

  try {
    // Look up or create user
    let user = null;
    if (supabase) {
      const { data } = await supabase
        .from('users')
        .select('id, phone, business_brain, onboarding_step, preferred_channel, is_demo')
        .eq('phone', from)
        .maybeSingle();

      if (data) {
        user = data;
      } else {
        // First contact direct from SMS — create an auth-backed, id-aligned user
        // (trigger mirrors auth.users.id -> public.users.id) for no-OTP app handoff.
        const ensured = await ensureAuthUser(from).catch(() => null);
        if (ensured?.id) {
          await supabase
            .from('users')
            .update({ phone: from, signup_source: 'sms', onboarding_step: 'brain_pending' })
            .eq('id', ensured.id)
            .catch(() => {});
        } else {
          await supabase
            .from('users')
            .insert({ phone: from, signup_source: 'sms', onboarding_step: 'brain_pending' })
            .catch(() => {});
        }
        const { data: created } = await supabase
          .from('users')
          .select('id, phone, business_brain, onboarding_step, preferred_channel, is_demo')
          .eq('phone', from)
          .maybeSingle();
        user = created;

        // Send vCard MMS so they can add Flynn as a contact with logo in one tap
        if (twilioClient) {
          await twilioClient.messages.create({
            to: from,
            from: FLYNN_NUMBER,
            mediaUrl: [`${SERVER_URL}/api/signup/contact.vcf`],
            body: '',
          }).catch(err => console.warn('[SMSInbound] vCard MMS failed:', err?.message));

          // Offer the app handoff link (single-use; opens the app already signed in).
          try {
            const link = await generateAppLink(from);
            if (link?.httpsUrl) {
              await twilioClient.messages.create({
                to: from,
                from: FLYNN_NUMBER,
                body: `want the app too? open Flynn already signed in: ${link.httpsUrl}`,
              });
            }
          } catch (err) {
            console.warn('[SMSInbound] app-link send failed:', err?.message);
          }
        }
      }
    }

    // Honour an explicit opt-out (carrier STOP convention). A standalone "stop"
    // turns off proactive re-engagement; we confirm once and don't run the brain.
    if (supabase && /^\s*(stop|stop all|unsubscribe|opt out)\s*$/i.test(body)) {
      await supabase.from('users').update({ reengagement_opted_out: true }).eq('phone', from).catch(() => {});
      await sendToUser(from, "all good, i won't message you unless you text me first.", { channel: 'sms', supabase });
      console.log('[SMSInbound] Opt-out recorded', { from });
      return res.sendStatus(200);
    }

    // Remember we can reach this user on SMS (where they just texted from).
    if (supabase && user?.preferred_channel !== 'sms') {
      await supabase.from('users').update({ preferred_channel: 'sms' }).eq('phone', from).catch(() => {});
    }

    // Load unexpired pending action + integrations in parallel
    let pendingAction = null;
    let userIntegrations = {};
    let connections = new Map();
    if (supabase) {
      const [pendingRes, integrationsRes, connectionsRes] = await Promise.all([
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
      ]);

      pendingAction = pendingRes.data || null;

      // Map integrations into { xero: {email, password}, reece: {...}, ... }
      const { decryptCredentials } = require('../services/credentialCrypto');
      for (const row of (integrationsRes.data || [])) {
        userIntegrations[row.integration_type] = decryptCredentials(row.credentials_encrypted);
      }
      for (const row of (connectionsRes.data || [])) connections.set(row.provider, row);
    }

    // Log inbound message
    if (supabase) {
      await supabase.from('sms_messages').insert({
        user_phone: from,
        direction: 'in',
        body,
      }).then(() => {}).catch(() => {});
    }

    // Process with Flynn brain
    const result = await processMessage({
      phone: from,
      message: body,
      businessBrain: user?.business_brain || null,
      onboardingStep: user?.onboarding_step || 'brain_pending',
      pendingAction,
      userIntegrations,
      user,
      supabase,
      connections,
    });

    // Update business brain if brain setup produced one
    if (result.updatedBrain && supabase && user?.id) {
      await supabase
        .from('users')
        .update({
          business_brain: result.updatedBrain,
          onboarding_step: result.updatedStep || user.onboarding_step,
        })
        .eq('id', user.id)
        .then(() => {}).catch(() => {});
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
            credentials_encrypted: require('../services/credentialCrypto').encryptCredentials({ email, password: password || null }),
            connected_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }, { onConflict: 'user_phone,integration_type' })
          .then(() => {}).catch(() => {});
      }
    }

    // Handle pending action changes
    if (supabase) {
      if (result.clearPending && pendingAction?.id) {
        await supabase
          .from('pending_actions')
          .delete()
          .eq('id', pendingAction.id)
          .then(() => {}).catch(() => {});
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
          .then(() => {}).catch(() => {});
      }
    }

    // Send reply (one or more bubbles) — SMS here.
    const reply = result.bubbles ?? result.reply;
    if (reply) {
      await sendToUser(from, reply, { channel: 'sms', supabase });
    }

    console.log('[SMSInbound] Replied', { from, intent: result.intent });
  } catch (err) {
    console.error('[SMSInbound] Error processing message:', err?.message || err);

    // Send a safe fallback so the user isn't left hanging
    await sendToUser(from, sanitiseReply("sorry, something went wrong on my end. give it another go in a moment."), { channel: 'sms', supabase })
      .catch(() => {});
  }

  // Twilio expects a 200 whether we send TwiML or not
  res.sendStatus(200);
});

module.exports = router;
