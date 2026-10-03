/**
 * Provision an AI receptionist for a paid (trialing) web signup.
 *
 * Triggered by the Stripe webhook (checkout.session.completed) AND by the
 * /api/signup/status poll, whichever lands first. Exactly-once is enforced by a
 * conditional status update on web_signups (pending -> provisioning): the loser
 * of that race just reads the row back.
 *
 * Reuses the same building blocks as the app's voice onboarding:
 *   ensureAuthUser (auth user + mirrored public.users + auto org via trigger),
 *   allocate_pool_number (pre-bought AU Twilio numbers), SMS webhook wiring,
 *   ensureBookingPage, and the unified /setup connect page for calendars.
 */

const SERVER_URL = () => process.env.SERVER_URL || process.env.SERVER_PUBLIC_URL || 'https://flynnai-telephony.fly.dev';
const FOUNDER_EMAIL = () => process.env.FLYNN_FOUNDER_EMAIL || 'atticusjxn@gmail.com';

/** +61480123456 -> 0480123456 (AU carriers' star codes expect the national form). */
function nationalAu(e164) {
  return String(e164 || '').replace(/^\+61/, '0');
}

function forwardingCodesFor(e164) {
  const n = nationalAu(e164);
  return {
    noAnswer: `**61*${n}#`,
    busy: `**67*${n}#`,
    unreachable: `**62*${n}#`,
    allConditional: `**004*${n}#`,
    cancel: '##004#',
  };
}

/** The code we tell them to dial, matched to how they want Flynn to cover calls. */
function primaryCodeFor(coverage, e164) {
  const codes = forwardingCodesFor(e164);
  // Unconditional divert sends every call to Flynn ("always on").
  if (coverage === 'always') return `**21*${nationalAu(e164)}#`;
  // Missed / after-hours: Flynn only gets calls they don't pick up, busy or off.
  return codes.allConditional;
}

function firstName(full) {
  return String(full || '').trim().split(/\s+/)[0] || 'the owner';
}

function greetingFor(answers) {
  const biz = answers.businessName || 'the business';
  return `Hi, you've reached ${biz}. ${firstName(answers.name)} can't get to the phone right now, I can take a message and make sure they get it. Who am I speaking with?`;
}

function businessProfileFor(answers) {
  return {
    source: 'web_signup',
    business_name: answers.businessName,
    business_type: answers.businessType,
    coverage: answers.coverage,
    hours: answers.hours || null,
    on_missed_call: answers.onMissedCall,
    wants_booking: answers.onMissedCall.includes('book_appointment'),
    owner_notes: answers.notes || null,
    // What the owner asked for, in their words: take the caller's details and
    // reason, then text them a summary. The receptionist prompt reads this blob.
    instructions: 'Take the caller\'s name, best contact number and the reason for the call. '
      + (answers.onMissedCall.includes('book_appointment')
        ? 'If they want to meet or have work done, offer to book a time. '
        : '')
      + 'Then let them know the owner will get the message by text straight away.',
  };
}

function createProvisioner(deps) {
  const {
    supabase,
    twilioClient,
    ensureAuthUser,
    ensureBookingPage,
    createSetupLink,
    notifyFounder = async () => {},
    log = console,
    sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
  } = deps;

  async function readSignup(id) {
    const { data } = await supabase.from('web_signups').select('*').eq('id', id).maybeSingle();
    return data || null;
  }

  async function fail(id, message) {
    await supabase.from('web_signups')
      .update({ status: 'failed', error: message, updated_at: new Date().toISOString() })
      .eq('id', id);
    log.error('[WebSignup] provisioning failed', { signupId: id, message });
    return readSignup(id);
  }

  async function waitForOrg(userId) {
    // default_org_id is set by the on_auth_user_created trigger chain; it is
    // normally there immediately, but give it a moment rather than racing it.
    for (let i = 0; i < 5; i += 1) {
      const { data } = await supabase.from('users').select('id, default_org_id').eq('id', userId).maybeSingle();
      if (data?.default_org_id) return data.default_org_id;
      await sleep(400);
    }
    return null;
  }

  /**
   * @param {string} signupId web_signups.id
   * @param {{ customerId?: string, subscriptionId?: string }} stripeRefs
   * @returns {Promise<object>} the web_signups row after this call
   */
  async function provision(signupId, stripeRefs = {}) {
    // Claim: only one caller moves pending -> provisioning.
    const { data: claimed } = await supabase
      .from('web_signups')
      .update({
        status: 'provisioning',
        provision_claimed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...(stripeRefs.customerId ? { stripe_customer_id: stripeRefs.customerId } : {}),
        ...(stripeRefs.subscriptionId ? { stripe_subscription_id: stripeRefs.subscriptionId } : {}),
      })
      .eq('id', signupId)
      .eq('status', 'pending')
      .select('*');
    const row = Array.isArray(claimed) ? claimed[0] : claimed;
    if (!row) return readSignup(signupId); // someone else has it, or it's done

    const answers = row.answers || {};
    try {
      const ensured = await ensureAuthUser(row.mobile);
      if (!ensured?.id) return fail(signupId, 'account_create_failed');
      const userId = ensured.id;
      const orgId = await waitForOrg(userId);
      if (!orgId) return fail(signupId, 'org_missing');

      const subStatus = 'trialing';
      const customerId = stripeRefs.customerId || row.stripe_customer_id || null;
      const subscriptionId = stripeRefs.subscriptionId || row.stripe_subscription_id || null;

      // Receptionist settings live on the users row (that's what the inbound call
      // path reads by twilio_phone_number). receptionist_voice 'male'|'female' is
      // what deepgramVoiceAgent maps to CARTESIA_VOICE_AU_MALE/FEMALE.
      const { error: userErr } = await supabase.from('users').update({
        email: row.email,
        business_name: answers.businessName,
        business_type: answers.businessType,
        receptionist_configured: true,
        call_handling_mode: 'ai_receptionist',
        receptionist_voice: answers.voice,
        receptionist_greeting: greetingFor(answers),
        receptionist_business_profile: businessProfileFor(answers),
        signup_source: 'web_checkout',
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
        subscription_status: subStatus,
        has_started_trial: true,
      }).eq('id', userId);
      if (userErr) return fail(signupId, `user_update_failed: ${userErr.message}`);

      // Entitlement: the receptionist routes check the org's plan + status
      // (the "legacy" Stripe path voiceOnboarding also accepts).
      await supabase.from('organizations').update({
        billing_plan_id: 'starter',
        plan: 'starter',
        subscription_status: subStatus,
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
      }).eq('id', orgId);

      // Best effort: these enrich the call but must never block the number.
      await supabase.from('receptionist_configs').update({ summary_delivery: 'sms' }).eq('org_id', orgId)
        .then(() => {}, () => {});
      await supabase.from('business_profiles').update({
        public_name: answers.businessName,
        ...(answers.hours ? { business_hours: answers.hours } : {}),
      }).eq('org_id', orgId).then(() => {}, () => {});

      // Number from the pre-bought AU pool (same RPC as the app's assign-number).
      const { data: phoneNumber, error: allocErr } = await supabase.rpc('allocate_pool_number', {
        p_user_id: userId,
        p_org_id: orgId,
      });
      if (allocErr) return fail(signupId, `allocation_failed: ${allocErr.message}`);
      if (!phoneNumber) {
        await notifyFounder({ subject: 'URGENT: Flynn number pool empty', row, answers, phoneNumber: null }).catch(() => {});
        return fail(signupId, 'pool_empty');
      }

      const { error: numErr } = await supabase.from('users').update({ twilio_phone_number: phoneNumber }).eq('id', userId);
      if (numErr) {
        await supabase.from('voice_number_pool')
          .update({ status: 'available', assigned_user_id: null, assigned_org_id: null, assigned_at: null })
          .eq('phone_number', phoneNumber);
        return fail(signupId, `assignment_failed: ${numErr.message}`);
      }

      // Inbound SMS webhook (allocate_pool_number only sets the voice URL).
      if (twilioClient) {
        try {
          const [incoming] = await twilioClient.incomingPhoneNumbers.list({ phoneNumber, limit: 1 });
          if (incoming) {
            await twilioClient.incomingPhoneNumbers(incoming.sid).update({
              smsUrl: `${SERVER_URL()}/webhooks/sms/inbound`,
              smsMethod: 'POST',
            });
          }
        } catch (err) {
          log.warn('[WebSignup] SMS webhook wiring failed', { phoneNumber, error: err.message });
        }
      }

      try { await ensureBookingPage({ userId, orgId }); } catch (err) {
        log.warn('[WebSignup] ensureBookingPage failed', { userId, error: err.message });
      }

      let calendarConnectUrl = null;
      try { calendarConnectUrl = createSetupLink({ userId, phone: row.mobile }); } catch (err) {
        log.warn('[WebSignup] setup link failed', { userId, error: err.message });
      }

      await supabase.from('web_signups').update({
        status: 'live',
        user_id: userId,
        org_id: orgId,
        phone_number: phoneNumber,
        calendar_connect_url: calendarConnectUrl,
        provisioned_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        error: null,
      }).eq('id', signupId);

      // Welcome text from their new Flynn number.
      if (twilioClient) {
        const code = primaryCodeFor(answers.coverage, phoneNumber);
        const lines = [
          `Flynn here, your receptionist is live on ${nationalAu(phoneNumber)}.`,
          `To send your missed calls to me, dial ${code} and press call. Undo any time with ##004#.`,
        ];
        if (calendarConnectUrl) lines.push(`Connect your calendar so Flynn can book you in: ${calendarConnectUrl}`);
        lines.push('7 days free, cancel any time.');
        const body = lines.join('\n');
        try {
          await twilioClient.messages.create({ to: row.mobile, from: phoneNumber, body });
        } catch (err) {
          // A fresh pool number can lag on SMS capability; the platform sender
          // still gets them their forwarding code.
          log.warn('[WebSignup] welcome SMS from new number failed, retrying from platform sender', { error: err.message });
          const fallbackFrom = process.env.TWILIO_FLYNN_NUMBER || process.env.TWILIO_FROM_NUMBER;
          if (fallbackFrom) {
            await twilioClient.messages.create({ to: row.mobile, from: fallbackFrom, body })
              .catch((e) => log.warn('[WebSignup] welcome SMS fallback failed', { error: e.message }));
          }
        }
      }

      await notifyFounder({ subject: `New Flynn web signup: ${answers.businessName || row.email}`, row, answers, phoneNumber })
        .catch((err) => log.warn('[WebSignup] founder notify failed', { error: err.message }));

      return readSignup(signupId);
    } catch (err) {
      return fail(signupId, `unexpected: ${err.message}`);
    }
  }

  return { provision };
}

module.exports = {
  createProvisioner,
  forwardingCodesFor,
  primaryCodeFor,
  nationalAu,
  greetingFor,
  businessProfileFor,
  FOUNDER_EMAIL,
};
