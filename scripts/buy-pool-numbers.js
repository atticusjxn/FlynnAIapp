#!/usr/bin/env node
/**
 * Top up the voice_number_pool with Twilio AU Mobile numbers.
 *
 * Buys N numbers using the approved AU regulatory bundle (same envs as the
 * per-user provisioning endpoint), points their voice webhook at the inbound
 * handler, and inserts them into voice_number_pool as 'available'. Idempotent
 * per number (unique phone_number). Costs real money per number per month —
 * it prints what it's about to do and requires --yes to execute.
 *
 * Usage:
 *   node scripts/buy-pool-numbers.js 5 --yes
 *   node scripts/buy-pool-numbers.js 1            # dry run: search + price only
 *
 * Required env (same as prod Fly secrets):
 *   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN,
 *   TWILIO_AU_BUNDLE_SID, TWILIO_AU_ADDRESS_SID,
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Optional: SERVER_PUBLIC_URL (default https://flynnai-telephony.fly.dev)
 */

require('dotenv').config();
const twilio = require('twilio');
const { createClient } = require('@supabase/supabase-js');

const count = parseInt(process.argv[2], 10) || 1;
const confirmed = process.argv.includes('--yes');

// Local (02/03/07/08) numbers cost $3.00/mo against $8.25 for Mobile, and under
// the call-forwarding model the client never sees or dials this number — they
// ring the operator's own mobile, which diverts here. It's an internal routing
// address, so the cheaper number is the same product.
// Mobile is still the right choice if the tenant number ever has to SEND SMS:
// AU local numbers are voice-only on Twilio.
const useLocal = process.argv.includes('--local');
const numberType = useLocal ? 'local' : 'mobile';

const {
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_AU_BUNDLE_SID,
  TWILIO_AU_ADDRESS_SID,
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
} = process.env;

const SERVER_URL = (process.env.SERVER_PUBLIC_URL || 'https://flynnai-telephony.fly.dev').replace(/\/$/, '');

const fail = (msg) => { console.error(`✗ ${msg}`); process.exit(1); };

if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) fail('TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN missing');
if (!TWILIO_AU_BUNDLE_SID || !TWILIO_AU_ADDRESS_SID) fail('TWILIO_AU_BUNDLE_SID / TWILIO_AU_ADDRESS_SID missing (AU regulatory bundle)');
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) fail('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing');

const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

(async () => {
  const { count: poolAvailable } = await supabase
    .from('voice_number_pool')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'available');
  console.log(`Pool currently has ${poolAvailable ?? 0} available number(s).`);

  // AU local numbers are voice-only, so only filter on SMS for Mobile.
  const available = await client
    .availablePhoneNumbers('AU')[numberType]
    .list(useLocal
      ? { voiceEnabled: true, limit: count }
      : { smsEnabled: true, voiceEnabled: true, limit: count });

  if (available.length < count) {
    console.warn(`⚠ Twilio only has ${available.length}/${count} AU ${numberType} numbers available right now.`);
  }
  if (available.length === 0) fail(`No AU ${numberType} numbers available from Twilio.`);

  console.log(`Will purchase ${available.length} AU ${numberType} number(s) (${useLocal ? '$3.00' : '$8.25'}/mo each):`);
  for (const n of available) console.log(`  ${n.phoneNumber}`);
  console.log(`Voice webhook: ${SERVER_URL}/telephony/inbound-voice`);

  if (!confirmed) {
    console.log('\nDry run (no purchase). Re-run with --yes to buy.');
    process.exit(0);
  }

  let bought = 0;
  for (const candidate of available) {
    try {
      const incoming = await client.incomingPhoneNumbers.create({
        phoneNumber: candidate.phoneNumber,
        voiceUrl: `${SERVER_URL}/telephony/inbound-voice`,
        voiceMethod: 'POST',
        statusCallback: `${SERVER_URL}/telephony/stream-status`,
        statusCallbackMethod: 'POST',
        bundleSid: TWILIO_AU_BUNDLE_SID,
        addressSid: TWILIO_AU_ADDRESS_SID,
      });

      const { error } = await supabase.from('voice_number_pool').insert({
        phone_number: incoming.phoneNumber,
        twilio_sid: incoming.sid,
        status: 'available',
      });
      if (error) {
        // Number is bought but not pooled — surface loudly so it isn't stranded.
        console.error(`✗ BOUGHT ${incoming.phoneNumber} (${incoming.sid}) but pool insert failed: ${error.message}`);
        console.error('  Insert it manually into voice_number_pool.');
      } else {
        bought += 1;
        console.log(`✓ ${incoming.phoneNumber} bought and pooled (${incoming.sid})`);
      }
    } catch (err) {
      console.error(`✗ Purchase failed for ${candidate.phoneNumber}: ${err.message}`);
    }
  }

  console.log(`\nDone: ${bought}/${available.length} added to the pool.`);
  console.log('To use one as the ad/funnel number: pick it, then');
  console.log("  fly secrets set FLYNN_FUNNEL_NUMBERS=<number> -a flynnai-telephony");
  console.log("  and mark it quarantined in voice_number_pool so it isn't assigned to a tenant.");
  process.exit(0);
})().catch((err) => fail(err.message));
