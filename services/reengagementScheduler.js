// services/reengagementScheduler.js
//
// Win back signups who never replied. A user who arrives via the web/SMS/iMessage
// signup but never texts Flynn back is stuck at onboarding_step='brain_pending'.
// This sweep sends up to three spaced, value-first nudges then stops for good.
// Any inbound message from the user ends the sequence naturally (the zero-inbound
// check below), so a reply is never followed by a nudge.
//
// Wired into the existing 60s cron in server.js; an internal guard throttles the
// actual DB sweep to ~10 minutes so it doesn't hammer Supabase every tick.

const { createClient } = require('@supabase/supabase-js');
const { sendToUser, resolveChannel } = require('./flynnOutbound');

const HOUR = 60 * 60 * 1000;
const SWEEP_INTERVAL_MS = 10 * 60 * 1000; // run the candidate query at most every 10 min

// Value-first copy. Short, lowercase, no pressure. count 0 -> M1, 1 -> M2, 2 -> M3.
const MESSAGES = [
  'hey, what kind of work do you do? once i know your business i can start sorting the admin for you',
  "still here whenever you're ready. tell me your trade and i'll start handling the boring stuff, invoices, parts, replies",
  "last one from me. text me anytime and i'll pick up where we left off",
];

class ReengagementScheduler {
  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_KEY ||
      process.env.SUPABASE_SECRET;

    if (!supabaseUrl || !supabaseKey) {
      console.warn('[Reengagement] Supabase credentials not configured, service disabled');
      this.supabase = null;
    } else {
      this.supabase = createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
    }
    this._lastSweep = 0;
  }

  // Has this user ever texted Flynn? If so, the sequence is over.
  async hasInbound(phone) {
    const { count } = await this.supabase
      .from('sms_messages')
      .select('id', { count: 'exact', head: true })
      .eq('user_phone', phone)
      .eq('direction', 'in');
    return (count || 0) > 0;
  }

  // Is this candidate due for its next nudge, given how many we've sent?
  isDue(user, now) {
    const count = user.reengagement_sent_count || 0;
    if (count >= MESSAGES.length) return false;

    const createdMs = user.created_at ? new Date(user.created_at).getTime() : 0;
    const lastMs = user.last_reengagement_at ? new Date(user.last_reengagement_at).getTime() : 0;

    if (count === 0) return now - createdMs >= 2 * HOUR;      // ~2h after signup
    if (count === 1) return now - lastMs >= 22 * HOUR;        // ~24h after signup
    if (count === 2) return now - lastMs >= 48 * HOUR;        // ~72h after signup
    return false;
  }

  /**
   * Called every cron tick. Throttled internally to SWEEP_INTERVAL_MS.
   */
  async processReengagement() {
    if (!this.supabase) return { sent: 0 };

    const now = Date.now();
    if (now - this._lastSweep < SWEEP_INTERVAL_MS) return { sent: 0, skipped: 'throttled' };
    this._lastSweep = now;

    const twoHoursAgo = new Date(now - 2 * HOUR).toISOString();

    const { data: candidates, error } = await this.supabase
      .from('users')
      .select('id, phone, created_at, reengagement_sent_count, last_reengagement_at, preferred_channel')
      .eq('onboarding_step', 'brain_pending')
      .eq('reengagement_opted_out', false)
      .lt('reengagement_sent_count', MESSAGES.length)
      .lt('created_at', twoHoursAgo)
      .not('phone', 'is', null)
      .limit(200);

    if (error) {
      console.error('[Reengagement] Candidate query failed:', error.message);
      return { sent: 0 };
    }

    let sent = 0;
    for (const user of candidates || []) {
      try {
        if (!this.isDue(user, now)) continue;
        if (await this.hasInbound(user.phone)) continue; // they engaged — stop

        const count = user.reengagement_sent_count || 0;
        const message = MESSAGES[count];
        const channel = resolveChannel(user); // iMessage-first; SMS fallback inside sendToUser

        await sendToUser(user.phone, message, { channel, supabase: this.supabase });

        await this.supabase
          .from('users')
          .update({
            reengagement_sent_count: count + 1,
            last_reengagement_at: new Date(now).toISOString(),
          })
          .eq('id', user.id);

        sent++;
        console.log('[Reengagement] Sent nudge', { phone: user.phone, step: count + 1 });
      } catch (err) {
        console.error('[Reengagement] Failed for', user.phone, err?.message || err);
      }
    }

    if (sent > 0) console.log(`[Reengagement] Sweep complete, ${sent} nudge(s) sent`);
    return { sent };
  }
}

module.exports = new ReengagementScheduler();
