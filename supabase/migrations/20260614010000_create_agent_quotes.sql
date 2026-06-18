-- Lightweight, phone-keyed quote tracking for the iMessage agent so Flynn can
-- chase quotes that go cold (the "quote follow-up" sticky-core job). This is
-- SEPARATE from the formal org-keyed public.quotes table (PDF/Stripe flow) — it
-- captures the informal/verbal quotes a text-first operator mentions ("quoted
-- dave $480 for the reno"). Consistent with the agent's other phone-keyed tables
-- (tool_call_events, user_connections). Service-role only.

CREATE TABLE IF NOT EXISTS public.agent_quotes (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid REFERENCES public.users(id) ON DELETE CASCADE,
  user_phone       text NOT NULL,
  client_name      text,
  client_handle    text,                 -- normalised (lowercased) for matching
  amount_cents     integer,
  currency         text,
  description      text,
  status           text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'won', 'lost', 'expired')),
  sent_at          timestamptz NOT NULL DEFAULT now(),
  last_followup_at timestamptz,
  followup_count   int NOT NULL DEFAULT 0,
  next_followup_at timestamptz,           -- when the operator should be nudged
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agent_quotes_phone_status_idx ON public.agent_quotes (user_phone, status);
CREATE INDEX IF NOT EXISTS agent_quotes_followup_idx ON public.agent_quotes (status, next_followup_at);

ALTER TABLE public.agent_quotes ENABLE ROW LEVEL SECURITY;  -- service-role only
