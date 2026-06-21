// services/quoteChaseScheduler.js
//
// Proactive quote follow-up — the "chase quotes that go cold" sticky-core job.
// Sweeps agent_quotes for open quotes whose next_followup_at has passed and DMs
// the operator a value-first nudge ("that quote for dave's gone quiet, want me
// to chase it?"). Caps at MAX_FOLLOWUPS then expires the quote so Flynn never
// nags. Quotes for one operator are batched into a single message.
//
// Wired into the existing 60s cron in server.js; an internal guard throttles the
// DB sweep to ~15 min. Respects reengagement_opted_out. Disable with
// FLYNN_PROACTIVE_CHASE=0.

const { createClient } = require('@supabase/supabase-js');
const { sendToUser } = require('./flynnOutbound');
const { sanitiseReply } = require('./flynnTone');

const MINUTE = 60 * 1000;
const SWEEP_INTERVAL_MS = 15 * MINUTE;
const FOLLOWUP_GAP_DAYS = 4;     // gap between repeat nudges
const MAX_FOLLOWUPS = 3;         // then expire — never nag past this
const MAX_USERS_PER_TICK = 40;   // cap outbound bursts (send-rate safety)

function money(cents, currency) {
  return `${currency === 'GBP' ? '£' : '$'}${(Math.round(cents || 0) / 100).toFixed(2).replace(/\.00$/, '')}`;
}

class QuoteChaseScheduler {
  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_KEY ||
      process.env.SUPABASE_SECRET;
    if (!supabaseUrl || !supabaseKey) {
      console.warn('[QuoteChase] Supabase credentials not configured, service disabled');
      this.supabase = null;
    } else {
      this.supabase = createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
    }
    this._lastSweep = 0;
  }

  async processTick() {
    if (!this.supabase) return { chased: 0 };
    if (process.env.FLYNN_PROACTIVE_CHASE === '0') return { disabled: true };
    const now = Date.now();
    if (now - this._lastSweep < SWEEP_INTERVAL_MS) return { skipped: 'throttled' };
    this._lastSweep = now;

    const { data: due, error } = await this.supabase
      .from('agent_quotes')
      .select('id, user_phone, client_name, client_email, amount_cents, currency, followup_count')
      .eq('status', 'open')
      .lte('next_followup_at', new Date(now).toISOString())
      .order('next_followup_at', { ascending: true })
      .limit(200);
    if (error) {
      console.error('[QuoteChase] query failed:', error.message);
      return { chased: 0 };
    }
    if (!due || !due.length) return { chased: 0 };

    // Batch per operator so a user with several cold quotes gets one message.
    const byPhone = new Map();
    for (const q of due) {
      if (!byPhone.has(q.user_phone)) byPhone.set(q.user_phone, []);
      byPhone.get(q.user_phone).push(q);
    }

    const phones = [...byPhone.keys()];
    const { data: users } = await this.supabase
      .from('users')
      .select('phone, reengagement_opted_out')
      .in('phone', phones);
    const optedOut = new Set((users || []).filter((u) => u.reengagement_opted_out).map((u) => u.phone));

    let chased = 0;
    for (const [phone, quotes] of byPhone) {
      if (chased >= MAX_USERS_PER_TICK) break;
      if (optedOut.has(phone)) continue; // leave their rows; they don't want proactive pings
      try {
        await this.chaseUser(phone, quotes, new Date(now));
        chased++;
      } catch (err) {
        console.error('[QuoteChase] failed for', phone, err?.message || err);
      }
    }
    if (chased) console.log(`[QuoteChase] nudged ${chased} operator(s)`);
    return { chased };
  }

  async chaseUser(phone, quotes, now) {
    const currency = quotes[0]?.currency || 'AUD';
    const message = quotes.length === 1
      ? `that quote for ${quotes[0].client_name?.toLowerCase() || 'your client'} (${money(quotes[0].amount_cents, currency)}) has gone quiet. want me to chase them up?`
      : `a few quotes have gone quiet:\n${quotes.map((q) => `${q.client_name} ${money(q.amount_cents, q.currency || currency)}`).join('\n')}\n\nwant me to chase any of them?`;

    await sendToUser(phone, sanitiseReply(message), { channel: 'imessage', supabase: this.supabase });

    // Park the chase so a plain "yep" runs it deterministically — no inference,
    // no re-asking for the client's email. The inbound confirm path picks up the
    // most recent unexpired pending_actions row and runs chase_quote via the
    // registry. Clear any stale parked chase first so we don't stack them.
    await this.supabase
      .from('pending_actions')
      .delete()
      .eq('user_phone', phone)
      .eq('tool_name', 'chase_quote')
      .eq('status', 'awaiting_confirmation')
      .then(() => {}, () => {});
    const toolArgs = {
      quote_ids: quotes.map((q) => q.id),
      clients: quotes.map((q) => ({
        quote_id: q.id,
        name: q.client_name,
        email: q.client_email || null,
        amount_cents: q.amount_cents,
        currency: q.currency || currency,
      })),
    };
    await this.supabase
      .from('pending_actions')
      .insert({
        user_phone: phone,
        action_type: 'chase_quote',
        action_data: toolArgs,
        confirmation_message: message,
        status: 'awaiting_confirmation',
        tool_name: 'chase_quote',
        tool_args: toolArgs,
        expires_at: new Date(now.getTime() + 24 * 60 * MINUTE).toISOString(),
      })
      .then(() => {}, (e) => console.warn('[QuoteChase] park pending failed:', e?.message));

    const nowIso = now.toISOString();
    const nextIso = new Date(now.getTime() + FOLLOWUP_GAP_DAYS * 24 * 60 * MINUTE).toISOString();
    for (const q of quotes) {
      const nextCount = (q.followup_count || 0) + 1;
      const update = nextCount >= MAX_FOLLOWUPS
        ? { status: 'expired', followup_count: nextCount, last_followup_at: nowIso, updated_at: nowIso }
        : { followup_count: nextCount, last_followup_at: nowIso, next_followup_at: nextIso, updated_at: nowIso };
      await this.supabase.from('agent_quotes').update(update).eq('id', q.id).then(() => {}, () => {});
    }
  }
}

module.exports = new QuoteChaseScheduler();
