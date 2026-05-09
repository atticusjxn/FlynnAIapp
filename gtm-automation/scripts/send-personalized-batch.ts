/**
 * Sends today's queue of Claude-personalised cold emails.
 *
 * Reads from gtm_cold_leads where personalized_body IS NOT NULL AND sent_at IS NULL.
 * Each row already has personalized_subject + personalized_body written by the
 * Claude Code routine. This script just delivers them via Gmail SMTP and logs.
 *
 * Hard cap: PERSONALIZED_DAILY_CAP env (default 20).
 *
 * Run: npm run send:batch:personalized
 * Test: npm run send:batch:personalized -- --test-only
 */

import 'dotenv/config';
import { supabase } from '../lib/gtm-supabase.js';
import * as gmailOAuth from '../lib/gmail.js';
import * as gmailSmtp from '../lib/gmail-smtp.js';

const sender = gmailSmtp.isAppPasswordConfigured() ? gmailSmtp : gmailOAuth;
const sendColdEmail = sender.sendColdEmail;
const countSentLast24h = sender.countSentLast24h;

const DAILY_CAP = Number(process.env.PERSONALIZED_DAILY_CAP ?? process.env.GMAIL_DAILY_CAP ?? 20);
const TEST_ONLY = process.argv.includes('--test-only');

interface QueueRow {
  id: string;
  email: string;
  first_name: string | null;
  company: string | null;
  trade: string | null;
  city: string | null;
  personalized_subject: string;
  personalized_body: string;
}

async function fetchQueue(limit: number): Promise<QueueRow[]> {
  const { data, error } = await supabase
    .from('gtm_cold_leads')
    .select('id, email, first_name, company, trade, city, personalized_subject, personalized_body')
    .is('sent_at', null)
    .eq('replied', false)
    .eq('unsubscribed', false)
    .eq('bounced', false)
    .not('personalized_body', 'is', null)
    .not('personalized_subject', 'is', null)
    .order('scraped_at', { ascending: true })
    .limit(limit);

  if (error) throw new Error(`queue fetch failed: ${error.message}`);
  return (data ?? []) as QueueRow[];
}

async function logSend(args: { leadId: string; subject: string }): Promise<void> {
  const { error } = await supabase.from('gtm_email_outreach').insert({
    lead_id: args.leadId,
    sequence_step: 1,
    subject: args.subject,
    sent_via: 'claude-routine-gmail',
  });
  if (error) console.warn('[send] outreach log failed', error);
}

async function markSent(leadId: string): Promise<void> {
  const { error } = await supabase
    .from('gtm_cold_leads')
    .update({
      sent_at: new Date().toISOString(),
      sequence_step: 1,
      next_send_at: null,
    })
    .eq('id', leadId);
  if (error) console.warn('[send] mark-sent failed', error);
}

async function main() {
  if (TEST_ONLY) {
    const to = process.env.BRIEF_TO_EMAIL || 'atticusjxn@gmail.com';
    console.log(`[send:test] sending sample personalised email to ${to}`);
    const r = await sendColdEmail({
      to,
      subject: 'Test — personalised cold email pipeline',
      bodyText:
        'This is a test of the Claude Code routine personalised email sender.\n\n' +
        'If you received this, Gmail SMTP is wired up correctly.\n\n— Flynn GTM routine',
    });
    console.log(`[send:test] sent: ${r.messageId}`);
    return;
  }

  let alreadySent = 0;
  try {
    alreadySent = await countSentLast24h();
  } catch {}
  const remaining = Math.max(0, DAILY_CAP - alreadySent);
  if (remaining === 0) {
    console.log(`[send] cap reached (${alreadySent}/${DAILY_CAP} in last 24h)`);
    return;
  }

  const queue = await fetchQueue(remaining);
  if (queue.length === 0) {
    console.log('[send] queue empty — routine may not have populated personalized_body yet');
    return;
  }
  console.log(`[send] queue size ${queue.length} · cap remaining ${remaining}`);

  let sent = 0;
  let failed = 0;
  for (const lead of queue) {
    try {
      await sendColdEmail({
        to: lead.email,
        subject: lead.personalized_subject,
        bodyText: lead.personalized_body,
      });
      await logSend({ leadId: lead.id, subject: lead.personalized_subject });
      await markSent(lead.id);
      sent++;
      console.log(`[send] ✅ ${lead.email}  (${lead.company ?? ''})`);

      // Human-paced jitter: 90s–210s between sends.
      const jitterSec = 90 + Math.floor(Math.random() * 120);
      await new Promise((r) => setTimeout(r, jitterSec * 1000));
    } catch (err) {
      failed++;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[send] ❌ ${lead.email}: ${msg}`);
      if (/quota|rateLimit|invalid_grant|550|554/i.test(msg)) {
        console.error('[send] hard error — stopping batch to protect sender rep');
        break;
      }
    }
  }
  console.log(`[send] done. sent=${sent} failed=${failed} cap=${DAILY_CAP}`);
}

main().catch((err) => {
  console.error('[send-personalized-batch] FAILED', err);
  process.exit(1);
});
