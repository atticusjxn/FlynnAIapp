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
const { sendAttachment } = require('./blueBubbles');

const HOUR = 60 * 60 * 1000;
const SWEEP_INTERVAL_MS = 10 * 60 * 1000; // run the candidate query at most every 10 min

const SERVER_URL = process.env.SERVER_URL || 'https://flynnai-telephony.fly.dev';
const VCARD_URL = `${SERVER_URL}/api/signup/contact.vcf`;

// iMessage gives us no signal for whether someone actually saved Flynn as a
// contact, so we treat "signed up, never replied" as the proxy. The first nudge
// re-sends the contact card with a "save me so you don't lose me" line, tailored
// to whatever business context we have; the later two are value-first follow-ups.
const FOLLOWUPS = [
  "still here whenever you're ready. tell me your trade and i'll start handling the boring stuff, invoices, parts, replies",
  "last one from me. text me anytime and i'll pick up where we left off",
];

// First-touch contact nudge, personalised from the user's business context.
function contactNudge(user) {
  const biz = (user?.business_brain?.business_type || '').trim();
  const lead = "hey, it's flynn. save me as a contact so you don't lose me, card's attached.";
  if (biz) {
    return `${lead}\n\nwhenever you're back to it i can sort the admin side of your ${biz} work, invoices, quotes, bookings, just text me`;
  }
  return `${lead}\n\ntell me what kind of work you do and i'll start handling the boring stuff for you, invoices, parts, replies`;
}

// One contact nudge (count 0) + the value-first follow-ups.
const TOTAL_NUDGES = 1 + FOLLOWUPS.length;

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

  // Send the right nudge for this user's current count, re-attaching the vCard
  // on the first (contact) touch. Increments the count + stamps the time.
  // Shared by the timed cron sweep and the immediate backfill.
  async sendNudge(user, now) {
    const count = user.reengagement_sent_count || 0;
    const channel = resolveChannel(user); // iMessage-first; SMS fallback inside sendToUser
    const message = count === 0 ? contactNudge(user) : FOLLOWUPS[count - 1];

    await sendToUser(user.phone, message, { channel, supabase: this.supabase });

    // The "save me as a contact" touch carries the card again. iMessage only —
    // vCard MMS at signup already covered the SMS path.
    if (count === 0 && channel === 'imessage') {
      await sendAttachment(user.phone, VCARD_URL, 'Flynn.vcf')
        .catch((err) => console.warn('[Reengagement] vCard re-send failed:', err?.message));
    }

    await this.supabase
      .from('users')
      .update({
        reengagement_sent_count: count + 1,
        last_reengagement_at: new Date(now).toISOString(),
      })
      .eq('id', user.id);

    console.log('[Reengagement] Sent nudge', { phone: user.phone, step: count + 1, withVCard: count === 0 });
  }

  // Is this candidate due for its next nudge, given how many we've sent?
  isDue(user, now) {
    const count = user.reengagement_sent_count || 0;
    if (count >= TOTAL_NUDGES) return false;

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
      .select('id, phone, created_at, reengagement_sent_count, last_reengagement_at, preferred_channel, business_brain')
      .eq('onboarding_step', 'brain_pending')
      .eq('reengagement_opted_out', false)
      .lt('reengagement_sent_count', TOTAL_NUDGES)
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
        await this.sendNudge(user, now);
        sent++;
      } catch (err) {
        console.error('[Reengagement] Failed for', user.phone, err?.message || err);
      }
    }

    if (sent > 0) console.log(`[Reengagement] Sweep complete, ${sent} nudge(s) sent`);
    return { sent };
  }

  /**
   * One-time backfill: send the contact nudge NOW to everyone who signed up but
   * never got it (still at count 0, never replied, not opted out), ignoring the
   * usual ~2h spacing. Idempotent — once a user is bumped to count 1 they're no
   * longer a candidate, so re-running won't double-send. Pass dryRun to preview.
   */
  async runImmediateContactSweep({ dryRun = false } = {}) {
    if (!this.supabase) return { sent: 0, candidates: [] };
    const now = Date.now();

    const { data: rows, error } = await this.supabase
      .from('users')
      .select('id, phone, reengagement_sent_count, preferred_channel, business_brain')
      .eq('onboarding_step', 'brain_pending')
      .eq('reengagement_opted_out', false)
      .eq('reengagement_sent_count', 0)
      .not('phone', 'is', null)
      .limit(500);

    if (error) {
      console.error('[Reengagement] Immediate sweep query failed:', error.message);
      return { sent: 0, candidates: [] };
    }

    const eligible = [];
    for (const user of rows || []) {
      if (!user.phone || user.phone.replace(/\D/g, '').length < 8) continue; // skip junk numbers
      if (await this.hasInbound(user.phone)) continue; // already engaged
      eligible.push(user);
    }

    if (dryRun) {
      return { sent: 0, dryRun: true, candidates: eligible.map((u) => ({ phone: u.phone, biz: u.business_brain?.business_type || null })) };
    }

    let sent = 0;
    for (const user of eligible) {
      try {
        await this.sendNudge(user, now);
        sent++;
      } catch (err) {
        console.error('[Reengagement] Immediate nudge failed for', user.phone, err?.message || err);
      }
    }
    console.log(`[Reengagement] Immediate contact sweep complete, ${sent}/${eligible.length} sent`);
    return { sent, eligible: eligible.length };
  }
}

module.exports = new ReengagementScheduler();
