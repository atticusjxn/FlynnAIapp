-- Align public.users profile schema with mobile app expectations
create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.ensure_created_at()
returns trigger
language plpgsql
as $$
begin
  if new.created_at is null then
    new.created_at = now();
  end if;
  if new.updated_at is null then
    new.updated_at = now();
  end if;
  return new;
end;
$$;

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  business_name text default ''::text,
  business_type text,
  business_goals jsonb default '[]'::jsonb,
  phone text,
  phone_number text,
  country_code text,
  address jsonb,
  onboarding_complete boolean default false,
  phone_setup_complete boolean default false,
  forwarding_active boolean default false,
  call_features_enabled boolean default false,
  recording_preference text default 'manual',
  twilio_phone_number text,
  twilio_number_sid text,
  settings jsonb default '{}'::jsonb,
  receptionist_configured boolean default false,
  receptionist_voice text,
  receptionist_greeting text,
  receptionist_questions jsonb default '[]'::jsonb,
  receptionist_voice_profile_id uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.users
  add column if not exists email text,
  add column if not exists business_name text default ''::text,
  add column if not exists business_type text,
  add column if not exists business_goals jsonb default '[]'::jsonb,
  add column if not exists phone text,
  add column if not exists phone_number text,
  add column if not exists country_code text,
  add column if not exists address jsonb,
  add column if not exists onboarding_complete boolean default false,
  add column if not exists phone_setup_complete boolean default false,
  add column if not exists forwarding_active boolean default false,
  add column if not exists call_features_enabled boolean default false,
  add column if not exists recording_preference text default 'manual',
  add column if not exists twilio_phone_number text,
  add column if not exists twilio_number_sid text,
  add column if not exists settings jsonb default '{}'::jsonb,
  add column if not exists receptionist_configured boolean default false,
  add column if not exists receptionist_voice text,
  add column if not exists receptionist_greeting text,
  add column if not exists receptionist_questions jsonb default '[]'::jsonb,
  add column if not exists receptionist_voice_profile_id uuid,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'users'
      and column_name = 'business_goals'
      and data_type <> 'jsonb'
  ) then
    execute 'alter table public.users alter column business_goals drop default';
    execute 'alter table public.users alter column business_goals type jsonb using to_jsonb(business_goals)';
    execute 'alter table public.users alter column business_goals set default ''[]''::jsonb';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'users'
      and column_name = 'settings'
      and data_type <> 'jsonb'
  ) then
    execute 'alter table public.users alter column settings drop default';
    execute 'alter table public.users alter column settings type jsonb using to_jsonb(settings)';
    execute 'alter table public.users alter column settings set default ''{}''::jsonb';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'users'
      and column_name = 'receptionist_questions'
      and data_type <> 'jsonb'
  ) then
    execute 'alter table public.users alter column receptionist_questions drop default';
    execute 'alter table public.users alter column receptionist_questions type jsonb using to_jsonb(receptionist_questions)';
    execute 'alter table public.users alter column receptionist_questions set default ''[]''::jsonb';
  end if;
end
$$;

update public.users
set business_name = coalesce(business_name, ''),
    business_goals = coalesce(business_goals, '[]'::jsonb),
    onboarding_complete = coalesce(onboarding_complete, false),
    phone_setup_complete = coalesce(phone_setup_complete, false),
    forwarding_active = coalesce(forwarding_active, false),
    call_features_enabled = coalesce(call_features_enabled, false),
    recording_preference = coalesce(recording_preference, 'manual'),
    settings = coalesce(settings, '{}'::jsonb),
    receptionist_configured = coalesce(receptionist_configured, false),
    receptionist_questions = coalesce(receptionist_questions, '[]'::jsonb),
    created_at = coalesce(created_at, now()),
    updated_at = now();

create unique index if not exists users_twilio_phone_number_unique
  on public.users (twilio_phone_number)
  where twilio_phone_number is not null;

create unique index if not exists users_twilio_number_sid_unique
  on public.users (twilio_number_sid)
  where twilio_number_sid is not null;

alter table public.users enable row level security;
alter table public.users force row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'users' and policyname = 'Users select own row'
  ) then
    create policy "Users select own row"
      on public.users for select
      using (id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'users' and policyname = 'Users update own row'
  ) then
    create policy "Users update own row"
      on public.users for update
      using (id = auth.uid())
      with check (id = auth.uid());
  end if;
end
$$;

drop trigger if exists users_set_updated_at on public.users;
create trigger users_set_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

drop trigger if exists users_ensure_created_at on public.users;
create trigger users_ensure_created_at
  before insert on public.users
  for each row execute function public.ensure_created_at();

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  phone text,
  email text,
  address text,
  notes text,
  business_type text,
  preferred_contact_method text,
  last_job_type text,
  last_job_date timestamptz,
  total_jobs integer,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.clients
  add column if not exists user_id uuid,
  add column if not exists name text,
  add column if not exists phone text,
  add column if not exists email text,
  add column if not exists address text,
  add column if not exists notes text,
  add column if not exists business_type text,
  add column if not exists preferred_contact_method text,
  add column if not exists last_job_type text,
  add column if not exists last_job_date timestamptz,
  add column if not exists total_jobs integer,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

update public.clients
set created_at = coalesce(created_at, now()),
    updated_at = now(),
    preferred_contact_method = case
      when preferred_contact_method in ('phone','text','email') then preferred_contact_method
      else null
    end;

alter table public.clients
  drop constraint if exists clients_preferred_contact_method_check;

alter table public.clients
  add constraint clients_preferred_contact_method_check
    check (preferred_contact_method is null or preferred_contact_method in ('phone','text','email'));

create index if not exists clients_user_id_idx on public.clients(user_id);
create index if not exists clients_phone_idx on public.clients(phone);

alter table public.clients enable row level security;
alter table public.clients force row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'clients' and policyname = 'Clients select own rows'
  ) then
    create policy "Clients select own rows"
      on public.clients for select
      using (user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'clients' and policyname = 'Clients insert own rows'
  ) then
    create policy "Clients insert own rows"
      on public.clients for insert
      with check (user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'clients' and policyname = 'Clients update own rows'
  ) then
    create policy "Clients update own rows"
      on public.clients for update
      using (user_id = auth.uid())
      with check (user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'clients' and policyname = 'Clients delete own rows'
  ) then
    create policy "Clients delete own rows"
      on public.clients for delete
      using (user_id = auth.uid());
  end if;
end
$$;

drop trigger if exists clients_set_updated_at on public.clients;
create trigger clients_set_updated_at
  before update on public.clients
  for each row execute function public.set_updated_at();

drop trigger if exists clients_ensure_created_at on public.clients;
create trigger clients_ensure_created_at
  before insert on public.clients
  for each row execute function public.ensure_created_at();

create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  job_id uuid references public.jobs(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  title text not null,
  description text,
  location text,
  start_time timestamptz,
  end_time timestamptz,
  reminder_minutes integer,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists calendar_events_user_id_idx on public.calendar_events(user_id);
create index if not exists calendar_events_job_id_idx on public.calendar_events(job_id);
create index if not exists calendar_events_client_id_idx on public.calendar_events(client_id);

alter table public.calendar_events enable row level security;
alter table public.calendar_events force row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'calendar_events' and policyname = 'Calendar events select own rows'
  ) then
    create policy "Calendar events select own rows"
      on public.calendar_events for select
      using (user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'calendar_events' and policyname = 'Calendar events insert own rows'
  ) then
    create policy "Calendar events insert own rows"
      on public.calendar_events for insert
      with check (user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'calendar_events' and policyname = 'Calendar events update own rows'
  ) then
    create policy "Calendar events update own rows"
      on public.calendar_events for update
      using (user_id = auth.uid())
      with check (user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'calendar_events' and policyname = 'Calendar events delete own rows'
  ) then
    create policy "Calendar events delete own rows"
      on public.calendar_events for delete
      using (user_id = auth.uid());
  end if;
end
$$;

drop trigger if exists calendar_events_set_updated_at on public.calendar_events;
create trigger calendar_events_set_updated_at
  before update on public.calendar_events
  for each row execute function public.set_updated_at();

drop trigger if exists calendar_events_ensure_created_at on public.calendar_events;
create trigger calendar_events_ensure_created_at
  before insert on public.calendar_events
  for each row execute function public.ensure_created_at();

create table if not exists public.communication_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  communication_type text not null,
  content text,
  status text,
  recipient text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.communication_logs
  drop constraint if exists communication_logs_type_check;

alter table public.communication_logs
  add constraint communication_logs_type_check
    check (communication_type in ('email','sms','call'));

create index if not exists communication_logs_user_id_idx on public.communication_logs(user_id);
create index if not exists communication_logs_client_id_idx on public.communication_logs(client_id);

alter table public.communication_logs enable row level security;
alter table public.communication_logs force row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'communication_logs' and policyname = 'Communication logs select own rows'
  ) then
    create policy "Communication logs select own rows"
      on public.communication_logs for select
      using (user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'communication_logs' and policyname = 'Communication logs insert own rows'
  ) then
    create policy "Communication logs insert own rows"
      on public.communication_logs for insert
      with check (user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'communication_logs' and policyname = 'Communication logs update own rows'
  ) then
    create policy "Communication logs update own rows"
      on public.communication_logs for update
      using (user_id = auth.uid())
      with check (user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'communication_logs' and policyname = 'Communication logs delete own rows'
  ) then
    create policy "Communication logs delete own rows"
      on public.communication_logs for delete
      using (user_id = auth.uid());
  end if;
end
$$;

drop trigger if exists communication_logs_set_updated_at on public.communication_logs;
create trigger communication_logs_set_updated_at
  before update on public.communication_logs
  for each row execute function public.set_updated_at();

drop trigger if exists communication_logs_ensure_created_at on public.communication_logs;
create trigger communication_logs_ensure_created_at
  before insert on public.communication_logs
  for each row execute function public.ensure_created_at();

create table if not exists public.calls (
  call_sid text primary key,
  user_id uuid,
  from_number text,
  to_number text,
  recording_url text,
  duration_sec integer,
  recorded_at timestamptz,
  transcription_status text,
  transcription_updated_at timestamptz
);

alter table public.calls
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists duration integer,
  add column if not exists transcription_text text,
  add column if not exists job_extracted jsonb,
  add column if not exists job_id uuid references public.jobs(id) on delete set null,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

update public.calls
set id = coalesce(id, gen_random_uuid()),
    created_at = coalesce(created_at, recorded_at, now()),
    updated_at = now();

do $$
begin
  if exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_attribute att on att.attrelid = t.oid and att.attnum = any (c.conkey)
    where c.conname = 'calls_pkey'
      and c.contype = 'p'
      and t.relname = 'calls'
      and att.attname = 'id'
  ) then
    null; -- primary key already covers id
  else
    alter table public.calls drop constraint if exists calls_pkey;
    alter table public.calls add constraint calls_pkey primary key (id);
  end if;
end
$$;

create unique index if not exists calls_call_sid_unique on public.calls(call_sid);
create index if not exists calls_job_id_idx on public.calls(job_id);

alter table public.calls
  enable row level security;

alter table public.calls
  force row level security;

drop trigger if exists calls_set_updated_at on public.calls;
create trigger calls_set_updated_at
  before update on public.calls
  for each row execute function public.set_updated_at();

drop trigger if exists calls_ensure_created_at on public.calls;
create trigger calls_ensure_created_at
  before insert on public.calls
  for each row execute function public.ensure_created_at();

alter table public.jobs
  add column if not exists updated_at timestamptz default now();

update public.jobs
set updated_at = coalesce(updated_at, now());

alter table public.jobs
  drop constraint if exists jobs_status_check;

alter table public.jobs
  add constraint jobs_status_check
    check (status in ('new','in_progress','completed','pending'));

drop trigger if exists jobs_set_updated_at on public.jobs;
create trigger jobs_set_updated_at
  before update on public.jobs
  for each row execute function public.set_updated_at();

drop trigger if exists jobs_ensure_created_at on public.jobs;
create trigger jobs_ensure_created_at
  before insert on public.jobs
  for each row execute function public.ensure_created_at();

-- Ensure auth trigger keeps profiles in sync
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, created_at, updated_at)
  values (
    new.id,
    new.email,
    coalesce(new.created_at, now()),
    now()
  )
  on conflict (id) do update
    set email = excluded.email,
        updated_at = excluded.updated_at;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

insert into public.users (id, email, created_at, updated_at)
select u.id,
       u.email,
       coalesce(u.created_at, now()),
       now()
from auth.users u
where not exists (
  select 1 from public.users p where p.id = u.id
);
