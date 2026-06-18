// services/groupAgent/digestScheduler.js
//
// Two jobs, both driven off the existing 60s cron in server.js (internally
// throttled so it doesn't hammer Supabase every tick):
//
//   1. Batch sweep — extract action items from groups that have accumulated
//      un-swept messages (the routine path; the live fast-path in groupRouter
//      handles urgent items in real time).
//   2. Digest — once a day at the owner's configured hour, DM the boss a single
//      summary of the routine items Flynn picked up, so a busy 20-person chat
//      never floods them. Items stay queued (status 'sent') so the boss's next
//      1:1 reply can action them via the injected-prompt path.

const { createClient } = require('@supabase/supabase-js');
const { sendToUser } = require('../flynnOutbound');
const { sanitiseReply } = require('../flynnTone');
const registry = require('../agent/toolRegistry');
const { extractAndStore } = require('./noteTaker');

const MINUTE = 60 * 1000;
const SWEEP_INTERVAL_MS = 3 * MINUTE;         // throttle the whole tick
const BATCH_COUNT = 6;                         // extract once this many messages pile up
const BATCH_AGE_MS = 20 * MINUTE;              // ...or once the oldest unswept is this old
const DIGEST_COOLDOWN_MS = 20 * 60 * MINUTE;   // ~20h — one digest per day per group

class GroupDigestScheduler {
  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_KEY ||
      process.env.SUPABASE_SECRET;
    if (!supabaseUrl || !supabaseKey) {
      console.warn('[GroupDigest] Supabase credentials not configured, service disabled');
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
    return Number(new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hour12: false }).format(now));
  }

  async processTick() {
    if (!this.supabase) return { extracted: 0, digests: 0 };
    const now = Date.now();
    if (now - this._lastSweep < SWEEP_INTERVAL_MS) return { skipped: 'throttled' };
    this._lastSweep = now;

    const { data: groups, error } = await this.supabase
      .from('group_chats')
      .select('*')
      .eq('status', 'active')
      .not('owner_phone', 'is', null)
      .limit(200);
    if (error) {
      console.error('[GroupDigest] group query failed:', error.message);
      return { extracted: 0, digests: 0 };
    }

    let extracted = 0;
    let digests = 0;
    for (const group of groups || []) {
      try {
        extracted += await this.sweepGroup(group);
        if (await this.maybeDigest(group, new Date(now))) digests++;
      } catch (err) {
        console.error('[GroupDigest] failed for', group.chat_guid, err?.message || err);
      }
    }
    if (extracted || digests) console.log(`[GroupDigest] sweep: ${extracted} extraction(s), ${digests} digest(s)`);
    return { extracted, digests };
  }

  // Run the note-taker over a group's un-swept messages when enough have piled up.
  async sweepGroup(group) {
    const { data: rows } = await this.supabase
      .from('group_messages')
      .select('id, sender_name, sender_phone, body, created_at')
      .eq('chat_guid', group.chat_guid)
      .eq('extracted', false)
      .order('created_at', { ascending: true })
      .limit(50);
    if (!rows || !rows.length) return 0;

    const oldestMs = new Date(rows[0].created_at).getTime();
    const ready = rows.length >= BATCH_COUNT || (Date.now() - oldestMs) >= BATCH_AGE_MS;
    if (!ready) return 0;

    await extractAndStore({ chat: group, rows, supabase: this.supabase, markExtracted: true });
    return 1;
  }

  // Once a day, at the owner's digest hour, DM the routine items.
  async maybeDigest(group, now) {
    const digestHour = Number(group.settings?.digest_hour ?? 17);
    if (this.hourInTz(now, group.owner_phone) !== digestHour) return false;
    if (group.last_digest_at && (now.getTime() - new Date(group.last_digest_at).getTime()) < DIGEST_COOLDOWN_MS) return false;

    const { data: items } = await this.supabase
      .from('group_action_items')
      .select('id, summary')
      .eq('chat_guid', group.chat_guid)
      .eq('owner_phone', group.owner_phone)
      .eq('status', 'new')
      .eq('urgency', 'routine')
      .order('created_at', { ascending: true })
      .limit(12);
    if (!items || !items.length) {
      // Nothing to send, but stamp so we don't re-check every tick this hour.
      await this.supabase.from('group_chats').update({ last_digest_at: now.toISOString() }).eq('chat_guid', group.chat_guid);
      return false;
    }

    const groupLabel = group.name ? ` in ${group.name}` : '';
    const lines = items.map((it, i) => `${i + 1}. ${it.summary}`).join('\n');
    const message = sanitiseReply(
      `here's what i picked up${groupLabel} today:\n\n${lines}\n\nwant me to action any? just tell me which.`
    );

    await sendToUser(group.owner_phone, message, { channel: 'imessage', supabase: this.supabase });
    await this.supabase
      .from('group_action_items')
      .update({ status: 'sent', updated_at: now.toISOString() })
      .in('id', items.map((i) => i.id));
    await this.supabase.from('group_chats').update({ last_digest_at: now.toISOString() }).eq('chat_guid', group.chat_guid);
    return true;
  }
}

module.exports = new GroupDigestScheduler();
