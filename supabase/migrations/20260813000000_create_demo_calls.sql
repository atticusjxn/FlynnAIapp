-- Demo calls — the onboarding "hear it for yourself" value moment.
--
-- The wizard rings the user's own (OTP-verified) mobile and connects them to
-- their AI receptionist, seeded from the business_profiles they just entered,
-- so they experience the product before the paywall. This table tracks each
-- demo call and holds its payoff (transcript + the job Flynn extracted) for the
-- app to poll — a demo call deliberately does NOT create a real job, bill the
-- tenant, or text anyone, so its result lives here instead of in jobs/calls.
--
-- Written for the backend service role only; RLS is on with no anon/authenticated
-- policies, so the publishable key can't read another user's demo transcripts.

CREATE TABLE IF NOT EXISTS public.demo_calls (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  org_id uuid,
  call_sid text,
  to_phone text NOT NULL,
  -- ringing → in_progress → completed | no_answer | failed | canceled
  status text NOT NULL DEFAULT 'ringing',
  transcript text,
  extracted_job jsonb,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  completed_at timestamp with time zone
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'demo_calls_pkey' AND conrelid = 'public.demo_calls'::regclass) THEN
    ALTER TABLE public.demo_calls ADD CONSTRAINT demo_calls_pkey PRIMARY KEY (id);
  END IF;
END $$;

-- The completion handler finds a demo call by the Twilio call SID to divert it
-- out of the tenant pipeline, so this must be unique and fast.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'demo_calls_call_sid_key' AND conrelid = 'public.demo_calls'::regclass) THEN
    ALTER TABLE public.demo_calls ADD CONSTRAINT demo_calls_call_sid_key UNIQUE (call_sid);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'demo_calls_user_id_fkey' AND conrelid = 'public.demo_calls'::regclass) THEN
    ALTER TABLE public.demo_calls ADD CONSTRAINT demo_calls_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Rate limiting counts a user's recent demo calls.
CREATE INDEX IF NOT EXISTS idx_demo_calls_user_created
  ON public.demo_calls USING btree (user_id, created_at DESC);

ALTER TABLE public.demo_calls ENABLE ROW LEVEL SECURITY;
-- No policies: the service role bypasses RLS, and no one else may read these.
