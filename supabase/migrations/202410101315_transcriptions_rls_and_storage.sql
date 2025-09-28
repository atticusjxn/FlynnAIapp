-- Hardens per-user isolation for voicemail data and storage.
set local search_path = public;
set local statement_timeout = '60s';

-- Ensure public.transcriptions has a user reference that mirrors the owning call.
alter table public.transcriptions
  add column if not exists user_id uuid;

alter table public.transcriptions
  drop constraint if exists transcriptions_user_id_fkey;

alter table public.transcriptions
  add constraint transcriptions_user_id_fkey
    foreign key (user_id)
    references public.users(id)
    on delete cascade;

-- Backfill user_id via related calls. Warn (and leave nullable) if any rows cannot be resolved.
do $$
declare
  orphaned_count bigint;
begin
  update public.transcriptions t
     set user_id = c.user_id
    from public.calls c
   where t.call_sid = c.call_sid
     and t.user_id is null;

  select count(*)
    into orphaned_count
    from public.transcriptions
   where user_id is null;

  if orphaned_count > 0 then
    raise warning 'public.transcriptions: % rows remain without user_id. Investigate call/user records before enforcing NOT NULL.', orphaned_count;
  else
    alter table public.transcriptions
      alter column user_id set not null;
  end if;
end
$$;

-- Ensure efficient lookups for RLS predicates.
create index if not exists transcriptions_user_id_idx
  on public.transcriptions(user_id);

create index if not exists calls_user_id_idx
  on public.calls(user_id);

create index if not exists jobs_user_id_idx
  on public.jobs(user_id);

-- Enable and enforce RLS for the voicemail-related tables.
alter table public.calls enable row level security;
alter table public.calls force row level security;

drop policy if exists "Calls owner select" on public.calls;
create policy "Calls owner select"
  on public.calls
  for select
  using (user_id = auth.uid());

drop policy if exists "Calls owner insert" on public.calls;
create policy "Calls owner insert"
  on public.calls
  for insert
  with check (user_id = auth.uid());

drop policy if exists "Calls owner update" on public.calls;
create policy "Calls owner update"
  on public.calls
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Calls owner delete" on public.calls;
create policy "Calls owner delete"
  on public.calls
  for delete
  using (user_id = auth.uid());

alter table public.transcriptions enable row level security;
alter table public.transcriptions force row level security;

drop policy if exists "Transcriptions owner select" on public.transcriptions;
create policy "Transcriptions owner select"
  on public.transcriptions
  for select
  using (user_id = auth.uid());

drop policy if exists "Transcriptions owner insert" on public.transcriptions;
create policy "Transcriptions owner insert"
  on public.transcriptions
  for insert
  with check (user_id = auth.uid());

drop policy if exists "Transcriptions owner update" on public.transcriptions;
create policy "Transcriptions owner update"
  on public.transcriptions
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Transcriptions owner delete" on public.transcriptions;
create policy "Transcriptions owner delete"
  on public.transcriptions
  for delete
  using (user_id = auth.uid());

alter table public.jobs enable row level security;
alter table public.jobs force row level security;

drop policy if exists "Jobs owner select" on public.jobs;
create policy "Jobs owner select"
  on public.jobs
  for select
  using (user_id = auth.uid());

drop policy if exists "Jobs owner insert" on public.jobs;
create policy "Jobs owner insert"
  on public.jobs
  for insert
  with check (user_id = auth.uid());

drop policy if exists "Jobs owner update" on public.jobs;
create policy "Jobs owner update"
  on public.jobs
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Jobs owner delete" on public.jobs;
create policy "Jobs owner delete"
  on public.jobs
  for delete
  using (user_id = auth.uid());

-- Harden Supabase Storage access for voicemail recordings while handling privilege limitations.
do $$
declare
  bucket_name text := coalesce(current_setting('app.settings.voicemail_bucket', true), 'voicemails');
  policy_record record;
begin
  if not exists (select 1 from storage.buckets where name = bucket_name) then
    raise exception 'Storage bucket % not found. Create it or set app.settings.voicemail_bucket.', bucket_name;
  end if;

  update storage.buckets
     set public = false
   where name = bucket_name;

  for policy_record in
    select policyname
      from pg_policies
     where schemaname = 'storage'
       and tablename = 'objects'
       and policyname in (
         'Voicemail objects insert',
         'Voicemail objects update',
         'Voicemail objects delete'
       )
  loop
    begin
      execute format('drop policy "%s" on storage.objects;', policy_record.policyname);
    exception
      when insufficient_privilege then
        raise warning 'Unable to drop existing storage.objects policy "%" due to privileges; update manually if needed.', policy_record.policyname;
      when undefined_object then
        null;
    end;
  end loop;

  -- Insert policy
  begin
    execute format(
      'create policy "Voicemail objects insert" on storage.objects for insert with check (bucket_id = %L and auth.role() = ''service_role'');',
      bucket_name
    );
  exception
    when insufficient_privilege then
      raise warning 'Unable to create storage.objects insert policy; configure via dashboard or Supabase Studio.';
    when duplicate_object then
      null;
  end;

  -- Update policy
  begin
    execute format(
      'create policy "Voicemail objects update" on storage.objects for update using (bucket_id = %L and auth.role() = ''service_role'') with check (bucket_id = %L and auth.role() = ''service_role'');',
      bucket_name,
      bucket_name
    );
  exception
    when insufficient_privilege then
      raise warning 'Unable to create storage.objects update policy; configure via dashboard or Supabase Studio.';
    when duplicate_object then
      null;
  end;

  -- Delete policy
  begin
    execute format(
      'create policy "Voicemail objects delete" on storage.objects for delete using (bucket_id = %L and auth.role() = ''service_role'');',
      bucket_name
    );
  exception
    when insufficient_privilege then
      raise warning 'Unable to create storage.objects delete policy; configure via dashboard or Supabase Studio.';
    when duplicate_object then
      null;
  end;
end
$$;
