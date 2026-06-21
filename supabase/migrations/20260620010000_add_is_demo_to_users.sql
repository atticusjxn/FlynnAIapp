-- Reviewer demo accounts: anyone who texts the demo code (LATITUDE) gets a
-- fully-seeded persona with no signup/OAuth. is_demo flags those rows so tools
-- simulate external side effects (orders, emails) and demos never bill or
-- pollute real metrics.
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_demo boolean DEFAULT false;
