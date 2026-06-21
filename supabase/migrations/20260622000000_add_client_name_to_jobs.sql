-- The native iOS app (EventDTO / EventInput, Features/Events) reads AND writes
-- jobs.client_name, but the jobs table only had the legacy telephony-era
-- customer_name column. Without this column the in-app "create booking" failed
-- ("Could not find the 'client_name' column of 'jobs'") and bookings never
-- displayed. Additive + backfilled from customer_name for existing rows.
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS client_name text;
UPDATE public.jobs SET client_name = customer_name WHERE client_name IS NULL AND customer_name IS NOT NULL;
