#!/usr/bin/env node
/**
 * Checks Twilio forwarding health by inspecting Supabase phone_numbers + call_events.
 * Run with: `node scripts/check-forwarding-health.js`
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('[Health] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Cannot run health check.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const hoursAgo = (hrs) => new Date(Date.now() - hrs * 60 * 60 * 1000).toISOString();

const run = async () => {
  console.log('[Health] Checking phone number verification + forwarding status…');

  const { data: numbers, error } = await supabase
    .from('phone_numbers')
    .select('id, org_id, e164_number, connected_number, verification_state, status, updated_at')
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('[Health] Failed to load phone_numbers:', error.message);
    process.exit(1);
  }

  const unhealthy = (numbers || []).filter((number) => {
    if (!number) return false;
    const notVerified = number.verification_state !== 'verified';
    const inactive = number.status !== 'active';
    const missingForward = !number.connected_number;
    return notVerified || inactive || missingForward;
  });

  if (unhealthy.length === 0) {
    console.log('✅ All FlynnAI numbers show verified forwarding + active status.');
  } else {
    console.log(`⚠️  ${unhealthy.length} number(s) need attention:`);
    unhealthy.forEach((number) => {
      console.log(
        `  - org=${number.org_id || 'unknown'} number=${number.e164_number || 'n/a'} ` +
        `status=${number.status} verification=${number.verification_state} connected=${number.connected_number || 'missing'}`
      );
    });
  }

  console.log('\n[Health] Checking recent call events for warnings…');
  const { data: recentEvents, error: eventsError } = await supabase
    .from('call_events')
    .select('org_id, event_type, direction, occurred_at, payload')
    .in('event_type', ['call_routed_voicemail', 'transcription_failed', 'job_creation_failed'])
    .gte('occurred_at', hoursAgo(24))
    .order('occurred_at', { ascending: false });

  if (eventsError) {
    console.error('[Health] Failed to load call_events:', eventsError.message);
    process.exit(1);
  }

  if (!recentEvents || recentEvents.length === 0) {
    console.log('✅ No warning events in the last 24h.');
  } else {
    console.log(`⚠️  Found ${recentEvents.length} warning event(s) in last 24h:`);
    recentEvents.forEach((event) => {
      console.log(
        `  - ${event.occurred_at} org=${event.org_id} event=${event.event_type} reason=${event.payload?.reason || 'n/a'}`
      );
    });
  }

  console.log('\nDone. Investigate any ⚠️ entries and confirm forwarding is active inside each customer’s carrier portal.');
};

run().catch((err) => {
  console.error('[Health] Unexpected failure:', err);
  process.exit(1);
});
