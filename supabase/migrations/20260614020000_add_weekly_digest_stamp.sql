-- Bookkeeping for the weekly money/admin digest scheduler: when this user was
-- last sent their digest, so the sweep sends at most one per week per user and
-- doesn't re-poll Xero every tick during the digest hour.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS last_weekly_digest_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_users_last_weekly_digest_at
  ON public.users (last_weekly_digest_at);
