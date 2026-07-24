/**
 * Voice front-door funnel: claim API.
 *
 * After the intake call, the prospect gets an SMS with a magic link + claim
 * code. They install the app, land signed-in (or OTP in), and the first-run
 * flow calls these endpoints to pull the config captured on the call and apply
 * it to their newly-created org. Recovery path: if they signed up on a
 * different number than they called from, the claim code resolves the session.
 */

const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const authenticateJwt = require('../middleware/authenticateJwt');
const { calloutFeeToCents } = require('../telephony/funnelIntake');

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

const isClaimable = (session) =>
  session
  && !['claimed', 'receptionist_live', 'expired'].includes(session.state)
  && new Date(session.expires_at) >= new Date();

const loadUser = async (userId) => {
  const { data, error } = await supabase
    .from('users')
    .select('id, phone, default_org_id, business_brain')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
};

const findSessionByPhone = async (phone) => {
  if (!phone) return null;
  const { data } = await supabase
    .from('voice_onboarding_sessions')
    .select('*')
    .eq('caller_phone', phone)
    .maybeSingle();
  return data || null;
};

const findSessionByCode = async (code) => {
  if (!code) return null;
  const { data } = await supabase
    .from('voice_onboarding_sessions')
    .select('*')
    .eq('claim_code', String(code).trim().toUpperCase())
    .maybeSingle();
  return data || null;
};

// First-run check: does this user have a staged receptionist config waiting?
router.get('/session', authenticateJwt, async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'storage unavailable' });
  try {
    const user = await loadUser(req.user.id);
    if (!user) return res.status(404).json({ error: 'user not found' });

    const session = await findSessionByPhone(user.phone);
    if (!isClaimable(session)) {
      return res.json({ found: false });
    }
    return res.json({
      found: true,
      state: session.state,
      business_config: session.business_config,
      call_count: session.call_count,
    });
  } catch (error) {
    console.error('[VoiceOnboarding] Session lookup failed.', { userId: req.user?.id, error: error.message });
    return res.status(500).json({ error: 'lookup failed' });
  }
});

// Apply the staged config to the user's org. Body: { code? } — code is the
// recovery path when the signup phone differs from the caller phone.
router.post('/claim', authenticateJwt, async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'storage unavailable' });
  try {
    const user = await loadUser(req.user.id);
    if (!user) return res.status(404).json({ error: 'user not found' });
    if (!user.default_org_id) return res.status(409).json({ error: 'no organization for user yet' });

    let session = await findSessionByPhone(user.phone);
    if (!isClaimable(session)) {
      session = req.body?.code ? await findSessionByCode(req.body.code) : null;
    }
    if (!isClaimable(session)) {
      return res.status(404).json({ error: 'no claimable session', code_required: Boolean(!req.body?.code) });
    }

    const config = session.business_config || {};
    const businessName = config.business_name
      || (config.owner_name && config.trade ? `${config.owner_name.split(' ')[0]}'s ${config.trade} services` : null);
    const serviceAreas = Array.isArray(config.service_areas) ? config.service_areas : [];
    const feeCents = calloutFeeToCents(config.callout_fee);

    const aiInstructionParts = [];
    if (config.hours) aiInstructionParts.push(`Working hours: ${config.hours}.`);
    if (config.after_hours_policy && config.after_hours_policy !== 'unsure') {
      const policyText = {
        take_message: 'For after-hours calls, take a message for the owner.',
        book_next_day: 'For after-hours calls, offer to book them in for the next working day.',
        flag_emergencies: 'For after-hours calls, take a message unless it is an emergency, in which case flag it to the owner immediately.',
      }[config.after_hours_policy];
      if (policyText) aiInstructionParts.push(policyText);
    }
    if (config.notes) aiInstructionParts.push(config.notes);

    const profileRow = {
      org_id: user.default_org_id,
      user_id: user.id,
      ...(businessName ? { business_name: businessName } : {}),
      ...(config.trade ? { business_type: config.trade } : {}),
      ...(serviceAreas.length > 0
        ? { service_areas: serviceAreas, service_area: serviceAreas.join(', ') }
        : {}),
      ...(config.callout_fee ? { pricing_notes: `Callout fee: ${config.callout_fee}` } : {}),
      ...(feeCents !== null ? { callout_fee_cents: feeCents } : {}),
      ...(aiInstructionParts.length > 0 ? { ai_instructions: aiInstructionParts.join(' ') } : {}),
      updated_at: new Date().toISOString(),
    };

    const { error: profileError } = await supabase
      .from('business_profiles')
      .upsert(profileRow, { onConflict: 'org_id' });
    if (profileError) {
      console.error('[VoiceOnboarding] Profile upsert failed.', { orgId: user.default_org_id, error: profileError.message });
      return res.status(500).json({ error: 'failed to apply profile' });
    }

    // Turn the receptionist on for this user and mirror the essentials into the
    // SMS agent's brain so both surfaces know the business from day one.
    const greeting = businessName
      ? `G'day, you've called ${businessName}!`
      : "G'day, thanks for calling!";
    const mergedBrain = {
      ...(user.business_brain || {}),
      ...(config.trade ? { business_type: config.trade } : {}),
      ...(businessName ? { business_name: businessName } : {}),
      ...(serviceAreas.length > 0 ? { service_area: serviceAreas.join(', ') } : {}),
      ...(feeCents !== null ? { callout_fee_cents: feeCents } : {}),
      ...(config.hours ? { hours: config.hours } : {}),
      currency: 'AUD',
    };

    const { error: userError } = await supabase
      .from('users')
      .update({
        receptionist_configured: true,
        call_handling_mode: 'ai_receptionist',
        receptionist_greeting: greeting,
        business_brain: mergedBrain,
      })
      .eq('id', user.id);
    if (userError) {
      console.error('[VoiceOnboarding] User receptionist update failed.', { userId: user.id, error: userError.message });
    }

    await supabase
      .from('voice_onboarding_sessions')
      .update({
        state: 'claimed',
        claimed_by: user.id,
        claimed_org_id: user.default_org_id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', session.id);

    console.log('[VoiceOnboarding] Session claimed.', {
      sessionId: session.id,
      userId: user.id,
      orgId: user.default_org_id,
    });

    return res.json({
      claimed: true,
      business_config: config,
      business_name: businessName,
      // Number assignment (pool allocation) is the next onboarding step; the
      // client shows "pick your number" once this returns.
      receptionist_live: false,
    });
  } catch (error) {
    console.error('[VoiceOnboarding] Claim failed.', { userId: req.user?.id, error: error.message });
    return res.status(500).json({ error: 'claim failed' });
  }
});

// Allocate a pool number and flip the receptionist live. The number is the
// routing key: getReceptionistProfileByNumber matches users.twilio_phone_number
// on inbound calls, so writing that column IS go-live.
router.post('/assign-number', authenticateJwt, async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'storage unavailable' });
  try {
    const user = await loadUser(req.user.id);
    if (!user) return res.status(404).json({ error: 'user not found' });
    if (!user.default_org_id) return res.status(409).json({ error: 'no organization for user yet' });

    // Idempotent: already has a number → return it.
    const { data: fullUser } = await supabase
      .from('users')
      .select('twilio_phone_number')
      .eq('id', user.id)
      .maybeSingle();
    if (fullUser?.twilio_phone_number) {
      return res.json({ phone_number: fullUser.twilio_phone_number, already_assigned: true });
    }

    const { data: session } = await supabase
      .from('voice_onboarding_sessions')
      .select('id, state')
      .eq('claimed_by', user.id)
      .maybeSingle();
    if (!session || !['claimed', 'receptionist_live'].includes(session.state)) {
      return res.status(409).json({ error: 'claim your receptionist config first' });
    }

    const { data: phoneNumber, error: allocError } = await supabase.rpc('allocate_pool_number', {
      p_user_id: user.id,
      p_org_id: user.default_org_id,
    });
    if (allocError) {
      console.error('[VoiceOnboarding] Pool allocation RPC failed.', { userId: user.id, error: allocError.message });
      return res.status(500).json({ error: 'allocation failed' });
    }
    if (!phoneNumber) {
      console.error('[VoiceOnboarding] NUMBER POOL EMPTY — top up AU numbers in Twilio.', { userId: user.id });
      return res.status(503).json({ error: 'pool_empty' });
    }

    const { error: userError } = await supabase
      .from('users')
      .update({ twilio_phone_number: phoneNumber })
      .eq('id', user.id);
    if (userError) {
      // Roll the allocation back so the number isn't stranded.
      await supabase
        .from('voice_number_pool')
        .update({ status: 'available', assigned_user_id: null, assigned_org_id: null, assigned_at: null })
        .eq('phone_number', phoneNumber);
      console.error('[VoiceOnboarding] Failed to write user number; allocation rolled back.', { userId: user.id, error: userError.message });
      return res.status(500).json({ error: 'assignment failed' });
    }

    // Bridge until RevenueCat wiring lands: the inbound-voice path voicemails
    // any org without an active/trialing subscription, which would kill the
    // post-claim test call. Mark the org trialing here; the StoreKit/RC step
    // replaces this with real entitlement state (and enforcement of expiry).
    const { data: org } = await supabase
      .from('organizations')
      .select('billing_plan_id, subscription_status')
      .eq('id', user.default_org_id)
      .maybeSingle();
    if (!org?.billing_plan_id || org.billing_plan_id === 'trial' || !['active', 'trialing'].includes(org?.subscription_status)) {
      const { error: billingError } = await supabase
        .from('organizations')
        .update({ billing_plan_id: 'receptionist', subscription_status: 'trialing' })
        .eq('id', user.default_org_id);
      if (billingError) {
        console.error('[VoiceOnboarding] Failed to set trial billing state — inbound calls will voicemail.', {
          orgId: user.default_org_id,
          error: billingError.message,
        });
      }
    }

    await supabase
      .from('voice_onboarding_sessions')
      .update({ state: 'receptionist_live', updated_at: new Date().toISOString() })
      .eq('id', session.id);

    console.log('[VoiceOnboarding] Number assigned, receptionist live.', {
      userId: user.id,
      orgId: user.default_org_id,
      phoneNumber,
    });

    return res.json({ phone_number: phoneNumber, receptionist_live: true });
  } catch (error) {
    console.error('[VoiceOnboarding] Assign-number failed.', { userId: req.user?.id, error: error.message });
    return res.status(500).json({ error: 'assignment failed' });
  }
});

module.exports = router;
