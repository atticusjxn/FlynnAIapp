-- GTM Ops tables — replaces Airtable for daily morning brief + dashboard.
-- All tables are restricted to the founder's user (RLS) since this is internal ops data.

-- 1. Facebook trade groups we engage in
CREATE TABLE IF NOT EXISTS public.gtm_fb_groups (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    url             TEXT NOT NULL,
    member_count    INTEGER DEFAULT 0,
    industry        TEXT CHECK (industry IN ('trades','beauty','hospitality','health','general')),
    region          TEXT DEFAULT 'AU',
    joined          BOOLEAN DEFAULT FALSE,
    status          TEXT DEFAULT 'active' CHECK (status IN ('active','banned','restricted','pending-approval')),
    last_posted_at  TIMESTAMPTZ,
    last_post_type  TEXT CHECK (last_post_type IN ('VALUE_QUESTION','CASE_STUDY','GENUINE_HELP')),
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gtm_fb_groups_surface
    ON public.gtm_fb_groups (joined, status, last_posted_at);

-- 2. Instagram accounts to DM
CREATE TABLE IF NOT EXISTS public.gtm_ig_targets (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    handle            TEXT UNIQUE NOT NULL,
    profile_url       TEXT,
    follower_count    INTEGER DEFAULT 0,
    industry          TEXT CHECK (industry IN ('trades','beauty','hospitality','health','general')),
    persona           TEXT CHECK (persona IN ('tradie-influencer','business-owner','industry-page','educator')),
    region            TEXT DEFAULT 'AU',
    email             TEXT,
    status            TEXT DEFAULT 'not-contacted'
                      CHECK (status IN ('not-contacted','dm-sent','replied','partnership-active','declined')),
    last_dm_at        TIMESTAMPTZ,
    last_dm_script    TEXT CHECK (last_dm_script IN ('REV_SHARE','FREE_MONTH','FEEDBACK')),
    reply_at          TIMESTAMPTZ,
    notes             TEXT,
    created_at        TIMESTAMPTZ DEFAULT now(),
    updated_at        TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gtm_ig_targets_surface
    ON public.gtm_ig_targets (status, last_dm_at, reply_at);

-- 3. Daily metrics log
CREATE TABLE IF NOT EXISTS public.gtm_daily_log (
    log_date                  DATE PRIMARY KEY,
    trial_starts              INTEGER DEFAULT 0,
    trial_starts_breakdown    JSONB DEFAULT '{}'::jsonb,
    paid_conversions          INTEGER DEFAULT 0,
    revenue_added             NUMERIC(10,2) DEFAULT 0,
    running_total             INTEGER DEFAULT 0,
    cac_blended               NUMERIC(10,2),
    cold_emails_sent          INTEGER DEFAULT 0,
    cold_email_replies        INTEGER DEFAULT 0,
    ig_dms_sent               INTEGER DEFAULT 0,
    ig_dm_replies             INTEGER DEFAULT 0,
    fb_posts_made             INTEGER DEFAULT 0,
    notes                     TEXT,
    created_at                TIMESTAMPTZ DEFAULT now()
);

-- 4. Cold-lead pipeline (replaces Instantly leads table)
CREATE TABLE IF NOT EXISTS public.gtm_cold_leads (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           TEXT UNIQUE NOT NULL,
    first_name      TEXT,
    company         TEXT,
    phone           TEXT,
    city            TEXT,
    trade           TEXT,
    source          TEXT DEFAULT 'puppeteer-google-maps',
    scraped_at      TIMESTAMPTZ DEFAULT now(),
    sent_at         TIMESTAMPTZ,
    sequence_step   INTEGER DEFAULT 0,            -- 0 = not sent, 1-4 = which email in sequence
    next_send_at    TIMESTAMPTZ,
    replied         BOOLEAN DEFAULT FALSE,
    replied_at      TIMESTAMPTZ,
    unsubscribed    BOOLEAN DEFAULT FALSE,
    bounced         BOOLEAN DEFAULT FALSE,
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gtm_cold_leads_pipeline
    ON public.gtm_cold_leads (sequence_step, next_send_at)
    WHERE NOT replied AND NOT unsubscribed AND NOT bounced;

-- 5. Sent-email log (for dashboard "today sent" stats + reply tracking)
CREATE TABLE IF NOT EXISTS public.gtm_email_outreach (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id         UUID REFERENCES public.gtm_cold_leads(id) ON DELETE CASCADE,
    sequence_step   INTEGER NOT NULL,
    subject         TEXT,
    sent_at         TIMESTAMPTZ DEFAULT now(),
    sent_via        TEXT DEFAULT 'manual-gmail' CHECK (sent_via IN ('manual-gmail','resend','smartlead','instantly')),
    opened          BOOLEAN DEFAULT FALSE,
    clicked         BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_gtm_email_outreach_sent_at
    ON public.gtm_email_outreach (sent_at DESC);

-- 6. Updated-at triggers
CREATE OR REPLACE FUNCTION public.gtm_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS gtm_fb_groups_updated_at ON public.gtm_fb_groups;
CREATE TRIGGER gtm_fb_groups_updated_at
    BEFORE UPDATE ON public.gtm_fb_groups
    FOR EACH ROW EXECUTE FUNCTION public.gtm_set_updated_at();

DROP TRIGGER IF EXISTS gtm_ig_targets_updated_at ON public.gtm_ig_targets;
CREATE TRIGGER gtm_ig_targets_updated_at
    BEFORE UPDATE ON public.gtm_ig_targets
    FOR EACH ROW EXECUTE FUNCTION public.gtm_set_updated_at();

-- 7. RLS — restrict to founder only
-- We identify the founder by their auth.uid() matching a single allowed UUID.
-- Using GUC: app.founder_uid (set via Supabase project setting), with fallback to atticusjxn@gmail.com.
ALTER TABLE public.gtm_fb_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gtm_ig_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gtm_daily_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gtm_cold_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gtm_email_outreach ENABLE ROW LEVEL SECURITY;

-- Helper: is this the founder?
CREATE OR REPLACE FUNCTION public.is_gtm_founder()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    user_email TEXT;
BEGIN
    -- service_role bypasses RLS automatically, so this only matters for anon/authed
    SELECT email INTO user_email FROM auth.users WHERE id = auth.uid() LIMIT 1;
    RETURN user_email = 'atticusjxn@gmail.com';
END;
$$;

-- One policy per table: founder full access, no one else
CREATE POLICY "founder full access" ON public.gtm_fb_groups
    FOR ALL TO authenticated
    USING (public.is_gtm_founder())
    WITH CHECK (public.is_gtm_founder());

CREATE POLICY "founder full access" ON public.gtm_ig_targets
    FOR ALL TO authenticated
    USING (public.is_gtm_founder())
    WITH CHECK (public.is_gtm_founder());

CREATE POLICY "founder full access" ON public.gtm_daily_log
    FOR ALL TO authenticated
    USING (public.is_gtm_founder())
    WITH CHECK (public.is_gtm_founder());

CREATE POLICY "founder full access" ON public.gtm_cold_leads
    FOR ALL TO authenticated
    USING (public.is_gtm_founder())
    WITH CHECK (public.is_gtm_founder());

CREATE POLICY "founder full access" ON public.gtm_email_outreach
    FOR ALL TO authenticated
    USING (public.is_gtm_founder())
    WITH CHECK (public.is_gtm_founder());
