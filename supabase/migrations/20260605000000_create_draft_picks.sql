-- Draft picks for Flynn's text-reply co-pilot (passive learning, voice + substance).
--
-- tone_samples already captures the *accepted text* (voice). draft_picks captures
-- the richer signal: the full candidate set the user chose from, which option they
-- picked, the source conversation, and how it was captured (clipboard vs
-- screenshot). This contrastive data (chosen vs not-chosen) powers substance
-- learning now and richer preference modelling later.
--
-- Privacy: customer message text is sensitive; rows are owned by the user and
-- protected by RLS. Stored to learn the owner's preferences, never shared.

CREATE TABLE IF NOT EXISTS public.draft_picks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  -- The conversation the drafts responded to (OCR'd screen or copied message[s]).
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- The full set of options shown to the user.
  candidates JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Which option (0-based) they inserted, and its text.
  picked_index INTEGER,
  picked_text TEXT NOT NULL,
  -- How the conversation was captured.
  source TEXT NOT NULL DEFAULT 'clipboard'
    CHECK (source IN ('clipboard', 'screenshot')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Fetch a user's picks newest-first (substance derivation reads the latest).
CREATE INDEX IF NOT EXISTS draft_picks_user_created_idx
  ON public.draft_picks (user_id, created_at DESC);

-- Auto-fill user_id/org_id on insert, mirroring tone_samples_set_owner.
CREATE OR REPLACE FUNCTION public.draft_picks_set_owner()
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

DROP TRIGGER IF EXISTS trg_draft_picks_set_owner ON public.draft_picks;
CREATE TRIGGER trg_draft_picks_set_owner
  BEFORE INSERT ON public.draft_picks
  FOR EACH ROW EXECUTE FUNCTION public.draft_picks_set_owner();

-- RLS: a user manages only their own picks (mirrors tone_samples policy).
ALTER TABLE public.draft_picks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own draft picks" ON public.draft_picks;
CREATE POLICY "Users can manage own draft picks"
ON public.draft_picks
FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
