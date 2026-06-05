-- Per-day draft usage counter, for the free-tier draft cap. Free users get
-- FREE_DRAFTS_PER_DAY drafts/day; entitled (active/trialing) users are unlimited
-- and never counted.

CREATE TABLE IF NOT EXISTS public.draft_usage (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, usage_date)
);

ALTER TABLE public.draft_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own draft usage" ON public.draft_usage;
CREATE POLICY "Users manage own draft usage"
ON public.draft_usage
FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Atomic increment of today's counter; returns the new count.
CREATE OR REPLACE FUNCTION public.bump_draft_usage(p_user_id UUID)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE new_count INTEGER;
BEGIN
  INSERT INTO public.draft_usage (user_id, usage_date, count)
  VALUES (p_user_id, CURRENT_DATE, 1)
  ON CONFLICT (user_id, usage_date)
  DO UPDATE SET count = public.draft_usage.count + 1
  RETURNING count INTO new_count;
  RETURN new_count;
END;
$$;
