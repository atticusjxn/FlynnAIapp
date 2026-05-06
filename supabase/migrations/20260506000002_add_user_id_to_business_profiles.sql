-- Add user_id to business_profiles so the iOS client can upsert by auth.uid().
-- Auto-populate on insert from auth.uid() and enforce uniqueness so
-- onConflict: "user_id" works correctly.
ALTER TABLE public.business_profiles
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Backfill only where the user exists in auth.users.
UPDATE public.business_profiles bp
SET user_id = u.id
FROM public.users u
JOIN auth.users au ON au.id = u.id
WHERE u.default_org_id = bp.org_id
  AND bp.user_id IS NULL;

ALTER TABLE public.business_profiles
  ADD CONSTRAINT business_profiles_user_id_key UNIQUE (user_id);

CREATE OR REPLACE FUNCTION public.bp_set_user_id()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    NEW.user_id := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bp_set_user_id ON public.business_profiles;
CREATE TRIGGER trg_bp_set_user_id
  BEFORE INSERT ON public.business_profiles
  FOR EACH ROW EXECUTE FUNCTION public.bp_set_user_id();

-- Also fill org_id from user's default_org_id on insert (updated trigger).
CREATE OR REPLACE FUNCTION public.bp_set_user_id()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    NEW.user_id := auth.uid();
  END IF;
  IF NEW.org_id IS NULL THEN
    SELECT default_org_id INTO NEW.org_id
    FROM public.users
    WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;
