-- Establish organization-scoped multi-tenancy, provisioning, and call-routing schema.
set local search_path = public;
set local statement_timeout = '60s';

create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- Reusable trigger helper for updated_at columns.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Core organization records.
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  slug citext unique,
  display_name text not null,
  website_url text,
  timezone text not null default 'UTC',
  status text not null default 'onboarding'
    check (status in ('onboarding', 'active', 'suspended', 'archived')),
  plan text not null default 'trial'
    check (plan in ('trial', 'starter', 'growth', 'enterprise')),
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  onboarded_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  constraint organizations_slug_format
    check (slug is null or slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

drop trigger if exists touch_organizations_updated_at on public.organizations;
create trigger touch_organizations_updated_at
  before update on public.organizations
  for each row
  execute function public.touch_updated_at();

create table if not exists public.org_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null default 'agent'
    check (role in ('owner', 'admin', 'agent', 'viewer')),
  status text not null default 'active'
    check (status in ('pending', 'active', 'revoked')),
  invited_by uuid references public.users(id) on delete set null,
  invited_at timestamptz not null default now(),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  unique (org_id, user_id)
);

create index if not exists org_members_org_id_idx on public.org_members(org_id);
create index if not exists org_members_user_id_idx on public.org_members(user_id);

drop trigger if exists touch_org_members_updated_at on public.org_members;
create trigger touch_org_members_updated_at
  before update on public.org_members
  for each row
  execute function public.touch_updated_at();

-- Ensure creators automatically gain ownership membership.
create or replace function public.ensure_org_creator_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.created_by is not null then
    insert into public.org_members (org_id, user_id, role, status, invited_by, invited_at, accepted_at)
    values (new.id, new.created_by, 'owner', 'active', new.created_by, now(), now())
    on conflict (org_id, user_id) do update
      set role = excluded.role,
          status = excluded.status,
          accepted_at = excluded.accepted_at;
  end if;
  return new;
end;
$$;

drop trigger if exists ensure_org_creator_membership on public.organizations;
create trigger ensure_org_creator_membership
  after insert on public.organizations
  for each row
  execute function public.ensure_org_creator_membership();

create table if not exists public.business_profiles (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null unique references public.organizations(id) on delete cascade,
  legal_name text,
  public_name text,
  website_url text,
  headline text,
  description text,
  services jsonb not null default '[]'::jsonb,
  locations jsonb not null default '[]'::jsonb,
  hours jsonb not null default '{}'::jsonb,
  brand_voice jsonb not null default '{}'::jsonb,
  intake_questions jsonb not null default '[]'::jsonb,
  scrape_status text not null default 'pending'
    check (scrape_status in ('pending', 'in_progress', 'complete', 'failed')),
  last_scraped_at timestamptz,
  last_scrape_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

drop trigger if exists touch_business_profiles_updated_at on public.business_profiles;
create trigger touch_business_profiles_updated_at
  before update on public.business_profiles
  for each row
  execute function public.touch_updated_at();

create table if not exists public.website_ingests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  requested_by uuid references public.users(id) on delete set null,
  source_url text not null,
  status text not null default 'pending'
    check (status in ('pending', 'fetching', 'parsing', 'complete', 'failed')),
  notes text,
  raw_snapshot text,
  parsed_payload jsonb not null default '{}'::jsonb,
  error_message text,
  requested_at timestamptz not null default now(),
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists website_ingests_org_status_idx
  on public.website_ingests(org_id, status);

create table if not exists public.onboarding_sessions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade,
  user_id uuid references public.users(id) on delete cascade,
  current_step text not null default 'collect_website',
  payload jsonb not null default '{}'::jsonb,
  completed boolean not null default false,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists onboarding_sessions_org_idx on public.onboarding_sessions(org_id);
create index if not exists onboarding_sessions_user_idx on public.onboarding_sessions(user_id);

drop trigger if exists touch_onboarding_sessions_updated_at on public.onboarding_sessions;
create trigger touch_onboarding_sessions_updated_at
  before update on public.onboarding_sessions
  for each row
  execute function public.touch_updated_at();

create table if not exists public.call_flows (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  status text not null default 'draft'
    check (status in ('draft', 'active', 'disabled')),
  entrypoint text not null default 'receptionist'
    check (entrypoint in ('receptionist', 'voicemail', 'ivr')),
  flow jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists call_flows_org_idx on public.call_flows(org_id);

drop trigger if exists touch_call_flows_updated_at on public.call_flows;
create trigger touch_call_flows_updated_at
  before update on public.call_flows
  for each row
  execute function public.touch_updated_at();

create table if not exists public.phone_numbers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  call_flow_id uuid references public.call_flows(id) on delete set null,
  provisioned_by uuid references public.users(id) on delete set null,
  e164_number text not null unique,
  friendly_label text,
  twilio_sid text unique,
  twilio_subaccount_sid text,
  status text not null default 'pending'
    check (status in ('pending', 'reserved', 'active', 'ported', 'released', 'failed')),
  forwarding_type text not null default 'flynn_number'
    check (forwarding_type in ('flynn_number', 'call_forwarding', 'ported', 'sip_trunk')),
  connected_number text,
  original_number text,
  capabilities jsonb not null default '{}'::jsonb,
  verification_state text not null default 'unverified'
    check (verification_state in ('unverified', 'verifying', 'verified', 'failed')),
  verified_at timestamptz,
  is_primary boolean not null default false,
  provisioned_at timestamptz,
  released_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.phone_numbers
  add column if not exists org_id uuid references public.organizations(id) on delete cascade,
  add column if not exists call_flow_id uuid references public.call_flows(id) on delete set null,
  add column if not exists provisioned_by uuid references public.users(id) on delete set null,
  add column if not exists e164_number text,
  add column if not exists friendly_label text,
  add column if not exists twilio_sid text,
  add column if not exists twilio_subaccount_sid text,
  add column if not exists status text,
  add column if not exists forwarding_type text,
  add column if not exists connected_number text,
  add column if not exists original_number text,
  add column if not exists capabilities jsonb,
  add column if not exists verification_state text,
  add column if not exists verified_at timestamptz,
  add column if not exists is_primary boolean,
  add column if not exists provisioned_at timestamptz,
  add column if not exists released_at timestamptz,
  add column if not exists metadata jsonb,
  add column if not exists created_at timestamptz,
  add column if not exists updated_at timestamptz;

update public.phone_numbers
   set status = coalesce(status, 'pending'),
       forwarding_type = coalesce(forwarding_type, 'flynn_number'),
       verification_state = coalesce(verification_state, 'unverified'),
       capabilities = coalesce(capabilities, '{}'::jsonb),
       metadata = coalesce(metadata, '{}'::jsonb),
       created_at = coalesce(created_at, now()),
       updated_at = coalesce(updated_at, now());

alter table public.phone_numbers
  alter column status set default 'pending',
  alter column status set not null,
  alter column forwarding_type set default 'flynn_number',
  alter column forwarding_type set not null,
  alter column capabilities set default '{}'::jsonb,
  alter column verification_state set default 'unverified',
  alter column verification_state set not null,
  alter column is_primary set default false,
  alter column metadata set default '{}'::jsonb,
  alter column created_at set default now(),
  alter column updated_at set default now();

alter table public.phone_numbers
  add constraint phone_numbers_status_check
    check (status in ('pending', 'reserved', 'active', 'ported', 'released', 'failed')),
  add constraint phone_numbers_forwarding_type_check
    check (forwarding_type in ('flynn_number', 'call_forwarding', 'ported', 'sip_trunk')),
  add constraint phone_numbers_verification_state_check
    check (verification_state in ('unverified', 'verifying', 'verified', 'failed'));

create index if not exists phone_numbers_org_idx on public.phone_numbers(org_id);
create index if not exists phone_numbers_status_idx on public.phone_numbers(status);
create index if not exists phone_numbers_call_flow_idx on public.phone_numbers(call_flow_id);

drop trigger if exists touch_phone_numbers_updated_at on public.phone_numbers;
create trigger touch_phone_numbers_updated_at
  before update on public.phone_numbers
  for each row
  execute function public.touch_updated_at();

create table if not exists public.receptionist_configs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null unique references public.organizations(id) on delete cascade,
  voice_profile_id uuid references public.voice_profiles(id) on delete set null,
  greeting_script text,
  intake_questions jsonb not null default '[]'::jsonb,
  summary_delivery text not null default 'push'
    check (summary_delivery in ('push', 'email', 'sms')),
  fallback_email text,
  fallback_sms_number text,
  timezone text not null default 'UTC',
  auto_collect_website boolean not null default true,
  handoff_number text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists touch_receptionist_configs_updated_at on public.receptionist_configs;
create trigger touch_receptionist_configs_updated_at
  before update on public.receptionist_configs
  for each row
  execute function public.touch_updated_at();

create table if not exists public.call_events (
  id bigserial primary key,
  org_id uuid not null references public.organizations(id) on delete cascade,
  number_id uuid references public.phone_numbers(id) on delete set null,
  call_sid text not null references public.calls(call_sid) on delete cascade,
  event_type text not null,
  direction text check (direction in ('inbound', 'outbound')),
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists call_events_org_idx on public.call_events(org_id, occurred_at desc);
create index if not exists call_events_call_sid_idx on public.call_events(call_sid);

create table if not exists public.telephony_health_checks (
  id bigserial primary key,
  org_id uuid not null references public.organizations(id) on delete cascade,
  number_id uuid references public.phone_numbers(id) on delete cascade,
  check_type text not null,
  status text not null check (status in ('passing', 'warning', 'failing')),
  details jsonb not null default '{}'::jsonb,
  checked_at timestamptz not null default now()
);

create index if not exists telephony_health_checks_org_idx
  on public.telephony_health_checks(org_id, check_type);

-- Membership helper functions used by RLS.
create or replace function public.is_org_member(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.org_members m
    where m.org_id = target_org
      and m.user_id = auth.uid()
      and m.status = 'active'
  );
$$;

create or replace function public.is_org_admin(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.org_members m
    where m.org_id = target_org
      and m.user_id = auth.uid()
      and m.status = 'active'
      and m.role in ('owner', 'admin')
  );
$$;

grant execute on function public.is_org_member(uuid) to anon, authenticated, service_role;
grant execute on function public.is_org_admin(uuid) to anon, authenticated, service_role;

-- Enable RLS for new tables.
alter table public.organizations enable row level security;
alter table public.organizations force row level security;

drop policy if exists "Organizations select" on public.organizations;
create policy "Organizations select"
  on public.organizations
  for select
  using (
    auth.role() = 'service_role'
    or created_by = auth.uid()
    or public.is_org_member(id)
  );

drop policy if exists "Organizations insert" on public.organizations;
create policy "Organizations insert"
  on public.organizations
  for insert
  with check (
    auth.role() = 'service_role'
    or created_by = auth.uid()
  );

drop policy if exists "Organizations update" on public.organizations;
create policy "Organizations update"
  on public.organizations
  for update
  using (
    auth.role() = 'service_role'
    or public.is_org_admin(id)
  )
  with check (
    auth.role() = 'service_role'
    or public.is_org_admin(id)
  );

drop policy if exists "Organizations delete" on public.organizations;
create policy "Organizations delete"
  on public.organizations
  for delete
  using (
    auth.role() = 'service_role'
    or public.is_org_admin(id)
  );

alter table public.org_members enable row level security;
alter table public.org_members force row level security;

drop policy if exists "Org members select" on public.org_members;
create policy "Org members select"
  on public.org_members
  for select
  using (
    auth.role() = 'service_role'
    or public.is_org_member(org_id)
    or user_id = auth.uid()
  );

drop policy if exists "Org members insert" on public.org_members;
create policy "Org members insert"
  on public.org_members
  for insert
  with check (
    auth.role() = 'service_role'
    or public.is_org_admin(org_id)
    or (user_id = auth.uid() and status = 'pending')
  );

drop policy if exists "Org members update" on public.org_members;
create policy "Org members update"
  on public.org_members
  for update
  using (
    auth.role() = 'service_role'
    or public.is_org_admin(org_id)
    or user_id = auth.uid()
  )
  with check (
    auth.role() = 'service_role'
    or public.is_org_admin(org_id)
    or user_id = auth.uid()
  );

drop policy if exists "Org members delete" on public.org_members;
create policy "Org members delete"
  on public.org_members
  for delete
  using (
    auth.role() = 'service_role'
    or public.is_org_admin(org_id)
    or user_id = auth.uid()
  );

alter table public.business_profiles enable row level security;
alter table public.business_profiles force row level security;

drop policy if exists "Business profiles access" on public.business_profiles;
create policy "Business profiles access"
  on public.business_profiles
  for all
  using (
    auth.role() = 'service_role'
    or public.is_org_member(org_id)
  )
  with check (
    auth.role() = 'service_role'
    or public.is_org_member(org_id)
  );

alter table public.website_ingests enable row level security;
alter table public.website_ingests force row level security;

drop policy if exists "Website ingests access" on public.website_ingests;
create policy "Website ingests access"
  on public.website_ingests
  for all
  using (
    auth.role() = 'service_role'
    or public.is_org_member(org_id)
  )
  with check (
    auth.role() = 'service_role'
    or public.is_org_member(org_id)
  );

alter table public.onboarding_sessions enable row level security;
alter table public.onboarding_sessions force row level security;

drop policy if exists "Onboarding sessions access" on public.onboarding_sessions;
create policy "Onboarding sessions access"
  on public.onboarding_sessions
  for all
  using (
    auth.role() = 'service_role'
    or user_id = auth.uid()
    or (org_id is not null and public.is_org_member(org_id))
  )
  with check (
    auth.role() = 'service_role'
    or user_id = auth.uid()
    or (org_id is not null and public.is_org_member(org_id))
  );

alter table public.call_flows enable row level security;
alter table public.call_flows force row level security;

drop policy if exists "Call flows access" on public.call_flows;
create policy "Call flows access"
  on public.call_flows
  for all
  using (
    auth.role() = 'service_role'
    or public.is_org_member(org_id)
  )
  with check (
    auth.role() = 'service_role'
    or public.is_org_member(org_id)
  );

alter table public.phone_numbers enable row level security;
alter table public.phone_numbers force row level security;

drop policy if exists "Phone numbers access" on public.phone_numbers;
create policy "Phone numbers access"
  on public.phone_numbers
  for all
  using (
    auth.role() = 'service_role'
    or public.is_org_member(org_id)
  )
  with check (
    auth.role() = 'service_role'
    or public.is_org_member(org_id)
  );

alter table public.receptionist_configs enable row level security;
alter table public.receptionist_configs force row level security;

drop policy if exists "Receptionist configs access" on public.receptionist_configs;
create policy "Receptionist configs access"
  on public.receptionist_configs
  for all
  using (
    auth.role() = 'service_role'
    or public.is_org_member(org_id)
  )
  with check (
    auth.role() = 'service_role'
    or public.is_org_member(org_id)
  );

alter table public.call_events enable row level security;
alter table public.call_events force row level security;

drop policy if exists "Call events access" on public.call_events;
create policy "Call events access"
  on public.call_events
  for all
  using (
    auth.role() = 'service_role'
    or public.is_org_member(org_id)
  )
  with check (
    auth.role() = 'service_role'
    or public.is_org_member(org_id)
  );

alter table public.telephony_health_checks enable row level security;
alter table public.telephony_health_checks force row level security;

drop policy if exists "Telephony health access" on public.telephony_health_checks;
create policy "Telephony health access"
  on public.telephony_health_checks
  for all
  using (
    auth.role() = 'service_role'
    or public.is_org_member(org_id)
  )
  with check (
    auth.role() = 'service_role'
    or public.is_org_member(org_id)
  );

-- Extend existing tables with organization context.
alter table public.calls
  add column if not exists org_id uuid references public.organizations(id) on delete set null;

create index if not exists calls_org_id_idx on public.calls(org_id);

alter table public.transcriptions
  add column if not exists org_id uuid references public.organizations(id) on delete set null;

create index if not exists transcriptions_org_id_idx on public.transcriptions(org_id);

alter table public.jobs
  add column if not exists org_id uuid references public.organizations(id) on delete set null,
  add column if not exists event_payload jsonb not null default '{}'::jsonb;

create index if not exists jobs_org_id_idx on public.jobs(org_id);

alter table public.voice_profiles
  add column if not exists org_id uuid references public.organizations(id) on delete cascade;

create index if not exists voice_profiles_org_id_idx on public.voice_profiles(org_id);

alter table public.notification_tokens
  add column if not exists org_id uuid references public.organizations(id) on delete cascade;

create index if not exists notification_tokens_org_id_idx on public.notification_tokens(org_id);

alter table public.users
  add column if not exists default_org_id uuid references public.organizations(id) on delete set null;

create index if not exists users_default_org_id_idx on public.users(default_org_id);

-- Update existing RLS policies to honor organization membership.
drop policy if exists "Calls owner select" on public.calls;
create policy "Calls owner or org select"
  on public.calls
  for select
  using (
    auth.role() = 'service_role'
    or user_id = auth.uid()
    or (org_id is not null and public.is_org_member(org_id))
  );

drop policy if exists "Calls owner insert" on public.calls;
create policy "Calls owner or org insert"
  on public.calls
  for insert
  with check (
    auth.role() = 'service_role'
    or user_id = auth.uid()
    or (org_id is not null and public.is_org_member(org_id))
  );

drop policy if exists "Calls owner update" on public.calls;
create policy "Calls owner or org update"
  on public.calls
  for update
  using (
    auth.role() = 'service_role'
    or user_id = auth.uid()
    or (org_id is not null and public.is_org_member(org_id))
  )
  with check (
    auth.role() = 'service_role'
    or user_id = auth.uid()
    or (org_id is not null and public.is_org_member(org_id))
  );

drop policy if exists "Calls owner delete" on public.calls;
create policy "Calls owner or org delete"
  on public.calls
  for delete
  using (
    auth.role() = 'service_role'
    or user_id = auth.uid()
    or (org_id is not null and public.is_org_member(org_id))
  );

drop policy if exists "Transcriptions owner select" on public.transcriptions;
create policy "Transcriptions owner or org select"
  on public.transcriptions
  for select
  using (
    auth.role() = 'service_role'
    or user_id = auth.uid()
    or (org_id is not null and public.is_org_member(org_id))
  );

drop policy if exists "Transcriptions owner insert" on public.transcriptions;
create policy "Transcriptions owner or org insert"
  on public.transcriptions
  for insert
  with check (
    auth.role() = 'service_role'
    or user_id = auth.uid()
    or (org_id is not null and public.is_org_member(org_id))
  );

drop policy if exists "Transcriptions owner update" on public.transcriptions;
create policy "Transcriptions owner or org update"
  on public.transcriptions
  for update
  using (
    auth.role() = 'service_role'
    or user_id = auth.uid()
    or (org_id is not null and public.is_org_member(org_id))
  )
  with check (
    auth.role() = 'service_role'
    or user_id = auth.uid()
    or (org_id is not null and public.is_org_member(org_id))
  );

drop policy if exists "Transcriptions owner delete" on public.transcriptions;
create policy "Transcriptions owner or org delete"
  on public.transcriptions
  for delete
  using (
    auth.role() = 'service_role'
    or user_id = auth.uid()
    or (org_id is not null and public.is_org_member(org_id))
  );

drop policy if exists "Jobs owner select" on public.jobs;
create policy "Jobs owner or org select"
  on public.jobs
  for select
  using (
    auth.role() = 'service_role'
    or user_id = auth.uid()
    or (org_id is not null and public.is_org_member(org_id))
  );

drop policy if exists "Jobs owner insert" on public.jobs;
create policy "Jobs owner or org insert"
  on public.jobs
  for insert
  with check (
    auth.role() = 'service_role'
    or user_id = auth.uid()
    or (org_id is not null and public.is_org_member(org_id))
  );

drop policy if exists "Jobs owner update" on public.jobs;
create policy "Jobs owner or org update"
  on public.jobs
  for update
  using (
    auth.role() = 'service_role'
    or user_id = auth.uid()
    or (org_id is not null and public.is_org_member(org_id))
  )
  with check (
    auth.role() = 'service_role'
    or user_id = auth.uid()
    or (org_id is not null and public.is_org_member(org_id))
  );

drop policy if exists "Jobs owner delete" on public.jobs;
create policy "Jobs owner or org delete"
  on public.jobs
  for delete
  using (
    auth.role() = 'service_role'
    or user_id = auth.uid()
    or (org_id is not null and public.is_org_member(org_id))
  );

-- Notification tokens remain user-scoped but align with org context when available.
drop policy if exists "Notification tokens select" on public.notification_tokens;
create policy "Notification tokens select"
  on public.notification_tokens
  for select
  using (
    auth.role() = 'service_role'
    or user_id = auth.uid()
  );

drop policy if exists "Notification tokens insert" on public.notification_tokens;
create policy "Notification tokens insert"
  on public.notification_tokens
  for insert
  with check (
    auth.role() = 'service_role'
    or user_id = auth.uid()
  );

drop policy if exists "Notification tokens update" on public.notification_tokens;
create policy "Notification tokens update"
  on public.notification_tokens
  for update
  using (
    auth.role() = 'service_role'
    or user_id = auth.uid()
  )
  with check (
    auth.role() = 'service_role'
    or user_id = auth.uid()
  );

drop policy if exists "Notification tokens delete" on public.notification_tokens;
create policy "Notification tokens delete"
  on public.notification_tokens
  for delete
  using (
    auth.role() = 'service_role'
    or user_id = auth.uid()
  );

-- Backfill helper: align existing users with default orgs when inserted via trigger.
create or replace function public.set_default_org_on_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'active' and new.role in ('owner', 'admin') then
    update public.users
       set default_org_id = new.org_id
     where id = new.user_id
       and (default_org_id is null or default_org_id = new.org_id);
  end if;
  return new;
end;
$$;

drop trigger if exists set_default_org_on_membership on public.org_members;
create trigger set_default_org_on_membership
  after insert on public.org_members
  for each row
  execute function public.set_default_org_on_membership();
