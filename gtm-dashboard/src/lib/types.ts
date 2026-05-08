// Shape mirrors columns in supabase/migrations/20260508000000_gtm_ops_tables.sql.

export interface FBGroup {
  id: string;
  name: string;
  url: string;
  member_count: number | null;
  industry: 'trades' | 'beauty' | 'hospitality' | 'health' | 'general' | null;
  region: string | null;
  joined: boolean;
  status: 'active' | 'banned' | 'restricted' | 'pending-approval';
  last_posted_at: string | null;
  last_post_type: 'VALUE_QUESTION' | 'CASE_STUDY' | 'GENUINE_HELP' | null;
  notes: string | null;
}

export interface IGTarget {
  id: string;
  handle: string;
  profile_url: string | null;
  follower_count: number | null;
  industry: 'trades' | 'beauty' | 'hospitality' | 'health' | 'general' | null;
  persona: 'tradie-influencer' | 'business-owner' | 'industry-page' | 'educator' | null;
  region: string | null;
  email: string | null;
  status:
    | 'not-contacted'
    | 'dm-sent'
    | 'replied'
    | 'partnership-active'
    | 'declined';
  last_dm_at: string | null;
  last_dm_script: 'REV_SHARE' | 'FREE_MONTH' | 'FEEDBACK' | null;
  reply_at: string | null;
  notes: string | null;
}

export interface ColdLead {
  id: string;
  email: string;
  first_name: string | null;
  company: string | null;
  phone: string | null;
  city: string | null;
  trade: string | null;
  source: string | null;
  scraped_at: string;
  sent_at: string | null;
  sequence_step: number;
  next_send_at: string | null;
  replied: boolean;
  replied_at: string | null;
  unsubscribed: boolean;
  bounced: boolean;
  notes: string | null;
}

export interface DailyLog {
  log_date: string;
  trial_starts: number;
  trial_starts_breakdown: Record<string, number>;
  paid_conversions: number;
  revenue_added: number;
  running_total: number;
  cac_blended: number | null;
  cold_emails_sent: number;
  cold_email_replies: number;
  ig_dms_sent: number;
  ig_dm_replies: number;
  fb_posts_made: number;
}

export type IGScript = 'REV_SHARE' | 'FREE_MONTH' | 'FEEDBACK';
export type FBPostType = 'VALUE_QUESTION' | 'CASE_STUDY' | 'GENUINE_HELP';
