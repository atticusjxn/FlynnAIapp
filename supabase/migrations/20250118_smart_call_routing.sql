-- Smart call routing schema changes
create table if not exists public.callers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  phone_number text not null,
  label text not null default 'lead' check (label in ('lead', 'client', 'personal', 'spam')),
  display_name text,
  routing_override text check (routing_override in ('intake', 'voicemail', 'auto')),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists callers_user_phone_idx on public.callers(user_id, phone_number);
create index if not exists callers_user_label_idx on public.callers(user_id, label);

alter table public.calls
  add column if not exists caller_id uuid references public.callers(id) on delete set null,
  add column if not exists route_mode text,
  add column if not exists route_decision text,
  add column if not exists route_reason text,
  add column if not exists route_fallback boolean default false,
  add column if not exists route_evaluated_at timestamptz,
  add column if not exists feature_flag_version text,
  add column if not exists metadata jsonb default '{}'::jsonb;

create index if not exists calls_user_route_idx on public.calls(user_id, route_decision, recorded_at desc nulls last);
create index if not exists calls_caller_idx on public.calls(caller_id);

create table if not exists public.call_routing_settings (
  user_id uuid primary key references public.users(id) on delete cascade,
  mode text not null default 'smart_auto' check (mode in ('intake', 'voicemail', 'smart_auto')),
  after_hours_mode text not null default 'voicemail' check (after_hours_mode in ('intake', 'voicemail')),
  schedule jsonb,
  schedule_timezone text,
  feature_enabled boolean default true,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.call_voicemails (
  id uuid primary key default gen_random_uuid(),
  call_sid text unique references public.calls(call_sid) on delete cascade,
  user_id uuid references public.users(id) on delete cascade,
  caller_id uuid references public.callers(id) on delete set null,
  transcription_id uuid references public.transcriptions(id) on delete set null,
  recording_url text,
  transcription_text text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists call_voicemails_user_idx on public.call_voicemails(user_id, created_at desc);
