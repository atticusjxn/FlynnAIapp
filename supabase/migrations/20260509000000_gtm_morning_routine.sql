-- Flynn GTM Morning Routine — schema additions
--
-- Supports the daily Claude Code routine that scrapes leads, personalises
-- emails, builds an IG DM list, surfaces partnership contacts, and assembles
-- a single morning-briefing JSONB blob that a static HTML page renders.

-- 1. Stream A — per-lead personalisation columns on gtm_cold_leads
ALTER TABLE public.gtm_cold_leads
    ADD COLUMN IF NOT EXISTS review_keywords      TEXT[],
    ADD COLUMN IF NOT EXISTS review_snippet       TEXT,
    ADD COLUMN IF NOT EXISTS personalized_subject TEXT,
    ADD COLUMN IF NOT EXISTS personalized_body    TEXT,
    ADD COLUMN IF NOT EXISTS google_place_id      TEXT,
    ADD COLUMN IF NOT EXISTS reviews_count        INTEGER,
    ADD COLUMN IF NOT EXISTS website              TEXT;

CREATE INDEX IF NOT EXISTS idx_gtm_cold_leads_personalized_unsent
    ON public.gtm_cold_leads (sent_at)
    WHERE personalized_body IS NOT NULL AND sent_at IS NULL;

-- 2. Stream C — partnership leads (associations, bookkeepers, accountants, retailers)
CREATE TABLE IF NOT EXISTS public.gtm_partnership_leads (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_name      TEXT NOT NULL,
    org_type      TEXT CHECK (org_type IN ('association','bookkeeper','accountant','retailer','other')),
    contact_name  TEXT,
    contact_role  TEXT,
    linkedin_url  TEXT,
    email         TEXT,
    website       TEXT,
    region        TEXT DEFAULT 'AU',
    notes         TEXT,
    pitch_draft   TEXT,
    status        TEXT DEFAULT 'new'
                  CHECK (status IN ('new','contacted','replied','partnership-active','declined')),
    surfaced_at   TIMESTAMPTZ DEFAULT now(),
    contacted_at  TIMESTAMPTZ,
    replied_at    TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_gtm_partnership_leads_unique
    ON public.gtm_partnership_leads (org_name, COALESCE(contact_name, ''));

CREATE INDEX IF NOT EXISTS idx_gtm_partnership_leads_surface
    ON public.gtm_partnership_leads (status, surfaced_at DESC);

-- 3. Morning briefing JSONB — one row per day, the local HTML reads this
CREATE TABLE IF NOT EXISTS public.gtm_morning_briefing (
    briefing_date  DATE PRIMARY KEY,
    payload        JSONB NOT NULL,
    generated_at   TIMESTAMPTZ DEFAULT now()
);

-- 4. RLS — allow public anon reads of today's briefing only
-- (the morning.html runs locally with the anon key; row exposes the same
-- info as the user's outbox — emails being sent + DM drafts.)
ALTER TABLE public.gtm_morning_briefing ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon can read today's briefing" ON public.gtm_morning_briefing;
CREATE POLICY "anon can read today's briefing"
    ON public.gtm_morning_briefing
    FOR SELECT
    TO anon, authenticated
    USING (briefing_date = (now() AT TIME ZONE 'Australia/Sydney')::date);

-- Service role bypasses RLS automatically; routine writes happen as service role.

-- 5. Mark-as-sent helpers — anon needs to update IG/partnership status from the dashboard.
-- Use existing flynn-gtm-dashboard RLS pattern (founder user only).
ALTER TABLE public.gtm_partnership_leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "founder can manage partnership leads" ON public.gtm_partnership_leads;
CREATE POLICY "founder can manage partnership leads"
    ON public.gtm_partnership_leads
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);
