-- The bucket name falls back to 'voicemails' unless a database-level setting overrides it.
do $$
declare
  bucket_name text := coalesce(current_setting('app.settings.voicemail_bucket', true), 'voicemails');
  storage_policies_exists boolean := exists (
    select 1
    from information_schema.tables
    where table_schema = 'storage'
      and table_name = 'policies'
  );
begin
  -- Ensure the bucket exists before proceeding.
  if not exists (select 1 from storage.buckets where name = bucket_name) then
    raise exception 'Bucket "%" not found. Set app.settings.voicemail_bucket or create the bucket first.', bucket_name;
  end if;

  -- Make bucket private and enforce a 20 MB max file size unless already tighter.
  update storage.buckets
     set public = false,
         file_size_limit = least(coalesce(file_size_limit, 20 * 1024 * 1024), 20 * 1024 * 1024)
   where name = bucket_name;

  if storage_policies_exists then
    -- Drop legacy policies we may be superseding.
    delete from storage.policies
     where bucket_id = bucket_name
       and name in (
         'Voicemail service role read',
         'Voicemail service role insert',
         'Voicemail service role update',
         'Voicemail service role delete',
         'voicemail-service-role-read',
         'voicemail-service-role-write'
       );

    -- Backend (service role) may read objects.
    insert into storage.policies (bucket_id, name, definition, "check", action)
         values (bucket_name,
                 'Voicemail service role read',
                 'auth.role() = ''service_role''',
                 null,
                 'SELECT')
    on conflict (bucket_id, name) do nothing;

    -- Service role controls inserts.
    insert into storage.policies (bucket_id, name, definition, "check", action)
         values (bucket_name,
                 'Voicemail service role insert',
                 'auth.role() = ''service_role''',
                 format('bucket_id = %L', bucket_name),
                 'INSERT')
    on conflict (bucket_id, name) do nothing;

    -- Service role controls updates.
    insert into storage.policies (bucket_id, name, definition, "check", action)
         values (bucket_name,
                 'Voicemail service role update',
                 'auth.role() = ''service_role''',
                 format('bucket_id = %L', bucket_name),
                 'UPDATE')
    on conflict (bucket_id, name) do nothing;

    -- Service role controls deletes.
    insert into storage.policies (bucket_id, name, definition, "check", action)
         values (bucket_name,
                 'Voicemail service role delete',
                 'auth.role() = ''service_role''',
                 format('bucket_id = %L', bucket_name),
                 'DELETE')
    on conflict (bucket_id, name) do nothing;
  else
    raise notice 'storage.policies table not found; skipping policy updates.';
  end if;
end
$$;

-- Harden voicemail metadata stored alongside call records.
alter table public.calls
  alter column status set default 'active';

update public.calls
   set status = 'active'
 where status is null;

alter table public.calls
  alter column status set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'calls_recording_expiration_check'
      and conrelid = 'public.calls'::regclass
  ) then
    alter table public.calls
      add constraint calls_recording_expiration_check
        check (
          recording_expires_at is null
          or recorded_at is null
          or recording_expires_at >= recorded_at
        )
      not valid;
  end if;
end
$$;

alter table public.calls
  validate constraint calls_recording_expiration_check;
