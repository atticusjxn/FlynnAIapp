-- Dedup table for the proactive weather reschedule nudge so a given job on a
-- given date is never nudged twice.
CREATE TABLE IF NOT EXISTS public.weather_nudges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_phone text NOT NULL,
  event_key text NOT NULL,
  nudge_date date NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS weather_nudges_unique_idx
  ON public.weather_nudges (user_phone, event_key, nudge_date);

ALTER TABLE public.weather_nudges ENABLE ROW LEVEL SECURITY;
