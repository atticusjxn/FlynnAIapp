// services/weeklyDigestScheduler.js
//
// The weekly money/admin digest — the habit anchor from the strategy ("this
// week: 3 unpaid, 2 quotes cold"). Once a week, at the operator's local digest
// hour, Flynn DMs a single summary pulled from their real data: unpaid invoices
// (Xero, if connected) + open quotes (agent_quotes). Value-first: if there's
// nothing to report it stays quiet (but stamps, so it doesn't re-poll all hour).
//
// Wired into the existing 60s cron in server.js; an internal guard throttles the
// sweep so it fires a few times within the digest hour. Disable with
// FLYNN_WEEKLY_DIGEST=0. Configure timing with FLYNN_DIGEST_HOUR (default 17)
// and FLYNN_DIGEST_DOW (0=Sun .. 6=Sat, default 0).

const { createClient } = require('@supabase/supabase-js');
const { sendToUser } = require('./flynnOutbound');
const { sanitiseReply } = require('./flynnTone');
const registry = require('./agent/toolRegistry');
const xeroReceivables = require('./xeroReceivables');

const MINUTE = 60 * 1000;
const SWEEP_INTERVAL_MS = 20 * MINUTE;
const COOLDOWN_MS = 6 * 24 * 60 * MINUTE; // ~6 days — one digest per week per user
const MAX_USERS_PER_TICK = 40;            // cap outbound bursts (send-rate safety)

const DOW = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

function money(cents, currency) {
  return `${currency === 'GBP' ? '£' : '$'}${(Math.round(cents || 0) / 100).toFixed(2).replace(/\.00$/, '')}`;
}
function currencyFromPhone(phone = '') {
  if (phone.startsWith('+64')) return 'NZD';
  if (phone.startsWith('+44')) return 'GBP';
  if (phone.startsWith('+1')) return 'USD';
  return 'AUD';
}

class WeeklyDigestScheduler {
  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_KEY ||
      process.env.SUPABASE_SECRET;
    if (!supabaseUrl || !supabaseKey) {
      console.warn('[WeeklyDigest] Supabase credentials not configured, service disabled');
      this.supabase = null;
    } else {
      this.supabase = createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
    }
    this._lastSweep = 0;
  }

  hourInTz(now, phone) {
    const tz = registry.timezoneFromPhone(phone || '');
    return Number(new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hour12: false }).format(now)) % 24;
  }
  dowInTz(now, phone) {
    const tz = registry.timezoneFromPhone(phone || '');
    const wd = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' }).format(now);
    return DOW[wd];
  }

  async processTick() {
    if (!this.supabase) return { sent: 0 };
    if (process.env.FLYNN_WEEKLY_DIGEST === '0') return { disabled: true };
    const now = Date.now();
    if (now - this._lastSweep < SWEEP_INTERVAL_MS) return { skipped: 'throttled' };
    this._lastSweep = now;

    const digestHour = Number(process.env.FLYNN_DIGEST_HOUR ?? 17);
    const digestDow = Number(process.env.FLYNN_DIGEST_DOW ?? 0);
    const nowDate = new Date(now);

    // Engaged users only: past brain_pending, not opted out.
    const { data: users, error } = await this.supabase
      .from('users')
      .select('id, phone, last_weekly_digest_at, reengagement_opted_out, onboarding_step')
      .neq('onboarding_step', 'brain_pending')
      .limit(500);
    if (error) {
      console.error('[WeeklyDigest] user query failed:', error.message);
      return { sent: 0 };
    }

    let sent = 0;
    for (const user of users || []) {
      if (sent >= MAX_USERS_PER_TICK) break;
      if (!user.phone || user.reengagement_opted_out) continue;
      if (this.dowInTz(nowDate, user.phone) !== digestDow) continue;
      if (this.hourInTz(nowDate, user.phone) !== digestHour) continue;
      if (user.last_weekly_digest_at && (now - new Date(user.last_weekly_digest_at).getTime()) < COOLDOWN_MS) continue;
      try {
        if (await this.digestUser(user, nowDate)) sent++;
      } catch (err) {
        console.error('[WeeklyDigest] failed for', user.phone, err?.message || err);
      }
    }
    if (sent) console.log(`[WeeklyDigest] sent ${sent} digest(s)`);
    return { sent };
  }

  async digestUser(user, now) {
    const phone = user.phone;
    const currency = currencyFromPhone(phone);

    // Unpaid invoices (best-effort — only if Xero is connected via OAuth).
    let invoices = [];
    const { data: xeroConn } = await this.supabase
      .from('user_connections')
      .select('*')
      .eq('user_phone', phone)
      .eq('provider', 'xero')
      .maybeSingle();
    if (xeroConn?.nango_connection_id) {
      try {
        invoices = await xeroReceivables.listOutstandingInvoices({ connectionRow: xeroConn, supabase: this.supabase, onlyOverdue: false });
      } catch (err) {
        console.warn('[WeeklyDigest] xero read failed for', phone, err?.message);
      }
    }

    // Open quotes (always available — our own table).
    const { data: openQuotes } = await this.supabase
      .from('agent_quotes')
      .select('amount_cents, currency')
      .eq('user_phone', phone)
      .eq('status', 'open');

    const parts = [];
    if (invoices.length) {
      const total = invoices.reduce((s, r) => s + r.amountDueCents, 0);
      const overdue = invoices.filter((r) => r.daysOverdue > 0).length;
      parts.push(`${invoices.length} unpaid totalling ${money(total, currency)}${overdue ? ` (${overdue} overdue)` : ''}`);
    }
    if (openQuotes && openQuotes.length) {
      parts.push(`${openQuotes.length} quote${openQuotes.length > 1 ? 's' : ''} still open`);
    }

    // Stamp regardless so we don't re-poll Xero all hour; only message if there's
    // something worth saying.
    await this.supabase.from('users').update({ last_weekly_digest_at: now.toISOString() }).eq('id', user.id).then(() => {}, () => {});
    if (!parts.length) return false;

    let message = `here's your week: ${parts.join(', ')}.`;
    if (invoices.length) message += `\n\nwant me to chase the unpaid ones?`;
    else if (openQuotes && openQuotes.length) message += `\n\nwant me to follow up the open quotes?`;

    await sendToUser(phone, sanitiseReply(message), { channel: 'imessage', supabase: this.supabase });
    return true;
  }
}

module.exports = new WeeklyDigestScheduler();
