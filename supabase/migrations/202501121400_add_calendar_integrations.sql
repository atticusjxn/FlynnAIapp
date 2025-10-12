-- Add calendar integration support for Google Calendar and Apple Calendar
-- Enables AI receptionist to check availability and suggest appropriate appointment times

-- Create calendar_integrations table to store OAuth tokens and sync settings
create table if not exists public.calendar_integrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  provider text not null check (provider in ('google', 'apple', 'outlook')),
  calendar_id text not null, -- External calendar ID from provider
  access_token text, -- Encrypted OAuth access token
  refresh_token text, -- Encrypted OAuth refresh token
  token_expires_at timestamptz, -- When access token expires
  is_active boolean default true, -- Whether this integration is currently syncing
  sync_enabled boolean default true, -- User preference to enable/disable sync
  last_synced_at timestamptz, -- Last successful sync timestamp
  sync_error text, -- Last sync error message if any
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Add indexes for efficient queries
create index if not exists calendar_integrations_user_id_idx
  on public.calendar_integrations(user_id);

create unique index if not exists calendar_integrations_user_provider_idx
  on public.calendar_integrations(user_id, provider, calendar_id);

-- Enable RLS
alter table public.calendar_integrations enable row level security;
alter table public.calendar_integrations force row level security;

-- RLS policies
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

-- Add external_event_id to calendar_events for deduplication
alter table public.calendar_events
  add column if not exists external_event_id text,
  add column if not exists integration_id uuid references public.calendar_integrations(id) on delete cascade,
  add column if not exists source text default 'flynn' check (source in ('flynn', 'google', 'apple', 'outlook'));

-- Add index for external event lookup
create index if not exists calendar_events_external_id_idx
  on public.calendar_events(external_event_id)
  where external_event_id is not null;

create index if not exists calendar_events_integration_id_idx
  on public.calendar_events(integration_id)
  where integration_id is not null;

-- Add unique constraint to prevent duplicate external events
create unique index if not exists calendar_events_external_unique_idx
  on public.calendar_events(integration_id, external_event_id)
  where external_event_id is not null and integration_id is not null;

-- Add columns to users table for calendar preferences
alter table public.users
  add column if not exists calendar_sync_enabled boolean default true,
  add column if not exists default_event_duration_minutes integer default 60,
  add column if not exists business_hours_start time default '09:00:00',
  add column if not exists business_hours_end time default '17:00:00';

-- Comment on tables and columns for clarity
comment on table public.calendar_integrations is 'Stores OAuth credentials and sync state for external calendar integrations (Google, Apple, Outlook)';
comment on column public.calendar_integrations.access_token is 'Encrypted OAuth access token for API calls';
comment on column public.calendar_integrations.refresh_token is 'Encrypted OAuth refresh token for renewing access';
comment on column public.calendar_events.external_event_id is 'ID from external calendar provider for synced events';
comment on column public.calendar_events.source is 'Where this event originated: flynn (created in app), google, apple, or outlook';
comment on column public.users.calendar_sync_enabled is 'Global toggle for calendar sync functionality';
comment on column public.users.business_hours_start is 'Default business hours start time for availability calculations';
comment on column public.users.business_hours_end is 'Default business hours end time for availability calculations';
