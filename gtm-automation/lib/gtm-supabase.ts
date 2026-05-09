/**
 * Supabase-backed replacement for the Airtable lib.
 * Same interface — surfaces today's FB groups + IG targets, writes daily log.
 *
 * Backed by tables:
 *   - public.gtm_fb_groups
 *   - public.gtm_ig_targets
 *   - public.gtm_daily_log
 *   - public.gtm_cold_leads        (separate, used by scraper + email sender)
 *   - public.gtm_email_outreach    (separate, used by send tracker)
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = required('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = required('SUPABASE_SERVICE_ROLE_KEY');

export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ---------- Types ----------
export interface FBGroup {
  id: string;
  name: string;
  url: string;
  memberCount: number;
  lastPostedAt: string | null;
  suggestedPostType: 'VALUE_QUESTION' | 'CASE_STUDY' | 'GENUINE_HELP';
}

export interface IGTarget {
  id: string;
  handle: string;
  profileUrl: string;
  followerCount: number;
  industry: string;
  region: string;
  suggestedScript: 'REV_SHARE' | 'FREE_MONTH' | 'FEEDBACK';
}

export interface TradeIGTarget {
  id: string;
  handle: string;
  profileUrl: string;
  businessName: string;
  trade: string;
  city: string;
  followerCount: number;
  bio: string;
  aiMessage: string;
}

// ---------- Surface today's FB groups ----------
export async function surfaceTodaysFBGroups({
  count,
  daysSinceLastPost,
}: { count: number; daysSinceLastPost: number }): Promise<FBGroup[]> {
  const cutoff = new Date(Date.now() - daysSinceLastPost * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('gtm_fb_groups')
    .select('id, name, url, member_count, last_posted_at, last_post_type')
    .eq('joined', true)
    .eq('status', 'active')
    .or(`last_posted_at.is.null,last_posted_at.lt.${cutoff}`)
    .order('last_posted_at', { ascending: true, nullsFirst: true })
    .limit(count);

  if (error) {
    console.error('[gtm-supabase] FB groups query failed', error);
    return [];
  }

  return (data ?? []).map((r, idx) => ({
    id: r.id,
    name: r.name,
    url: r.url,
    memberCount: r.member_count ?? 0,
    lastPostedAt: r.last_posted_at,
    suggestedPostType: rotatePostType(r.last_post_type, idx),
  }));
}

function rotatePostType(last: string | null, idx: number): FBGroup['suggestedPostType'] {
  const types: FBGroup['suggestedPostType'][] = ['VALUE_QUESTION', 'CASE_STUDY', 'GENUINE_HELP'];
  const filtered = types.filter((t) => t !== last);
  return filtered[idx % filtered.length] ?? types[idx % types.length];
}

// ---------- Surface today's IG targets ----------
export async function surfaceTodaysIGTargets({ count }: { count: number }): Promise<IGTarget[]> {
  const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('gtm_ig_targets')
    .select('id, handle, profile_url, follower_count, industry, region')
    .or(`status.eq.not-contacted,and(status.eq.dm-sent,last_dm_at.lt.${fiveDaysAgo},reply_at.is.null)`)
    .limit(count * 2);

  if (error) {
    console.error('[gtm-supabase] IG targets query failed', error);
    return [];
  }

  // Mix industries: 60% trades, 25% beauty, 15% other
  const trades = (data ?? []).filter((r) => r.industry === 'trades');
  const beauty = (data ?? []).filter((r) => r.industry === 'beauty');
  const other = (data ?? []).filter((r) => r.industry !== 'trades' && r.industry !== 'beauty');

  const tradesCount = Math.round(count * 0.6);
  const beautyCount = Math.round(count * 0.25);
  const otherCount = count - tradesCount - beautyCount;

  const mixed = [
    ...trades.slice(0, tradesCount),
    ...beauty.slice(0, beautyCount),
    ...other.slice(0, otherCount),
  ];

  return mixed.map((r, idx) => ({
    id: r.id,
    handle: r.handle,
    profileUrl: r.profile_url || `https://instagram.com/${r.handle.replace('@', '')}`,
    followerCount: r.follower_count ?? 0,
    industry: r.industry ?? 'other',
    region: r.region ?? 'AU',
    suggestedScript: rotateScript(idx),
  }));
}

function rotateScript(idx: number): IGTarget['suggestedScript'] {
  const m = idx % 10;
  if (m < 5) return 'REV_SHARE';
  if (m < 8) return 'FREE_MONTH';
  return 'FEEDBACK';
}

// ---------- Surface today's Trade IG targets (cold sales DMs) ----------
export async function surfaceTodaysTradeIGTargets({ count }: { count: number }): Promise<TradeIGTarget[]> {
  const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('gtm_ig_trade_targets')
    .select('id, handle, profile_url, business_name, trade, city, follower_count, bio, ai_message')
    .or(`status.eq.not-contacted,and(status.eq.dm-sent,last_dm_at.lt.${fiveDaysAgo},reply_at.is.null)`)
    .not('ai_message', 'is', null)
    .order('created_at', { ascending: false })
    .limit(count);

  if (error) {
    console.error('[gtm-supabase] trade IG targets query failed', error);
    return [];
  }

  return (data ?? []).map((r) => ({
    id: r.id,
    handle: r.handle,
    profileUrl: r.profile_url || `https://instagram.com/${r.handle.replace(/^@/, '')}`,
    businessName: r.business_name ?? '',
    trade: r.trade ?? '',
    city: r.city ?? '',
    followerCount: r.follower_count ?? 0,
    bio: r.bio ?? '',
    aiMessage: r.ai_message ?? '',
  }));
}

// ---------- Write daily log ----------
export async function writeDailyLog(entry: {
  date: Date;
  trialStarts: number;
  trialStartsBreakdown: Record<string, number>;
  paidConversions: number;
  revenueAdded: number;
  runningTotal: number;
  coldEmailsSent: number;
  coldEmailReplies: number;
}): Promise<void> {
  const dateStr = entry.date.toISOString().slice(0, 10);
  const { error } = await supabase
    .from('gtm_daily_log')
    .upsert(
      {
        log_date: dateStr,
        trial_starts: entry.trialStarts,
        trial_starts_breakdown: entry.trialStartsBreakdown,
        paid_conversions: entry.paidConversions,
        revenue_added: entry.revenueAdded,
        running_total: entry.runningTotal,
        cold_emails_sent: entry.coldEmailsSent,
        cold_email_replies: entry.coldEmailReplies,
      },
      { onConflict: 'log_date' },
    );

  if (error) console.error('[gtm-supabase] daily log write failed', error);
}

// ---------- Stats helpers (used by dashboard + brief) ----------
export interface ColdEmailStats {
  sentLast24h: number;
  repliesLast24h: number;
  bounceRateLast7d: number;
  hotReplies: number;
  warmupBuffer: number; // not applicable for manual sends — always 0
  campaignName: string;
}

export async function getColdEmailStats(): Promise<ColdEmailStats> {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [{ count: sent24h }, { count: replies24h }, { data: last7dLeads }] = await Promise.all([
    supabase
      .from('gtm_email_outreach')
      .select('id', { count: 'exact', head: true })
      .gte('sent_at', oneDayAgo),
    supabase
      .from('gtm_cold_leads')
      .select('id', { count: 'exact', head: true })
      .gte('replied_at', oneDayAgo),
    supabase
      .from('gtm_cold_leads')
      .select('bounced')
      .gte('sent_at', sevenDaysAgo)
      .not('sent_at', 'is', null),
  ]);

  const totalLast7d = last7dLeads?.length ?? 0;
  const bouncedLast7d = (last7dLeads ?? []).filter((r) => r.bounced).length;

  return {
    sentLast24h: sent24h ?? 0,
    repliesLast24h: replies24h ?? 0,
    bounceRateLast7d: totalLast7d > 0 ? bouncedLast7d / totalLast7d : 0,
    hotReplies: replies24h ?? 0,
    warmupBuffer: 0,
    campaignName: 'Flynn (Resend manual)',
  };
}

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}
