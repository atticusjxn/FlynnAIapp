-- Formalise the iMessage/SMS agent tables that exist in the live DB but were
-- never captured as migrations (created ad hoc). Shapes match production
-- exactly so this is a no-op there and creates them in fresh environments.

CREATE TABLE IF NOT EXISTS public.user_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_phone text NOT NULL,
  integration_type text NOT NULL,
  credentials_encrypted jsonb,
  connected_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT user_integrations_unique UNIQUE (user_phone, integration_type)
);

CREATE TABLE IF NOT EXISTS public.pending_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_phone text NOT NULL,
  action_type text NOT NULL,
  action_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  confirmation_message text NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 minutes'),
  created_at timestamptz DEFAULT now(),
  CONSTRAINT pending_actions_user_phone_unique UNIQUE (user_phone)
);

CREATE TABLE IF NOT EXISTS public.sms_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_phone text NOT NULL,
  direction text NOT NULL CHECK (direction IN ('in', 'out')),
  body text NOT NULL,
  created_at timestamptz DEFAULT now(),
  channel text DEFAULT 'sms'
);

CREATE INDEX IF NOT EXISTS user_integrations_user_phone_idx ON public.user_integrations (user_phone);
CREATE INDEX IF NOT EXISTS pending_actions_user_phone_idx ON public.pending_actions (user_phone);
CREATE INDEX IF NOT EXISTS sms_messages_user_phone_created_idx ON public.sms_messages (user_phone, created_at DESC);

-- Service-role only tables (the telephony server uses the service key).
ALTER TABLE public.user_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_messages ENABLE ROW LEVEL SECURITY;
