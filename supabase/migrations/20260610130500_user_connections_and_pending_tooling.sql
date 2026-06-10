-- Unified per-user integration connections for the iMessage agent.
--
-- Two auth kinds:
--   nango_oauth             - tokens live in Nango Cloud, keyed by nango_connection_id
--                             (= users.id, reused across all provider configs)
--   credentials_browserbase - login creds live in user_integrations; this table
--                             mirrors their existence so the tool registry has one
--                             place to check connection status
--
-- Dashboard note: the web dashboard reads integration_connections (org-keyed) with
-- a provider CHECK constraint that excludes gmail/sheets. Bridging Nango-connected
-- providers into that table is deferred; relaxing its CHECK is a separate migration.

CREATE TABLE IF NOT EXISTS public.user_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  user_phone text NOT NULL,
  provider text NOT NULL,           -- nango id ('google-calendar'|'google-mail'|'google-sheet')
                                    -- or browserbase slug ('xero'|'reece'|'bunnings'|'tradelink'|...)
  auth_kind text NOT NULL CHECK (auth_kind IN ('nango_oauth', 'credentials_browserbase')),
  status text NOT NULL DEFAULT 'connected'
    CHECK (status IN ('pending', 'connected', 'error', 'revoked')),
  nango_connection_id text,
  account_label text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,   -- e.g. {"expenses_spreadsheet_id": "..."}
  connected_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_connections_phone_provider_unique UNIQUE (user_phone, provider)
);

CREATE INDEX IF NOT EXISTS user_connections_user_phone_idx ON public.user_connections (user_phone);
CREATE INDEX IF NOT EXISTS user_connections_nango_id_idx ON public.user_connections (nango_connection_id);

ALTER TABLE public.user_connections ENABLE ROW LEVEL SECURITY;  -- service-role only

-- Parked tool calls: a pending action now either awaits the user's yes/no
-- (awaiting_confirmation) or awaits an integration connection, after which it
-- resumes automatically (awaiting_connection).
ALTER TABLE public.pending_actions
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'awaiting_confirmation',
  ADD COLUMN IF NOT EXISTS required_provider text,
  ADD COLUMN IF NOT EXISTS tool_name text,
  ADD COLUMN IF NOT EXISTS tool_args jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pending_actions_status_check'
  ) THEN
    ALTER TABLE public.pending_actions
      ADD CONSTRAINT pending_actions_status_check
      CHECK (status IN ('awaiting_confirmation', 'awaiting_connection'));
  END IF;
END $$;

-- Mirror existing Browserbase credential rows so the registry sees them as connected.
INSERT INTO public.user_connections (user_id, user_phone, provider, auth_kind, status, connected_at)
SELECT u.id, ui.user_phone, ui.integration_type, 'credentials_browserbase', 'connected', ui.connected_at
FROM public.user_integrations ui
LEFT JOIN public.users u ON u.phone = ui.user_phone
ON CONFLICT (user_phone, provider) DO NOTHING;
