-- Fix calendar_integrations table if it exists with wrong schema
-- This handles the case where the table was created but doesn't match our expected schema

-- Drop the existing table if it doesn't have the right columns
do $$
begin
  -- Check if table exists but doesn't have provider column
  if exists (
    select from information_schema.tables
    where table_schema = 'public' and table_name = 'calendar_integrations'
  ) and not exists (
    select from information_schema.columns
    where table_schema = 'public' and table_name = 'calendar_integrations' and column_name = 'provider'
  ) then
    -- Drop and recreate with correct schema
    drop table if exists public.calendar_integrations cascade;
    raise notice 'Dropped incorrect calendar_integrations table';
  end if;
end $$;

-- Now create the correct table structure
create table if not exists public.calendar_integrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  provider text not null check (provider in ('google', 'apple', 'outlook')),
  calendar_id text not null,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  is_active boolean default true,
  sync_enabled boolean default true,
  last_synced_at timestamptz,
  sync_error text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Create indexes
create index if not exists calendar_integrations_user_id_idx
  on public.calendar_integrations(user_id);

create unique index if not exists calendar_integrations_user_provider_idx
  on public.calendar_integrations(user_id, provider, calendar_id);

-- Enable RLS
alter table public.calendar_integrations enable row level security;
alter table public.calendar_integrations force row level security;

-- Create RLS policy
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'calendar_integrations'
      and policyname = 'Users manage own calendar integrations'
  ) then
    create policy "Users manage own calendar integrations"
      on public.calendar_integrations
      for all
      using (user_id = auth.uid())
      with check (user_id = auth.uid());
  end if;
end $$;

-- Add trigger for updated_at
drop trigger if exists calendar_integrations_set_updated_at on public.calendar_integrations;
create trigger calendar_integrations_set_updated_at
  before update on public.calendar_integrations
  for each row execute function public.set_updated_at();

-- Update calendar_events table
alter table public.calendar_events
  add column if not exists external_event_id text,
  add column if not exists integration_id uuid,
  add column if not exists source text default 'flynn' check (source in ('flynn', 'google', 'apple', 'outlook'));

-- Add foreign key constraint if it doesn't exist
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'calendar_events_integration_id_fkey'
  ) then
    alter table public.calendar_events
      add constraint calendar_events_integration_id_fkey
      foreign key (integration_id) references public.calendar_integrations(id) on delete cascade;
  end if;
end $$;

-- Create indexes on calendar_events
create index if not exists calendar_events_external_id_idx
  on public.calendar_events(external_event_id)
  where external_event_id is not null;

create index if not exists calendar_events_integration_id_idx
  on public.calendar_events(integration_id)
  where integration_id is not null;

-- Add unique constraint for external events
drop index if exists calendar_events_external_unique_idx;
create unique index calendar_events_external_unique_idx
  on public.calendar_events(integration_id, external_event_id)
  where external_event_id is not null and integration_id is not null;

-- Add user preferences for calendar
alter table public.users
  add column if not exists calendar_sync_enabled boolean default true,
  add column if not exists default_event_duration_minutes integer default 60,
  add column if not exists business_hours_start time default '09:00:00',
  add column if not exists business_hours_end time default '17:00:00';

-- Comments
comment on table public.calendar_integrations is 'Stores OAuth credentials and sync state for external calendar integrations';
comment on column public.calendar_integrations.access_token is 'Encrypted OAuth access token for API calls';
comment on column public.calendar_integrations.refresh_token is 'Encrypted OAuth refresh token for renewing access';
