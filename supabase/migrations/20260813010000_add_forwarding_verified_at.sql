-- When the server confirmed (via a test call that forwarded to their Flynn
-- number) that a user's carrier divert is actually live. Distinct from
-- users.forwarding_active, which only records that the app *dialled* the code —
-- the phone can't tell the app whether the carrier accepted it, so this is the
-- only trustworthy "Flynn is receiving your calls" signal.
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS forwarding_verified_at timestamp with time zone;
