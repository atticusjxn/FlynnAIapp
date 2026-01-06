-- Migration: Create Automated Reminders System
-- Created: 2025-01-18

-- ============================================================================
-- 1. Create reminder_settings table
-- ============================================================================

create table if not exists public.reminder_settings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null unique references public.organizations(id) on delete cascade,

  -- Master toggles
  enabled boolean not null default true,
  default_enabled boolean not null default true,

  -- Pre-job reminder configuration
  confirmation_enabled boolean not null default true,
  one_day_before_enabled boolean not null default true,
  one_day_before_time time not null default '18:00',
  morning_of_enabled boolean not null default false,
  morning_of_time time not null default '08:00',
  two_hours_before_enabled boolean not null default false,

  -- Custom reminders (JSONB array)
  custom_reminders jsonb not null default '[]'::jsonb,

  -- Advanced options
  skip_weekends_for_morning boolean not null default false,
  respect_quiet_hours boolean not null default true,
  quiet_hours_start time not null default '21:00',
  quiet_hours_end time not null default '08:00',

  -- Post-job follow-up
  post_job_enabled boolean not null default false,
  post_job_delay_hours integer not null default 2,

  -- Message templates
  confirmation_template text not null default 'Hi {{clientName}}! Your {{serviceType}} appointment is confirmed for {{date}} at {{time}} at {{location}}. Reply YES to confirm.',
  one_day_before_template text not null default 'Hi {{clientName}}! Reminder: We''ll see you tomorrow at {{time}} for {{serviceType}} at {{location}}.',
  morning_of_template text not null default 'Good morning {{clientName}}! We''re looking forward to seeing you today at {{time}} for {{serviceType}}.',
  two_hours_before_template text not null default 'Hi {{clientName}}! We''ll be there in about 2 hours for your {{serviceType}} appointment.',
  on_the_way_template text not null default 'Hi {{clientName}}! We''re on our way to your location. We''ll arrive in approximately {{eta}} minutes.',
  post_job_template text not null default 'Thanks for choosing {{businessName}}! Your job is complete. We''d love your feedback!',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Index for quick org lookup
create index if not exists idx_reminder_settings_org_id on public.reminder_settings(org_id);

-- Enable Row Level Security
alter table public.reminder_settings enable row level security;

-- RLS Policies for reminder_settings
create policy "Users can view their org's reminder settings"
  on public.reminder_settings for select
  using (
    org_id in (
      select org_id from public.user_organizations
      where user_id = auth.uid()
    )
  );

create policy "Users can update their org's reminder settings"
  on public.reminder_settings for update
  using (
    org_id in (
      select org_id from public.user_organizations
      where user_id = auth.uid()
    )
  );

create policy "Users can insert their org's reminder settings"
  on public.reminder_settings for insert
  with check (
    org_id in (
      select org_id from public.user_organizations
      where user_id = auth.uid()
    )
  );

-- ============================================================================
-- 2. Create scheduled_reminders table
-- ============================================================================

create table if not exists public.scheduled_reminders (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,

  -- Reminder details
  reminder_type text not null check (reminder_type in (
    'confirmation',
    'one_day_before',
    'morning_of',
    'two_hours_before',
    'custom',
    'on_the_way',
    'post_job'
  )),

  custom_reminder_id uuid,  -- Reference to custom reminder definition

  -- Scheduling
  scheduled_for timestamptz not null,
  executed_at timestamptz,

  -- Status
  status text not null default 'pending' check (status in (
    'pending',
    'sent',
    'failed',
    'cancelled',
    'skipped'
  )),

  -- Message details
  message_template text not null,
  message_sent text,  -- Actual message sent (with variables replaced)

  -- Delivery details
  recipient_phone text not null,
  twilio_sid text,  -- Twilio message SID for tracking

  -- Error handling
  error_message text,
  retry_count integer not null default 0,
  max_retries integer not null default 3,

  -- Metadata
  metadata jsonb default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes for efficient querying
create index if not exists idx_scheduled_reminders_org_job
  on public.scheduled_reminders(org_id, job_id);

create index if not exists idx_scheduled_reminders_scheduled_for
  on public.scheduled_reminders(scheduled_for)
  where status = 'pending';

create index if not exists idx_scheduled_reminders_status
  on public.scheduled_reminders(status);

create index if not exists idx_scheduled_reminders_job_id
  on public.scheduled_reminders(job_id);

-- Enable Row Level Security
alter table public.scheduled_reminders enable row level security;

-- RLS Policies for scheduled_reminders
create policy "Users can view their org's reminders"
  on public.scheduled_reminders for select
  using (
    org_id in (
      select org_id from public.user_organizations
      where user_id = auth.uid()
    )
  );

create policy "Users can insert their org's reminders"
  on public.scheduled_reminders for insert
  with check (
    org_id in (
      select org_id from public.user_organizations
      where user_id = auth.uid()
    )
  );

create policy "Users can update their org's reminders"
  on public.scheduled_reminders for update
  using (
    org_id in (
      select org_id from public.user_organizations
      where user_id = auth.uid()
    )
  );

create policy "Users can delete their org's reminders"
  on public.scheduled_reminders for delete
  using (
    org_id in (
      select org_id from public.user_organizations
      where user_id = auth.uid()
    )
  );

-- ============================================================================
-- 3. Create reminder_history table
-- ============================================================================

create table if not exists public.reminder_history (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  job_id uuid references public.jobs(id) on delete set null,
  reminder_id uuid references public.scheduled_reminders(id) on delete set null,

  -- Event tracking
  event_type text not null check (event_type in (
    'scheduled',
    'sent',
    'delivered',
    'failed',
    'cancelled',
    'client_replied'
  )),

  message text,
  recipient_phone text,
  twilio_sid text,

  -- Client interaction
  client_response text,
  client_response_at timestamptz,

  created_at timestamptz not null default now()
);

-- Index for history lookup
create index if not exists idx_reminder_history_org_job
  on public.reminder_history(org_id, job_id);

create index if not exists idx_reminder_history_reminder_id
  on public.reminder_history(reminder_id);

-- Enable Row Level Security
alter table public.reminder_history enable row level security;

-- RLS Policies for reminder_history
create policy "Users can view their org's reminder history"
  on public.reminder_history for select
  using (
    org_id in (
      select org_id from public.user_organizations
      where user_id = auth.uid()
    )
  );

create policy "Users can insert their org's reminder history"
  on public.reminder_history for insert
  with check (
    org_id in (
      select org_id from public.user_organizations
      where user_id = auth.uid()
    )
  );

-- ============================================================================
-- 4. Add reminder fields to jobs table
-- ============================================================================

alter table public.jobs
  add column if not exists reminders_enabled boolean not null default true,
  add column if not exists client_confirmed boolean default false,
  add column if not exists client_confirmed_at timestamptz,
  add column if not exists last_reminder_sent_at timestamptz,
  add column if not exists reminder_count integer not null default 0;

-- ============================================================================
-- 5. Create function to auto-update updated_at timestamp
-- ============================================================================

create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Add triggers for updated_at columns
drop trigger if exists update_reminder_settings_updated_at on public.reminder_settings;
create trigger update_reminder_settings_updated_at
  before update on public.reminder_settings
  for each row
  execute function update_updated_at_column();

drop trigger if exists update_scheduled_reminders_updated_at on public.scheduled_reminders;
create trigger update_scheduled_reminders_updated_at
  before update on public.scheduled_reminders
  for each row
  execute function update_updated_at_column();

-- ============================================================================
-- 6. Grant permissions (if needed)
-- ============================================================================

-- Grant service role full access for backend operations
grant all on public.reminder_settings to service_role;
grant all on public.scheduled_reminders to service_role;
grant all on public.reminder_history to service_role;

-- Grant authenticated users appropriate access
grant select, insert, update on public.reminder_settings to authenticated;
grant select, insert, update, delete on public.scheduled_reminders to authenticated;
grant select, insert on public.reminder_history to authenticated;

-- ============================================================================
-- Migration complete
-- ============================================================================

-- Verify tables were created
do $$
begin
  if exists (select 1 from information_schema.tables where table_name = 'reminder_settings') then
    raise notice 'SUCCESS: reminder_settings table created';
  end if;

  if exists (select 1 from information_schema.tables where table_name = 'scheduled_reminders') then
    raise notice 'SUCCESS: scheduled_reminders table created';
  end if;

  if exists (select 1 from information_schema.tables where table_name = 'reminder_history') then
    raise notice 'SUCCESS: reminder_history table created';
  end if;
end $$;
