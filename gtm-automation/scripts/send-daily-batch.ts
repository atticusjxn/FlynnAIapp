/**
 * Daily cold-email batch — sends today's queue via Gmail API.
 *
 * Pulls leads from gtm_cold_leads where:
 *   - sequence_step ∈ {0,1,2,3} (we have 4 templates; step 0 = needs intro, step 3 = breakup next)
 *   - next_send_at <= now (or null for step 0 leads scraped fresh)
 *   - replied = false, unsubscribed = false, bounced = false
 *
 * For each lead:
 *   - Render the right template with {{firstName}}, {{trade}}, {{city}} substitutions
 *   - Pick subject line by day-of-month % 3 (rotates A/B/C)
 *   - Send via lib/gmail.ts
 *   - Insert row into gtm_email_outreach
 *   - Update gtm_cold_leads (sequence_step++, sent_at=now, next_send_at = now+SEQUENCE_GAPS[step])
 *
 * Hard cap: GMAIL_DAILY_CAP env (default 30). Stops on Gmail quota errors.
 *
 * Run: npm run send:batch
 * Test single: npm run send:test (sends one to atticusjxn@gmail.com using test lead)
 */

import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { supabase } from '../lib/gtm-supabase.js';
import * as gmailOAuth from '../lib/gmail.js';
import * as gmailSmtp from '../lib/gmail-smtp.js';

// Choose sender: App Password takes precedence (simpler setup) over OAuth.
const sender = gmailSmtp.isAppPasswordConfigured() ? gmailSmtp : gmailOAuth;
const sendColdEmail = sender.sendColdEmail;
const countSentLast24h = sender.countSentLast24h;

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATE_DIR = resolve(__dirname, '../templates/cold-email');
const TEMPLATE_FILES = [
  '01-day1-intro.md',
  '02-day3-social-proof.md',
  '03-day7-urgency.md',
  '04-day10-breakup.md',
] as const;
// Days between sequence steps. Index = current sequence_step (about to send).
// e.g. after sending step 1 (intro), wait 2 days for step 2 (social proof).
const SEQUENCE_GAPS_DAYS = [2, 4, 3, 0] as const;

const DAILY_CAP = Number(process.env.GMAIL_DAILY_CAP ?? 30);
const TEST_ONLY = process.argv.includes('--test-only');

interface Lead {
  id: string;
  email: string;
  first_name: string | null;
  company: string | null;
  trade: string | null;
  city: string | null;
  sequence_step: number;
}

interface Template {
  subjects: string[];
  body: string;
}

function loadTemplate(file: string): Template {
  const md = readFileSync(resolve(TEMPLATE_DIR, file), 'utf8');

  // Subject lines: lines under "## Subject lines" that look like "1. `text`"
  const subjects: string[] = [];
  const subjMatch = md.match(/##\s*Subject lines.*?\n([\s\S]*?)(?=\n##\s)/);
  if (subjMatch) {
    for (const line of subjMatch[1]!.split('\n')) {
      const m = line.match(/^\s*\d+\.\s*`(.+)`/);
      if (m) subjects.push(m[1]!);
    }
  }

  // Body: contents of the first ``` block under "## Body"
  const bodyMatch = md.match(/##\s*Body[\s\S]*?```\n([\s\S]*?)\n```/);
  const body = bodyMatch ? bodyMatch[1]! : '';

  if (subjects.length === 0 || !body) {
    throw new Error(`Template ${file} missing subjects or body`);
  }
  return { subjects, body };
}

function substitute(template: string, lead: Lead): string {
  return template
    .replace(/\{\{firstName\}\}/g, lead.first_name || 'mate')
    .replace(/\{\{company\}\}/g, lead.company || 'your business')
    .replace(/\{\{trade\}\}/g, lead.trade || 'tradie')
    .replace(/\{\{city\}\}/g, lead.city || 'your area');
}

async function fetchTodaysQueue(limit: number): Promise<Lead[]> {
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from('gtm_cold_leads')
    .select('id, email, first_name, company, trade, city, sequence_step')
    .eq('replied', false)
    .eq('unsubscribed', false)
    .eq('bounced', false)
    .lt('sequence_step', TEMPLATE_FILES.length)
    .or(`next_send_at.lte.${nowIso},next_send_at.is.null`)
    // Step-0 leads (fresh scrapes) sorted by oldest first;
    // follow-ups sorted by next_send_at oldest first.
    .order('sequence_step', { ascending: true })
    .order('next_send_at', { ascending: true, nullsFirst: true })
    .limit(limit);

  if (error) {
    throw new Error(`gtm_cold_leads fetch failed: ${error.message}`);
  }
  return (data ?? []) as Lead[];
}

async function logSend(args: {
  leadId: string;
  step: number;
  subject: string;
}): Promise<void> {
  const { error } = await supabase.from('gtm_email_outreach').insert({
    lead_id: args.leadId,
    sequence_step: args.step,
    subject: args.subject,
    sent_via: 'manual-gmail',
  });
  if (error) console.warn('[send] outreach log insert failed', error);
}

async function advanceLead(leadId: string, newStep: number): Promise<void> {
  const gapDays = SEQUENCE_GAPS_DAYS[newStep - 1] ?? 0;
  const nextSendAt =
    gapDays > 0 ? new Date(Date.now() + gapDays * 24 * 60 * 60 * 1000).toISOString() : null;

  const { error } = await supabase
    .from('gtm_cold_leads')
    .update({
      sequence_step: newStep,
      sent_at: new Date().toISOString(),
      next_send_at: nextSendAt,
    })
    .eq('id', leadId);
  if (error) console.warn('[send] lead advance failed', error);
}

async function main() {
  const templates = TEMPLATE_FILES.map(loadTemplate);
  const dayIndex = new Date().getDate() % 3; // rotate subject A/B/C across days

  if (TEST_ONLY) {
    const testLead: Lead = {
      id: 'test',
      email: process.env.BRIEF_TO_EMAIL || 'atticusjxn@gmail.com',
      first_name: 'Atticus',
      company: 'Test Co',
      trade: 'plumber',
      city: 'Sydney',
      sequence_step: 0,
    };
    const tpl = templates[0]!;
    const subject = substitute(tpl.subjects[dayIndex] ?? tpl.subjects[0]!, testLead);
    const body = substitute(tpl.body, testLead);
    console.log(`[send:test] sending to ${testLead.email}…`);
    const r = await sendColdEmail({ to: testLead.email, subject, bodyText: body });
    console.log(`[send:test] sent: ${r.messageId}`);
    return;
  }

  // Defensive: don't blow past abuse thresholds even if the queue is huge.
  let alreadySent: number;
  try {
    alreadySent = await countSentLast24h();
  } catch (e) {
    console.warn('[send] could not check 24h sent count, defaulting to 0', e);
    alreadySent = 0;
  }
  const remaining = Math.max(0, DAILY_CAP - alreadySent);
  if (remaining === 0) {
    console.log(`[send] cap reached (${alreadySent}/${DAILY_CAP} sent in last 24h)`);
    return;
  }

  const queue = await fetchTodaysQueue(remaining);
  if (queue.length === 0) {
    console.log('[send] queue empty');
    return;
  }
  console.log(`[send] queue size ${queue.length}, cap remaining ${remaining}`);

  let sent = 0;
  let failed = 0;
  for (const lead of queue) {
    const tpl = templates[lead.sequence_step];
    if (!tpl) {
      console.warn(`[send] no template for step ${lead.sequence_step} on ${lead.email}`);
      continue;
    }
    const subject = substitute(tpl.subjects[dayIndex] ?? tpl.subjects[0]!, lead);
    const body = substitute(tpl.body, lead);

    try {
      await sendColdEmail({ to: lead.email, subject, bodyText: body });
      await logSend({ leadId: lead.id, step: lead.sequence_step + 1, subject });
      await advanceLead(lead.id, lead.sequence_step + 1);
      sent++;
      console.log(`[send] ✅ ${lead.email} (step ${lead.sequence_step + 1})`);

      // 2-4 minutes between sends so it looks like a human typed them.
      const jitterSec = 120 + Math.floor(Math.random() * 120);
      await new Promise((r) => setTimeout(r, jitterSec * 1000));
    } catch (err) {
      failed++;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[send] ❌ ${lead.email}: ${msg}`);
      // Stop hard on quota / auth errors — we don't want to keep retrying and burn rep.
      if (msg.includes('quota') || msg.includes('rateLimit') || msg.includes('invalid_grant')) {
        console.error('[send] hard error, stopping batch');
        break;
      }
    }
  }

  console.log(`[send] done. sent=${sent} failed=${failed} cap=${DAILY_CAP}`);
}

main().catch((err) => {
  console.error('[send-daily-batch] FAILED', err);
  process.exit(1);
});
