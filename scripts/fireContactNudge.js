// scripts/fireContactNudge.js
//
// One-time backfill: send Flynn's "save me as a contact" nudge (with the vCard
// re-attached) NOW to everyone who signed up but never got it — still at
// reengagement count 0, never replied, not opted out. Idempotent: re-running
// won't double-send because each send bumps the user past count 0.
//
// Usage (on the Fly machine, where the env/secrets live):
//   node scripts/fireContactNudge.js --dry   # preview the audience, send nothing
//   node scripts/fireContactNudge.js         # actually send

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const scheduler = require('../services/reengagementScheduler');

(async () => {
  const dryRun = process.argv.includes('--dry');
  const result = await scheduler.runImmediateContactSweep({ dryRun });
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
})().catch((err) => {
  console.error('fireContactNudge failed:', err);
  process.exit(1);
});
