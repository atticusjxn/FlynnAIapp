-- Baseline: ai_call_usage.
--
-- Created out of band like users/plans/subscriptions (see
-- 20240101000000_baseline_core_tables.sql). Split into its own file because it
-- references organizations, which 202502151000 creates five minutes earlier in
-- migration order — the core baseline runs before that and cannot see it.
--
-- This is the per-call cost telemetry the margin model runs on
-- (telephony/callCostEstimate.js writes cost_breakdown here on every call), so
-- losing it means losing the only record of what a call actually costs.
--
-- Deliberately partial: `funnel` and `cost_breakdown`, the nullability drop on
-- the tenant ids, and ai_call_usage_tenant_ids_required all belong to
-- 202607221600 and are left to it. organization_id/user_id are NOT NULL here
-- because that is what they were before that migration relaxed them for
-- funnel (ad-line) calls, which have no tenant yet.

CREATE TABLE IF NOT EXISTS public.ai_call_usage (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid NOT NULL,
  user_id uuid NOT NULL,
  call_sid text NOT NULL,
  call_duration_seconds integer,
  call_cost_cents integer,
  billing_period_month date NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'ai_call_usage_pkey' AND conrelid = 'public.ai_call_usage'::regclass) THEN
    ALTER TABLE public.ai_call_usage ADD CONSTRAINT ai_call_usage_pkey PRIMARY KEY (id);
  END IF;
END $$;

-- One usage row per call. Also the idempotency key for webhook replays.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'ai_call_usage_call_sid_key' AND conrelid = 'public.ai_call_usage'::regclass) THEN
    ALTER TABLE public.ai_call_usage ADD CONSTRAINT ai_call_usage_call_sid_key UNIQUE (call_sid);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'ai_call_usage_organization_id_fkey' AND conrelid = 'public.ai_call_usage'::regclass) THEN
    ALTER TABLE public.ai_call_usage ADD CONSTRAINT ai_call_usage_organization_id_fkey
    FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'ai_call_usage_user_id_fkey' AND conrelid = 'public.ai_call_usage'::regclass) THEN
    ALTER TABLE public.ai_call_usage ADD CONSTRAINT ai_call_usage_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_call_usage_billing_period
  ON public.ai_call_usage USING btree (organization_id, billing_period_month);
