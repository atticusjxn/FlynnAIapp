-- Tool-usage telemetry for the iMessage agent.
--
-- Every tool execution (LLM-path, confirmed "yes" path, resumed-after-login, and
-- web-initiated from the dashboard) emits one fire-and-forget row here. This is
-- the signal the dashboard manifest generator ranks on: "what does this user
-- actually use most". Service-role only — read through the JWT-gated API, never
-- the anon key.
--
-- Stores both user_id and user_phone: phone is always known in the agent loop,
-- but user_id can be null very early in onboarding (before an auth user exists),
-- so the generator falls back to phone joins.

CREATE TABLE IF NOT EXISTS public.tool_call_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES public.users(id) ON DELETE CASCADE,
  user_phone  text NOT NULL,
  tool_name   text NOT NULL,          -- e.g. 'xero_send_invoice'
  capability  text NOT NULL,          -- e.g. 'invoicing'
  provider    text,                   -- resolved slug or null
  success     boolean NOT NULL DEFAULT true,
  source      text NOT NULL DEFAULT 'llm'
    CHECK (source IN ('llm', 'confirmed', 'resumed', 'web')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tool_call_events_phone_time_idx
  ON public.tool_call_events (user_phone, created_at DESC);
CREATE INDEX IF NOT EXISTS tool_call_events_user_time_idx
  ON public.tool_call_events (user_id, created_at DESC);

ALTER TABLE public.tool_call_events ENABLE ROW LEVEL SECURITY;  -- service-role only
