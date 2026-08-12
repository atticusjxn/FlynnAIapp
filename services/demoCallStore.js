/**
 * demo_calls persistence — the onboarding "hear it for yourself" call.
 *
 * A demo call rings the user's own verified mobile and connects them to their
 * AI receptionist. This module is the only writer/reader of the demo_calls
 * table: it tracks the call's lifecycle and holds the payoff (transcript + the
 * job Flynn extracted) for the app to poll. Uses the service role, so it
 * bypasses RLS — demo transcripts are never exposed to the publishable key.
 */

const { createClient } = require('@supabase/supabase-js');

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

function ensure() {
  if (!supabase) throw new Error('demoCallStore: Supabase service client not configured');
  return supabase;
}

/** Create a demo-call row in the `ringing` state. Returns the row. */
async function createDemoCall({ userId, orgId, callSid, toPhone }) {
  const { data, error } = await ensure()
    .from('demo_calls')
    .insert({ user_id: userId, org_id: orgId || null, call_sid: callSid || null, to_phone: toPhone, status: 'ringing' })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

async function getDemoCallById(id) {
  const { data, error } = await ensure().from('demo_calls').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return data || null;
}

/** The completion handler's demo signal: is this Twilio call a demo call? */
async function getDemoCallBySid(callSid) {
  if (!callSid) return null;
  const { data, error } = await ensure().from('demo_calls').select('*').eq('call_sid', callSid).maybeSingle();
  if (error) {
    console.warn('[demoCallStore] getDemoCallBySid failed.', { callSid, error: error.message });
    return null;
  }
  return data || null;
}

async function setDemoCallStatus(id, status) {
  const patch = { status };
  if (['completed', 'no_answer', 'failed', 'canceled'].includes(status)) {
    patch.completed_at = new Date().toISOString();
  }
  const { error } = await ensure().from('demo_calls').update(patch).eq('id', id);
  if (error) console.warn('[demoCallStore] setDemoCallStatus failed.', { id, status, error: error.message });
}

/** Map a Twilio call status to a demo_calls status. Only downgrade to a
 *  terminal state; never overwrite a completed call. */
async function applyTwilioStatus(id, twilioStatus) {
  const map = {
    'in-progress': 'in_progress',
    answered: 'in_progress',
    completed: 'completed',
    'no-answer': 'no_answer',
    busy: 'no_answer',
    failed: 'failed',
    canceled: 'canceled',
  };
  const mapped = map[twilioStatus];
  if (!mapped) return;
  // Don't clobber a richer terminal state the completion handler already wrote.
  const current = await getDemoCallById(id);
  if (!current || ['completed', 'no_answer', 'failed', 'canceled'].includes(current.status)) return;
  await setDemoCallStatus(id, mapped);
}

/** Write the payoff and mark completed. Called from the demo branch of the
 *  realtime completion handler. */
async function completeDemoCall({ id, transcript, extractedJob }) {
  const { error } = await ensure()
    .from('demo_calls')
    .update({
      status: 'completed',
      transcript: transcript || null,
      extracted_job: extractedJob || null,
      completed_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) console.warn('[demoCallStore] completeDemoCall failed.', { id, error: error.message });
}

/** Count a user's demo calls since `sinceIso`, for rate limiting. */
async function countDemoCallsSince(userId, sinceIso) {
  const { count, error } = await ensure()
    .from('demo_calls')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', sinceIso);
  if (error) {
    console.warn('[demoCallStore] countDemoCallsSince failed.', { userId, error: error.message });
    return 0;
  }
  return count || 0;
}

/** Is there a demo call for this user still in flight (ringing/in_progress)? */
async function hasActiveDemoCall(userId) {
  const { data, error } = await ensure()
    .from('demo_calls')
    .select('id, status, created_at')
    .eq('user_id', userId)
    .in('status', ['ringing', 'in_progress'])
    .gte('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString())
    .limit(1);
  if (error) return false;
  return Array.isArray(data) && data.length > 0;
}

module.exports = {
  createDemoCall,
  getDemoCallById,
  getDemoCallBySid,
  setDemoCallStatus,
  applyTwilioStatus,
  completeDemoCall,
  countDemoCallsSince,
  hasActiveDemoCall,
  isConfigured: () => !!supabase,
};
