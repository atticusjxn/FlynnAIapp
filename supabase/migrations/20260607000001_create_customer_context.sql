-- Per-customer / per-location context Flynn remembers: facts captured passively
-- from voice "notes" and (later) from OCR'd conversations, that resurface in
-- future drafts and quotes for the same subject. Human-in-the-loop: only facts the
-- user keeps (status='confirmed') are ever injected into prompts.

CREATE TABLE IF NOT EXISTS public.customer_context (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Normalised match key (lowercased name / digits of a phone / location label).
  subject_handle TEXT,
  -- Human-readable subject for display ("Dave at 12 Oak St").
  subject_label TEXT,
  fact TEXT NOT NULL,
  confidence REAL DEFAULT 0.5,
  -- 'unconfirmed' (extracted, awaiting keep/discard) | 'confirmed' | 'dismissed'.
  -- Voice notes are saved 'confirmed' (the user spoke them on purpose).
  status TEXT NOT NULL DEFAULT 'unconfirmed',
  -- 'voice' | 'screenshot' | 'clipboard' | 'manual'.
  source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_context_user_subject
  ON public.customer_context (user_id, subject_handle);
CREATE INDEX IF NOT EXISTS idx_customer_context_user_status
  ON public.customer_context (user_id, status);

ALTER TABLE public.customer_context ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own customer context" ON public.customer_context;
CREATE POLICY "Users manage own customer context"
ON public.customer_context
FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
