-- GTM Trade IG outreach — cold-DM trade businesses on Instagram with AI-rendered messages.
-- Separate from gtm_ig_targets (which is for influencer/partnership pitches).

-- 1. Trade-business IG targets, populated by scripts/scrape-ig-trades.ts
CREATE TABLE IF NOT EXISTS public.gtm_ig_trade_targets (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    handle                   TEXT UNIQUE NOT NULL,
    profile_url              TEXT NOT NULL,
    business_name            TEXT,
    trade                    TEXT,
    city                     TEXT,
    region                   TEXT DEFAULT 'AU',
    bio                      TEXT,
    follower_count           INTEGER DEFAULT 0,
    website                  TEXT,
    discovered_via           TEXT CHECK (discovered_via IN ('hashtag','website','location_search')),
    ai_message               TEXT,
    ai_message_generated_at  TIMESTAMPTZ,
    ai_model                 TEXT,
    status                   TEXT DEFAULT 'not-contacted'
                             CHECK (status IN ('not-contacted','dm-sent','replied','declined')),
    last_dm_at               TIMESTAMPTZ,
    reply_at                 TIMESTAMPTZ,
    notes                    TEXT,
    created_at               TIMESTAMPTZ DEFAULT now(),
    updated_at               TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gtm_ig_trade_targets_surface
    ON public.gtm_ig_trade_targets (status, last_dm_at, reply_at);

DROP TRIGGER IF EXISTS gtm_ig_trade_targets_updated_at ON public.gtm_ig_trade_targets;
CREATE TRIGGER gtm_ig_trade_targets_updated_at
    BEFORE UPDATE ON public.gtm_ig_trade_targets
    FOR EACH ROW EXECUTE FUNCTION public.gtm_set_updated_at();

ALTER TABLE public.gtm_ig_trade_targets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "founder full access" ON public.gtm_ig_trade_targets
    FOR ALL TO authenticated
    USING (public.is_gtm_founder())
    WITH CHECK (public.is_gtm_founder());

-- 2. Cache IG handles discovered while visiting cold-lead websites
ALTER TABLE public.gtm_cold_leads
    ADD COLUMN IF NOT EXISTS instagram_handle TEXT,
    ADD COLUMN IF NOT EXISTS instagram_checked_at TIMESTAMPTZ;

-- 3. Track sent volume for the new channel separately from partnership IG DMs
ALTER TABLE public.gtm_daily_log
    ADD COLUMN IF NOT EXISTS trade_ig_dms_sent INTEGER DEFAULT 0;
