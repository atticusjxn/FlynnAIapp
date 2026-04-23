/**
 * Usage watcher — fires the 80% threshold push and records that it did so
 * in `usage_notifications_sent` to avoid duplicates within a billing period.
 *
 * Run hourly. Idempotent: every row in `usage_notifications_sent` is keyed on
 * (user_id, period_start, threshold) so re-running is safe.
 */

const { supabase } = require('../supabaseClient');
const { sendToUser } = require('../pushNotifier');

const WARN_FRACTION = 0.8;

async function run() {
  const { data: rows, error } = await supabase
    .from('v_current_usage')
    .select('user_id, plan_name, plan_slug, ai_minutes_monthly, ai_minutes_used, current_period_start, subscription_status');

  if (error) {
    console.error('[usageWatcher] query failed:', error.message);
    return { checked: 0, sent: 0 };
  }

  let sent = 0;

  for (const row of rows || []) {
    if (!['trialing', 'active', 'grace_period'].includes(row.subscription_status)) continue;
    if (!row.ai_minutes_monthly || row.ai_minutes_monthly <= 0) continue;
    const fraction = Number(row.ai_minutes_used || 0) / Number(row.ai_minutes_monthly);
    if (fraction < WARN_FRACTION) continue;

    const threshold = fraction >= 1.0 ? 'hard_100' : 'warn_80';

    // Sentinel to avoid re-notifying the same user for the same period.
    const { error: sentinelErr } = await supabase
      .from('usage_notifications_sent')
      .insert({
        user_id: row.user_id,
        period_start: row.current_period_start,
        threshold,
      });
    if (sentinelErr) {
      // Unique violation → already notified; skip quietly.
      if (!String(sentinelErr.message).includes('duplicate')) {
        console.error('[usageWatcher] sentinel insert failed:', sentinelErr.message);
      }
      continue;
    }

    const copy = threshold === 'hard_100'
      ? {
          title: 'AI minutes used up',
          body: `You've hit your ${row.plan_name || 'Flynn'} minute cap — new calls are falling back to SMS links. Tap to upgrade.`,
        }
      : {
          title: 'Running low on AI minutes',
          body: `You've used ${Math.round(fraction * 100)}% of this period's AI allowance. Tap to review.`,
        };

    const result = await sendToUser({
      userId: row.user_id,
      category: 'usage_warning',
      title: copy.title,
      body: copy.body,
      data: { deepLink: 'flynnai://settings/billing' },
      threadId: 'usage',
    });
    if (result.success) sent++;
  }

  return { checked: (rows || []).length, sent };
}

if (require.main === module) {
  run()
    .then((r) => { console.log('[usageWatcher]', r); process.exit(0); })
    .catch((err) => { console.error('[usageWatcher] failed:', err); process.exit(1); });
}

module.exports = { run };
