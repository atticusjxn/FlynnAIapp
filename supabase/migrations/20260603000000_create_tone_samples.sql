-- Tone samples for Flynn's text-reply co-pilot.
--
-- Holds short examples of how a user writes, used as few-shot anchors so drafted
-- replies sound like them. Two sources feed the same table:
--   * 'onboarding' — 3-5 sample replies the user writes during setup.
--   * 'accepted'   — drafts the user actually tapped/sent (the learning loop:
--                    tapping a draft reinforces that style for next time).
-- The draft endpoint selects all onboarding samples plus the most recent N
-- accepted ones to build the tone prompt.

CREATE TABLE IF NOT EXISTS public.tone_samples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  sample_text TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'onboarding'
    CHECK (source IN ('onboarding', 'accepted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Fetch a user's tone samples newest-first (prompt builder reads the latest).
CREATE INDEX IF NOT EXISTS tone_samples_user_created_idx
  ON public.tone_samples (user_id, created_at DESC);

-- Auto-fill user_id/org_id on insert, mirroring business_profiles (bp_set_user_id).
CREATE OR REPLACE FUNCTION public.tone_samples_set_owner()
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

DROP TRIGGER IF EXISTS trg_tone_samples_set_owner ON public.tone_samples;
CREATE TRIGGER trg_tone_samples_set_owner
  BEFORE INSERT ON public.tone_samples
  FOR EACH ROW EXECUTE FUNCTION public.tone_samples_set_owner();

-- RLS: a user manages only their own samples (mirrors business_profiles policy).
ALTER TABLE public.tone_samples ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own tone samples" ON public.tone_samples;
CREATE POLICY "Users can manage own tone samples"
ON public.tone_samples
FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
