-- quote_templates.user_id had no unique index, but server.js upserts into it
-- with `{ onConflict: 'user_id' }`. Postgres rejects an ON CONFLICT target that
-- has no matching unique constraint, so every "learn my quote style" save
-- errored. The failure was invisible: supabase-js returns { error } rather than
-- throwing, and the call site neither checks the result nor is reachable by the
-- surrounding try/catch — so the feature silently never persisted anything.
--
-- The code's intent is one template row per user (it reads the existing row and
-- increments sample_count), so a unique index is the correct model. Verified
-- safe to add: the table currently holds 1 row with 1 distinct non-null user_id.

CREATE UNIQUE INDEX IF NOT EXISTS quote_templates_user_id_key
  ON public.quote_templates (user_id);
