-- Rename onboarding_complete → onboarding_completed to match Swift client expectations.
-- The Swift OnboardingStore has always queried/updated "onboarding_completed" (with trailing d);
-- the DB column was created without the d, causing the load() query to error and default
-- onboardingCompleted = true, silently bypassing onboarding for every new user.
ALTER TABLE public.users RENAME COLUMN onboarding_complete TO onboarding_completed;
