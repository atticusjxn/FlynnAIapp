-- Per-user dashboard layout manifests.
--
-- The generator (services/dashboard/manifestGenerator.js) ranks widgets from
-- tool_call_events + user_connections + recent jobs/customer_context, then has
-- Qwen write per-business proactive copy. The resulting platform-agnostic JSON
-- manifest is stored here and rendered by flynn-dashboard (and later iOS/Kotlin).
--
-- One current row per user (partial unique index); regen flips the prior row's
-- is_current to false and inserts a new versioned row. inputs_hash lets the
-- generator skip a regen (and the LLM spend) when the ranking inputs are
-- unchanged. Service-role only — read through the JWT-gated dashboard API.

CREATE TABLE IF NOT EXISTS public.dashboard_manifests (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid REFERENCES public.users(id) ON DELETE CASCADE,
  user_phone   text NOT NULL,
  version      integer NOT NULL DEFAULT 1,
  manifest     jsonb NOT NULL,
  inputs_hash  text,
  generated_by text NOT NULL DEFAULT 'hybrid',   -- 'hybrid' | 'rules_only' | 'manual'
  is_current   boolean NOT NULL DEFAULT true,
  generated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS dashboard_manifests_user_idx
  ON public.dashboard_manifests (user_id, generated_at DESC);
CREATE INDEX IF NOT EXISTS dashboard_manifests_phone_idx
  ON public.dashboard_manifests (user_phone, generated_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS dashboard_manifests_one_current_idx
  ON public.dashboard_manifests (user_id) WHERE is_current;

ALTER TABLE public.dashboard_manifests ENABLE ROW LEVEL SECURITY;  -- service-role only
