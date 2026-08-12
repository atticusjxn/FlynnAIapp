-- Baseline: users, plans, subscriptions.
--
-- These three tables were created out of band (straight against the remote
-- database, never through a migration), so the migrations directory could not
-- rebuild a working database. `supabase db reset` produced a schema where the
-- entitlement gate in routes/voiceOnboarding.js and every StoreKit webhook in
-- telephony/subscriptionService.js referenced tables that did not exist, which
-- is why there has never been a usable staging environment.
--
-- Reconstructed from the live schema on 2026-08-12 and dated ahead of every
-- other migration so it lays the foundation the rest of them ALTER.
--
-- Deliberately partial: columns that a later migration adds are NOT created
-- here, because those migrations attach constraints in the same statement.
-- `default_org_id`, for instance, is added by 202502151000 as
-- `add column if not exists default_org_id uuid references organizations(id)`
-- — creating the column here would make that ADD COLUMN a no-op and silently
-- drop the foreign key. Same reasoning for the receptionist_*, stripe_*,
-- subscription_status, call_handling_mode, has_* and is_demo columns.
--
-- Every statement is idempotent so this is a no-op against production.

-- ---------------------------------------------------------------- users ----

CREATE TABLE IF NOT EXISTS public.users (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  email text,
  full_name text,
  company_name text,
  industry_type text,
  subscription_tier text DEFAULT 'basic'::text,
  phone_number text,
  timezone text DEFAULT 'UTC'::text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  last_login_at timestamp with time zone,
  is_active boolean DEFAULT true,
  settings jsonb DEFAULT '{}'::jsonb,
  business_type text,
  onboarding_completed boolean DEFAULT false,
  business_goals jsonb DEFAULT '[]'::jsonb,
  phone_setup_complete boolean DEFAULT false,
  twilio_phone_number text,
  twilio_number_sid text,
  recording_preference text DEFAULT 'manual'::text,
  forwarding_active boolean DEFAULT false,
  call_features_enabled boolean DEFAULT true,
  business_name text,
  phone text,
  country_code text,
  address jsonb,
  calendar_sync_enabled boolean DEFAULT true,
  default_event_duration_minutes integer DEFAULT 60,
  business_hours_start time without time zone DEFAULT '09:00:00'::time without time zone,
  business_hours_end time without time zone DEFAULT '17:00:00'::time without time zone,
  receptionist_offer_voicemail_option boolean DEFAULT false,
  apple_calendar_connected boolean DEFAULT false NOT NULL,
  google_calendar_connected boolean DEFAULT false NOT NULL,
  calendar_prompt_dismissed_at timestamp with time zone,
  business_brain jsonb,
  signup_source text DEFAULT 'app'::text,
  onboarding_step text DEFAULT 'active'::text,
  reengagement_sent_count integer DEFAULT 0,
  last_reengagement_at timestamp with time zone,
  reengagement_opted_out boolean DEFAULT false,
  preferred_channel text
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'users_pkey' AND conrelid = 'public.users'::regclass) THEN
    ALTER TABLE public.users ADD CONSTRAINT users_pkey PRIMARY KEY (id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'users_email_key' AND conrelid = 'public.users'::regclass) THEN
    ALTER TABLE public.users ADD CONSTRAINT users_email_key UNIQUE (email);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'users_industry_type_check' AND conrelid = 'public.users'::regclass) THEN
    ALTER TABLE public.users ADD CONSTRAINT users_industry_type_check
    CHECK (industry_type = ANY (ARRAY['plumbing'::text, 'real_estate'::text, 'legal'::text,
      'medical'::text, 'sales'::text, 'consulting'::text, 'general_services'::text, 'other'::text]));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'users_recording_preference_check' AND conrelid = 'public.users'::regclass) THEN
    ALTER TABLE public.users ADD CONSTRAINT users_recording_preference_check
    CHECK (recording_preference = ANY (ARRAY['auto'::text, 'manual'::text, 'off'::text]));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'users_subscription_tier_check' AND conrelid = 'public.users'::regclass) THEN
    ALTER TABLE public.users ADD CONSTRAINT users_subscription_tier_check
    CHECK (subscription_tier = ANY (ARRAY['basic'::text, 'professional'::text, 'enterprise'::text]));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_business_type ON public.users USING btree (business_type);
CREATE INDEX IF NOT EXISTS idx_users_onboarding_complete ON public.users USING btree (onboarding_completed);
CREATE INDEX IF NOT EXISTS idx_users_twilio_phone_number ON public.users USING btree (twilio_phone_number);
CREATE INDEX IF NOT EXISTS idx_users_twilio_number_sid ON public.users USING btree (twilio_number_sid);

-- The receptionist is routed by matching the inbound To: against
-- users.twilio_phone_number, so two users must never hold the same number.
CREATE UNIQUE INDEX IF NOT EXISTS users_twilio_phone_number_unique
  ON public.users USING btree (twilio_phone_number) WHERE (twilio_phone_number IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS users_twilio_number_sid_unique
  ON public.users USING btree (twilio_number_sid) WHERE (twilio_number_sid IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS users_phone_unique
  ON public.users USING btree (phone) WHERE (phone IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_users_reengagement
  ON public.users USING btree (onboarding_step, reengagement_opted_out, reengagement_sent_count, created_at)
  WHERE (onboarding_step = 'brain_pending'::text);

-- ---------------------------------------------------------------- plans ----

CREATE TABLE IF NOT EXISTS public.plans (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  display_name text NOT NULL,
  price_monthly_aud numeric(10,2),
  ai_minutes_monthly integer NOT NULL,
  includes_voice_clone boolean DEFAULT false,
  apple_product_id text,
  google_product_id text,
  stripe_price_id text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'plans_pkey' AND conrelid = 'public.plans'::regclass) THEN
    ALTER TABLE public.plans ADD CONSTRAINT plans_pkey PRIMARY KEY (id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'plans_apple_product_id_key' AND conrelid = 'public.plans'::regclass) THEN
    ALTER TABLE public.plans ADD CONSTRAINT plans_apple_product_id_key UNIQUE (apple_product_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'plans_google_product_id_key' AND conrelid = 'public.plans'::regclass) THEN
    ALTER TABLE public.plans ADD CONSTRAINT plans_google_product_id_key UNIQUE (google_product_id);
  END IF;
END $$;

-- -------------------------------------------------------- subscriptions ----

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  plan_id uuid NOT NULL,
  status text DEFAULT 'trialing'::text NOT NULL,
  trial_end_at timestamp with time zone,
  current_period_start timestamp with time zone,
  current_period_end timestamp with time zone,
  cancelled_at timestamp with time zone,
  apple_original_transaction_id text,
  apple_latest_transaction_id text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'subscriptions_pkey' AND conrelid = 'public.subscriptions'::regclass) THEN
    ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (id);
  END IF;
END $$;

-- The StoreKit webhook upserts on this, so it is the idempotency key for
-- every Apple notification replay (telephony/subscriptionService.js).
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'subscriptions_apple_original_transaction_id_key'
                   AND conrelid = 'public.subscriptions'::regclass) THEN
    ALTER TABLE public.subscriptions
      ADD CONSTRAINT subscriptions_apple_original_transaction_id_key UNIQUE (apple_original_transaction_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'subscriptions_user_id_fkey' AND conrelid = 'public.subscriptions'::regclass) THEN
    ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'subscriptions_plan_id_fkey' AND conrelid = 'public.subscriptions'::regclass) THEN
    ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_plan_id_fkey
    FOREIGN KEY (plan_id) REFERENCES public.plans(id);
  END IF;
END $$;
