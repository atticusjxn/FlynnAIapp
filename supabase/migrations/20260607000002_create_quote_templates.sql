-- The owner's learned quoting style, captured from quotes they've already sent.
-- Vertical-agnostic JSON (see services/quoteStyleExtractor.js) so any trade/niche
-- fits. One active row per user; new captures merge into it (sample_count tracks
-- how many documents have been learned from).

CREATE TABLE IF NOT EXISTS public.quote_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  style_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  sample_count INTEGER NOT NULL DEFAULT 0,
  source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One style row per user (upsert target).
CREATE UNIQUE INDEX IF NOT EXISTS idx_quote_templates_user ON public.quote_templates (user_id);

ALTER TABLE public.quote_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own quote template" ON public.quote_templates;
CREATE POLICY "Users manage own quote template"
ON public.quote_templates
FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
