/**
 * Assembles today's morning briefing JSONB payload and upserts into
 * public.gtm_morning_briefing. The local morning.html reads from this row
 * via the anon key + an RLS policy that exposes only briefing_date = today.
 *
 * Run after the routine has finished scraping/personalising/sending so the
 * payload reflects the day's full picture.
 *
 * Run: npm run brief:build
 */

import 'dotenv/config';
import { supabase } from '../lib/gtm-supabase.js';
import { getYesterdayEvents } from '../lib/supabase.js';
import { getYesterdayConversions, getRunningTotal } from '../lib/revenuecat.js';

const SYDNEY_TZ = 'Australia/Sydney';
const GOAL_TARGET = Number(process.env.GOAL_PAID_CUSTOMERS ?? 100);
const GOAL_DEADLINE = process.env.GOAL_DEADLINE ?? '2026-08-31';

interface BriefingPayload {
  generated_at: string;
  metrics: {
    trial_starts_yesterday: number;
    trial_starts_breakdown: Record<string, number>;
    paid_yesterday: number;
    revenue_yesterday: number;
    running_total: number;
    goal_target: number;
    days_left: number;
    daily_pace_needed: number;
  };
  stream_a_emails: Array<{
    company: string | null;
    email: string;
    trade: string | null;
    city: string | null;
    subject: string | null;
    review_snippet: string | null;
    status: 'sent' | 'queued' | 'replied' | 'bounced';
    sent_at: string | null;
    replied_at: string | null;
  }>;
  stream_b_ig: Array<{
    id: string;
    handle: string;
    profile_url: string;
    business_name: string | null;
    trade: string | null;
    city: string | null;
    follower_count: number;
    bio: string | null;
    ai_message: string | null;
    status: string;
  }>;
  stream_c_partnerships: Array<{
    id: string;
    org_name: string;
    org_type: string | null;
    contact_name: string | null;
    contact_role: string | null;
    linkedin_url: string | null;
    email: string | null;
    website: string | null;
    pitch_draft: string | null;
    status: string;
  }>;
}

function todayInSydney(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: SYDNEY_TZ });
}

function startOfTodaySydneyIso(): string {
  // Start of today in Sydney expressed as a UTC ISO timestamp.
  const dateStr = todayInSydney();
  // Sydney is UTC+10 (AEST) or UTC+11 (AEDT). Use Intl to compute offset.
  const probe = new Date(`${dateStr}T00:00:00`);
  const sydneyTime = new Date(probe.toLocaleString('en-US', { timeZone: SYDNEY_TZ }));
  const utcTime = new Date(probe.toLocaleString('en-US', { timeZone: 'UTC' }));
  const offsetMs = sydneyTime.getTime() - utcTime.getTime();
  return new Date(probe.getTime() - offsetMs).toISOString();
}

async function buildMetrics(): Promise<BriefingPayload['metrics']> {
  const [yesterdayEvents, yesterdayConversions, runningTotal] = await Promise.all([
    getYesterdayEvents().catch((err) => {
      console.warn('[brief] trial_signups failed', err);
      return [] as Array<{ source: string }>;
    }),
    getYesterdayConversions().catch((err) => {
      console.warn('[brief] revenuecat conversions failed', err);
      return { count: 0, revenue: 0 };
    }),
    getRunningTotal().catch((err) => {
      console.warn('[brief] revenuecat running total failed', err);
      return 0;
    }),
  ]);

  const breakdown: Record<string, number> = {};
  for (const ev of yesterdayEvents) breakdown[ev.source] = (breakdown[ev.source] ?? 0) + 1;

  const deadline = new Date(GOAL_DEADLINE);
  const daysLeft = Math.max(1, Math.ceil((deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
  const remaining = Math.max(0, GOAL_TARGET - runningTotal);

  return {
    trial_starts_yesterday: yesterdayEvents.length,
    trial_starts_breakdown: breakdown,
    paid_yesterday: yesterdayConversions.count,
    revenue_yesterday: yesterdayConversions.revenue,
    running_total: runningTotal,
    goal_target: GOAL_TARGET,
    days_left: daysLeft,
    daily_pace_needed: Math.ceil(remaining / daysLeft),
  };
}

async function buildStreamA(): Promise<BriefingPayload['stream_a_emails']> {
  const since = startOfTodaySydneyIso();
  const { data, error } = await supabase
    .from('gtm_cold_leads')
    .select('email, company, trade, city, personalized_subject, review_snippet, sent_at, replied, replied_at, bounced')
    .or(`sent_at.gte.${since},and(personalized_body.not.is.null,sent_at.is.null)`)
    .order('sent_at', { ascending: false, nullsFirst: false })
    .limit(40);

  if (error) {
    console.warn('[brief] stream A query failed', error);
    return [];
  }

  return (data ?? []).map((r) => {
    let status: 'sent' | 'queued' | 'replied' | 'bounced' = 'queued';
    if (r.replied) status = 'replied';
    else if (r.bounced) status = 'bounced';
    else if (r.sent_at) status = 'sent';
    return {
      company: r.company,
      email: r.email,
      trade: r.trade,
      city: r.city,
      subject: r.personalized_subject ?? null,
      review_snippet: r.review_snippet ?? null,
      status,
      sent_at: r.sent_at ?? null,
      replied_at: r.replied_at ?? null,
    };
  });
}

async function buildStreamB(): Promise<BriefingPayload['stream_b_ig']> {
  const { data, error } = await supabase
    .from('gtm_ig_trade_targets')
    .select('id, handle, profile_url, business_name, trade, city, follower_count, bio, ai_message, status, created_at')
    .eq('status', 'not-contacted')
    .not('ai_message', 'is', null)
    .order('created_at', { ascending: false })
    .limit(15);

  if (error) {
    console.warn('[brief] stream B query failed', error);
    return [];
  }

  return (data ?? []).map((r) => ({
    id: r.id,
    handle: r.handle,
    profile_url: r.profile_url || `https://instagram.com/${r.handle.replace(/^@/, '')}`,
    business_name: r.business_name,
    trade: r.trade,
    city: r.city,
    follower_count: r.follower_count ?? 0,
    bio: r.bio,
    ai_message: r.ai_message,
    status: r.status,
  }));
}

async function buildStreamC(): Promise<BriefingPayload['stream_c_partnerships']> {
  const since = startOfTodaySydneyIso();
  const { data, error } = await supabase
    .from('gtm_partnership_leads')
    .select('id, org_name, org_type, contact_name, contact_role, linkedin_url, email, website, pitch_draft, status, surfaced_at')
    .gte('surfaced_at', since)
    .eq('status', 'new')
    .order('surfaced_at', { ascending: false })
    .limit(10);

  if (error) {
    console.warn('[brief] stream C query failed', error);
    return [];
  }

  return (data ?? []).map((r) => ({
    id: r.id,
    org_name: r.org_name,
    org_type: r.org_type,
    contact_name: r.contact_name,
    contact_role: r.contact_role,
    linkedin_url: r.linkedin_url,
    email: r.email,
    website: r.website,
    pitch_draft: r.pitch_draft,
    status: r.status,
  }));
}

async function main() {
  const [metrics, stream_a_emails, stream_b_ig, stream_c_partnerships] = await Promise.all([
    buildMetrics(),
    buildStreamA(),
    buildStreamB(),
    buildStreamC(),
  ]);

  const payload: BriefingPayload = {
    generated_at: new Date().toISOString(),
    metrics,
    stream_a_emails,
    stream_b_ig,
    stream_c_partnerships,
  };

  console.log('[brief] payload summary', {
    emails: stream_a_emails.length,
    ig: stream_b_ig.length,
    partnerships: stream_c_partnerships.length,
    running_total: metrics.running_total,
  });

  const date = todayInSydney();
  const { error } = await supabase
    .from('gtm_morning_briefing')
    .upsert({ briefing_date: date, payload, generated_at: new Date().toISOString() }, { onConflict: 'briefing_date' });

  if (error) {
    console.error('[brief] upsert failed', error);
    process.exit(1);
  }
  console.log(`[brief] ✅ wrote gtm_morning_briefing for ${date}`);
}

main().catch((err) => {
  console.error('[brief] FAILED', err);
  process.exit(1);
});
