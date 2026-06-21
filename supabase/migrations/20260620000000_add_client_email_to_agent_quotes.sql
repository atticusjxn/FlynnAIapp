-- Store the client's email on a recorded quote so the proactive quote-chaser
-- can email the follow-up directly (when an email provider is connected)
-- instead of having to ask for it after the operator says "yep, chase it".
ALTER TABLE public.agent_quotes ADD COLUMN IF NOT EXISTS client_email text;
