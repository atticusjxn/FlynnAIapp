-- Rollback helper: drop smart call routing schema additions.
-- Run with caution; this will remove caller memory, voicemail metadata, and routing settings.
begin;

  drop table if exists public.call_voicemails cascade;
  drop table if exists public.call_routing_settings cascade;
  drop table if exists public.callers cascade;

  alter table if exists public.calls
    drop column if exists caller_id,
    drop column if exists route_mode,
    drop column if exists route_decision,
    drop column if exists route_reason,
    drop column if exists route_fallback,
    drop column if exists route_evaluated_at,
    drop column if exists feature_flag_version,
    drop column if exists metadata;

  drop index if exists public.calls_user_route_idx;
  drop index if exists public.calls_caller_idx;

commit;
