-- Phone-only signups create auth.users rows with email = NULL.
-- The on_auth_user_created trigger inserts into public.users(email),
-- which used to fail the NOT NULL constraint and surface as
-- "Database error saving new user" in the app.
ALTER TABLE public.users ALTER COLUMN email DROP NOT NULL;
