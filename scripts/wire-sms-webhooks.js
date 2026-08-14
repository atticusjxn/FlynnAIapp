#!/usr/bin/env node

/**
 * Point every Flynn number's SMS webhook at the inbound handler.
 *
 * Pool numbers are bought ahead of time (scripts/buy-pool-numbers.js) and
 * allocated by the `allocate_pool_number` RPC, which sets the voice URL but
 * never the SMS one. So an org's assigned number answers calls and is
 * SMS-capable, but has no smsUrl — Twilio accepts the inbound text and drops
 * it. Nothing is logged, nothing is answered, and the client hears nothing
 * back.
 *
 * That matters more than it sounds: inbound client SMS cannot be forwarded
 * into Flynn (AU carriers have no SMS equivalent of the **61* voice divert,
 * and Twilio Hosted SMS is US/Canada only), so the ONLY way it ever arrives is
 * on a number Flynn seeded into the client's phone. An unwired smsUrl breaks
 * the one path that exists.
 *
 * Dry run by default. Pass --apply to write.
 *
 *   node scripts/wire-sms-webhooks.js            # show what would change
 *   node scripts/wire-sms-webhooks.js --apply    # write it
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const SERVER_URL = process.env.SERVER_URL || 'https://flynnai-telephony.fly.dev';
const SMS_URL = `${SERVER_URL}/webhooks/sms/inbound`;
const APPLY = process.argv.includes('--apply');

const mask = (n) => (n ? `${n.slice(0, 6)}***${n.slice(-2)}` : '(none)');

async function main() {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } = process.env;
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    console.error('TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN not set.');
    process.exit(1);
  }

  const client = require('twilio')(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  const numbers = await client.incomingPhoneNumbers.list({ limit: 200 });

  console.log(`${APPLY ? 'APPLYING' : 'DRY RUN'} — target smsUrl: ${SMS_URL}\n`);

  let changed = 0;
  let already = 0;
  let skipped = 0;

  for (const n of numbers) {
    if (!n.capabilities?.sms) {
      console.log(`  skip    ${mask(n.phoneNumber)}  not SMS-capable`);
      skipped += 1;
      continue;
    }
    if (n.smsUrl === SMS_URL && n.smsMethod === 'POST') {
      already += 1;
      continue;
    }

    console.log(`  ${APPLY ? 'update ' : 'would  '} ${mask(n.phoneNumber)}  ${n.smsUrl || '(none)'} -> ${SMS_URL}`);
    changed += 1;

    if (APPLY) {
      try {
        await client.incomingPhoneNumbers(n.sid).update({ smsUrl: SMS_URL, smsMethod: 'POST' });
      } catch (err) {
        console.error(`  FAILED  ${mask(n.phoneNumber)}: ${err.message}`);
      }
    }
  }

  console.log(
    `\n${changed} ${APPLY ? 'updated' : 'to update'}, ${already} already correct, ${skipped} skipped (no SMS capability).`
  );
  if (!APPLY && changed > 0) console.log('Re-run with --apply to write.');
}

main().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
