-- Add receptionist preference columns to users table
alter table public.users
  add column if not exists receptionist_voice text,
  add column if not exists receptionist_greeting text,
  add column if not exists receptionist_questions jsonb default '[]'::jsonb,
  add column if not exists receptionist_voice_profile_id uuid;

-- Create voice_profiles table to store custom voice clones
create table if not exists public.voice_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  label text not null,
  provider text not null default 'custom',
  status text not null default 'uploaded',
  sample_path text,
  voice_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists voice_profiles_user_id_idx
  on public.voice_profiles(user_id);

alter table public.voice_profiles
  enable row level security;

create or replace function public.set_voice_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_voice_profiles_updated_at on public.voice_profiles;

create trigger set_voice_profiles_updated_at
  before update on public.voice_profiles
  for each row
  execute procedure public.set_voice_profiles_updated_at();

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'voice_profiles'
      and policyname = 'Users manage own voice profiles'
  ) then
    create policy "Users manage own voice profiles"
      on public.voice_profiles
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

-- Update users.receptionist_voice_profile_id to reference voice_profiles
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'users_receptionist_voice_profile_fk'
  ) then
    alter table public.users
      add constraint users_receptionist_voice_profile_fk
        foreign key (receptionist_voice_profile_id)
        references public.voice_profiles(id)
        on delete set null;
  end if;
end $$;

-- Ensure storage bucket exists for voice samples
do $$
begin
  insert into storage.buckets (id, name, public)
  values ('voice-profiles', 'voice-profiles', false)
  on conflict (id) do nothing;
exception when others then
  raise notice 'Bucket voice-profiles already exists or cannot be created: %', sqlerrm;
end $$;

-- Restrict access to voice sample objects so users can only manage their own recordings
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Authenticated users manage own voice samples'
  ) then
    create policy "Authenticated users manage own voice samples"
      on storage.objects
      for all
      using (bucket_id = 'voice-profiles' and owner = auth.uid())
      with check (bucket_id = 'voice-profiles' and owner = auth.uid());
  end if;
end $$;
-- Rename legacy calendar flag to receptionist_configured if it exists
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'users'
      and column_name = 'calendar_integration_complete'
  ) then
    alter table public.users
      rename column calendar_integration_complete to receptionist_configured;
  end if;
end $$;

alter table public.users
  add column if not exists receptionist_configured boolean default false;
