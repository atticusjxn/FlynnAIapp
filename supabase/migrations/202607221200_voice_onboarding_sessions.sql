-- Voice front-door funnel: staging table for business config extracted from the
-- AI receptionist intake call, keyed by the caller's phone until they claim it
-- in the app via phone-OTP signup. Service-role access only (RLS on, no policies);
-- the iOS app reads it through the backend, never directly.

create table if not exists public.voice_onboarding_sessions (
  id uuid primary key default gen_random_uuid(),
  caller_phone text not null unique,
  claim_code text not null unique,
  state text not null default 'in_call'
    check (state in ('in_call', 'call_completed', 'sms_sent', 'claimed', 'receptionist_live', 'expired')),
  business_config jsonb not null default '{}'::jsonb,
  transcript jsonb,
  call_sids text[] not null default '{}',
  call_count integer not null default 1,
  claimed_by uuid references public.users(id),
  claimed_org_id uuid references public.organizations(id),
  reengage_count integer not null default 0,
  last_sms_at timestamptz,
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists voice_onboarding_sessions_state_idx
  on public.voice_onboarding_sessions (state);

alter table public.voice_onboarding_sessions enable row level security;

-- Callout fee gets a real column on the org-keyed profile instead of living in
-- pricing_notes prose (the voice intake extracts it as a number).
alter table public.business_profiles
  add column if not exists callout_fee_cents integer;
