-- Funnel (pre-tenant) calls could never be recorded in call_events.
--
-- A prospect ringing the ad number, or being rung back by the landing page
-- "call me back" widget, has no organization yet, so respondWithFunnelIntake
-- logs its events with org_id = null. call_events.org_id was NOT NULL, so every
-- one of those inserts threw and was swallowed by the caller's catch block. The
-- table has never held a single funnel_call_received row; the only trace of a
-- funnel call was voice_onboarding_sessions.
--
-- Dropping NOT NULL lets those events land. The existing RLS policy needs no
-- change and stays correct: is_org_member() is an `exists (...)` over
-- org_members, so a null org_id matches no row and returns false. Null-org
-- events are therefore invisible to every tenant and readable only by
-- service_role, which is exactly right for a lead who is not a customer yet.
ALTER TABLE public.call_events
  ALTER COLUMN org_id DROP NOT NULL;

-- org_id is null for the whole funnel class of events, so the tenant-scoped
-- index does not serve the queries we run over them (by event type, newest
-- first). Partial index keeps that lookup cheap without touching tenant rows.
CREATE INDEX IF NOT EXISTS idx_call_events_funnel
  ON public.call_events (event_type, occurred_at DESC)
  WHERE org_id IS NULL;
