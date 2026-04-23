/**
 * Usage guard — enforces monthly AI-minute soft cap.
 *
 * Called at `call.initiated` in the Telnyx webhook. Returns whether the user
 * is still under their plan's AI-minute budget. If over budget, `ivrHandler`
 * forces the Mode A (SMS-link) branch and tags the call with
 * `handling_mode='ai_fallback_sms'` so analytics and the per-month view can
 * tell a real fallback from a voluntary SMS-link call.
 *
 * Source of truth is the `v_current_usage` SQL view; no local counters.
 */

const { supabase } = require('./supabaseClient');

/**
 * @param {string} userId
 * @returns {Promise<{ hasSubscription: boolean, allowAI: boolean, aiMinutesUsed: number, aiMinutesMonthly: number, remainingMinutes: number, subscriptionStatus: string|null, planSlug: string|null }>}
 */
async function getUsage(userId) {
  const { data, error } = await supabase
    .from('v_current_usage')
    .select(
      'plan_slug, ai_minutes_monthly, ai_minutes_used, subscription_status, current_period_end'
    )
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('[usageGuard] v_current_usage query failed:', error.message);
    // Fail open — don't kill inbound calls on a query error.
    return {
      hasSubscription: false,
      allowAI: true,
      aiMinutesUsed: 0,
      aiMinutesMonthly: 0,
      remainingMinutes: Infinity,
      subscriptionStatus: null,
      planSlug: null,
    };
  }

  const status = data?.subscription_status ?? null;
  const hasSubscription =
    !!status && ['trialing', 'active', 'grace_period'].includes(status);
  const aiMinutesMonthly = Number(data?.ai_minutes_monthly ?? 0);
  const aiMinutesUsed = Number(data?.ai_minutes_used ?? 0);
  const remainingMinutes = Math.max(aiMinutesMonthly - aiMinutesUsed, 0);

  // No active subscription → treat as no AI allowance (user must pick a plan or
  // finish the trial). Mode A still works for everyone.
  const allowAI = hasSubscription && aiMinutesUsed < aiMinutesMonthly;

  return {
    hasSubscription,
    allowAI,
    aiMinutesUsed,
    aiMinutesMonthly,
    remainingMinutes,
    subscriptionStatus: status,
    planSlug: data?.plan_slug ?? null,
  };
}

/**
 * Resolve the effective handling mode for an incoming call based on user's
 * configured mode + current usage. Returns one of:
 *   'sms_links' | 'ai_receptionist' | 'voicemail_only' | 'ai_fallback_sms'
 */
async function resolveHandlingMode(userId, configuredMode) {
  const mode = configuredMode || 'sms_links';

  if (mode !== 'ai_receptionist') {
    return { mode, usage: null };
  }

  const usage = await getUsage(userId);
  if (usage.allowAI) {
    return { mode: 'ai_receptionist', usage };
  }
  return { mode: 'ai_fallback_sms', usage };
}

module.exports = {
  getUsage,
  resolveHandlingMode,
};
