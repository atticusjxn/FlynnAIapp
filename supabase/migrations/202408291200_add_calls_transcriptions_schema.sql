-- Ensures required schema for voicemail processing flow
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
  add column if not exists user_id uuid;

alter table public.calls
  add column if not exists from_number text;

alter table public.calls
  add column if not exists to_number text;

alter table public.calls
  add column if not exists recording_url text;

alter table public.calls
  add column if not exists duration_sec integer;

alter table public.calls
  add column if not exists recorded_at timestamptz;

alter table public.calls
  add column if not exists transcription_status text;

alter table public.calls
  add column if not exists transcription_updated_at timestamptz;

create table if not exists public.transcriptions (
  id uuid primary key,
  call_sid text not null references public.calls(call_sid) on delete cascade,
  engine text not null,
  "text" text not null,
  confidence double precision,
  language text,
  created_at timestamptz default now() not null
);

alter table public.transcriptions
  add column if not exists engine text;

alter table public.transcriptions
  add column if not exists "text" text;

alter table public.transcriptions
  add column if not exists confidence double precision;

alter table public.transcriptions
  add column if not exists language text;

alter table public.transcriptions
  add column if not exists created_at timestamptz default now();

create unique index if not exists transcriptions_call_sid_idx on public.transcriptions(call_sid);
