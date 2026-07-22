-- Component-level cost telemetry + funnel flag. Funnel (ad-line) calls are
-- CAC, not COGS — margin dashboards must be able to exclude them.
alter table public.ai_call_usage
  add column if not exists funnel boolean not null default false,
  add column if not exists cost_breakdown jsonb;

-- Funnel (ad-line) calls have no tenant yet; allow null org/user for them
-- while keeping tenant rows strict.
alter table public.ai_call_usage
  alter column organization_id drop not null,
  alter column user_id drop not null;

alter table public.ai_call_usage
  add constraint ai_call_usage_tenant_ids_required
  check (funnel = true or (organization_id is not null and user_id is not null));
