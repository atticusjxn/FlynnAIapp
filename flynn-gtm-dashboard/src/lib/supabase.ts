import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY env vars');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

// ---------- Goal config (could move to a settings table later) ----------
export const GOAL_TOTAL = 100;
export const GOAL_START_DATE = new Date('2026-05-08');
export const GOAL_DEADLINE = new Date('2026-06-30');

// ---------- Types ----------
export interface FBGroupRow {
  id: string;
  name: string;
  url: string;
  member_count: number;
  industry: string;
  joined: boolean;
  status: string;
  last_posted_at: string | null;
  last_post_type: string | null;
}

export interface IGTargetRow {
  id: string;
  handle: string;
  profile_url: string | null;
  follower_count: number;
  industry: string;
  region: string;
  status: string;
  last_dm_at: string | null;
  last_dm_script: string | null;
  reply_at: string | null;
}

export interface ColdLeadRow {
  id: string;
  email: string;
  first_name: string | null;
  company: string | null;
  phone: string | null;
  city: string | null;
  trade: string | null;
  scraped_at: string;
  sent_at: string | null;
  sequence_step: number;
  next_send_at: string | null;
  replied: boolean;
  replied_at: string | null;
  unsubscribed: boolean;
  bounced: boolean;
}

export interface DailyLogRow {
  log_date: string;
  trial_starts: number;
  trial_starts_breakdown: Record<string, number>;
  paid_conversions: number;
  revenue_added: number;
  running_total: number;
  cac_blended: number | null;
  cold_emails_sent: number;
  cold_email_replies: number;
}

// ---------- Queries ----------

export async function fetchTodaysFBGroups(limit = 5): Promise<FBGroupRow[]> {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('gtm_fb_groups')
    .select('*')
    .eq('joined', true)
    .eq('status', 'active')
    .or(`last_posted_at.is.null,last_posted_at.lt.${cutoff}`)
    .order('last_posted_at', { ascending: true, nullsFirst: true })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function fetchTodaysIGTargets(limit = 18): Promise<IGTargetRow[]> {
  const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('gtm_ig_targets')
    .select('*')
    .or(`status.eq.not-contacted,and(status.eq.dm-sent,last_dm_at.lt.${fiveDaysAgo},reply_at.is.null)`)
    .limit(limit * 2);
  if (error) throw error;
  // Industry mix
  const trades = (data ?? []).filter((r) => r.industry === 'trades');
  const beauty = (data ?? []).filter((r) => r.industry === 'beauty');
  const other = (data ?? []).filter((r) => r.industry !== 'trades' && r.industry !== 'beauty');
  const mixed = [
    ...trades.slice(0, Math.round(limit * 0.6)),
    ...beauty.slice(0, Math.round(limit * 0.25)),
    ...other.slice(0, limit - Math.round(limit * 0.6) - Math.round(limit * 0.25)),
  ];
  return mixed;
}

export async function fetchTodaysColdLeads(limit = 30): Promise<ColdLeadRow[]> {
  const { data, error } = await supabase
    .from('gtm_cold_leads')
    .select('*')
    .is('sent_at', null)
    .eq('unsubscribed', false)
    .eq('bounced', false)
    .order('scraped_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function fetchPipelineStats(): Promise<{
  total: number;
  notSent: number;
  inSequence: number;
  hotReplies: number;
  bounced: number;
}> {
  const [{ count: total }, { count: notSent }, { count: inSequence }, { count: hotReplies }, { count: bounced }] =
    await Promise.all([
      supabase.from('gtm_cold_leads').select('id', { count: 'exact', head: true }),
      supabase.from('gtm_cold_leads').select('id', { count: 'exact', head: true }).is('sent_at', null),
      supabase
        .from('gtm_cold_leads')
        .select('id', { count: 'exact', head: true })
        .gt('sequence_step', 0)
        .eq('replied', false)
        .eq('unsubscribed', false)
        .eq('bounced', false),
      supabase.from('gtm_cold_leads').select('id', { count: 'exact', head: true }).eq('replied', true),
      supabase.from('gtm_cold_leads').select('id', { count: 'exact', head: true }).eq('bounced', true),
    ]);
  return {
    total: total ?? 0,
    notSent: notSent ?? 0,
    inSequence: inSequence ?? 0,
    hotReplies: hotReplies ?? 0,
    bounced: bounced ?? 0,
  };
}

export async function fetchRecentDailyLogs(days = 14): Promise<DailyLogRow[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('gtm_daily_log')
    .select('*')
    .gte('log_date', since)
    .order('log_date', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

// ---------- Mutations ----------

export async function markFBGroupPosted(id: string, postType: string) {
  const { error } = await supabase
    .from('gtm_fb_groups')
    .update({ last_posted_at: new Date().toISOString(), last_post_type: postType })
    .eq('id', id);
  if (error) throw error;
}

export async function markIGDMSent(id: string, script: string) {
  const { error } = await supabase
    .from('gtm_ig_targets')
    .update({ status: 'dm-sent', last_dm_at: new Date().toISOString(), last_dm_script: script })
    .eq('id', id);
  if (error) throw error;
}

export async function markColdEmailSent(leadId: string, sequenceStep: number, subject: string) {
  const now = new Date().toISOString();
  const [{ error: e1 }, { error: e2 }] = await Promise.all([
    supabase
      .from('gtm_cold_leads')
      .update({ sent_at: now, sequence_step: sequenceStep })
      .eq('id', leadId),
    supabase.from('gtm_email_outreach').insert({
      lead_id: leadId,
      sequence_step: sequenceStep,
      subject,
      sent_via: 'manual-gmail',
    }),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;
}
