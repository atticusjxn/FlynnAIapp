-- Harden RLS for smart call routing tables and ensure joins expose voicemail metadata
set local search_path = public;
set local statement_timeout = '60s';

-- Backfill voicemail ownership from related calls so RLS predicates succeed
update public.call_voicemails v
   set user_id = c.user_id
  from public.calls c
 where v.call_sid = c.call_sid
   and (v.user_id is null or v.user_id <> c.user_id);

-- Only enforce NOT NULL when every row has a user reference
do $$
declare
  missing_count bigint;
begin
  select count(*)
    into missing_count
    from public.call_voicemails
   where user_id is null;

  if missing_count = 0 then
    alter table public.call_voicemails
      alter column user_id set not null;
  else
    raise warning 'call_voicemails retains % rows without user_id; investigate before retrying NOT NULL.', missing_count;
  end if;
end
$$;

alter table public.callers enable row level security;
alter table public.callers force row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
     where schemaname = 'public'
       and tablename = 'callers'
       and policyname = 'Callers owner select'
  ) then
    execute $$create policy "Callers owner select" on public.callers for select using (user_id = auth.uid())$$;
  end if;

  if not exists (
    select 1 from pg_policies
     where schemaname = 'public'
       and tablename = 'callers'
       and policyname = 'Callers owner insert'
  ) then
    execute $$create policy "Callers owner insert" on public.callers for insert with check (user_id = auth.uid())$$;
  end if;

  if not exists (
    select 1 from pg_policies
     where schemaname = 'public'
       and tablename = 'callers'
       and policyname = 'Callers owner update'
  ) then
    execute $$create policy "Callers owner update" on public.callers for update using (user_id = auth.uid()) with check (user_id = auth.uid())$$;
  end if;

  if not exists (
    select 1 from pg_policies
     where schemaname = 'public'
       and tablename = 'callers'
       and policyname = 'Callers owner delete'
  ) then
    execute $$create policy "Callers owner delete" on public.callers for delete using (user_id = auth.uid())$$;
  end if;
end
$$;

alter table public.call_routing_settings enable row level security;
alter table public.call_routing_settings force row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
     where schemaname = 'public'
       and tablename = 'call_routing_settings'
       and policyname = 'Call routing settings select'
  ) then
    execute $$create policy "Call routing settings select" on public.call_routing_settings for select using (user_id = auth.uid())$$;
  end if;

  if not exists (
    select 1 from pg_policies
     where schemaname = 'public'
       and tablename = 'call_routing_settings'
       and policyname = 'Call routing settings insert'
  ) then
    execute $$create policy "Call routing settings insert" on public.call_routing_settings for insert with check (user_id = auth.uid())$$;
  end if;

  if not exists (
    select 1 from pg_policies
     where schemaname = 'public'
       and tablename = 'call_routing_settings'
       and policyname = 'Call routing settings update'
  ) then
    execute $$create policy "Call routing settings update" on public.call_routing_settings for update using (user_id = auth.uid()) with check (user_id = auth.uid())$$;
  end if;

  if not exists (
    select 1 from pg_policies
     where schemaname = 'public'
       and tablename = 'call_routing_settings'
       and policyname = 'Call routing settings delete'
  ) then
    execute $$create policy "Call routing settings delete" on public.call_routing_settings for delete using (user_id = auth.uid())$$;
  end if;
end
$$;

alter table public.call_voicemails enable row level security;
alter table public.call_voicemails force row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
     where schemaname = 'public'
       and tablename = 'call_voicemails'
       and policyname = 'Call voicemails select'
  ) then
    execute $$create policy "Call voicemails select" on public.call_voicemails for select using (
      user_id = auth.uid()
      or exists (
        select 1 from public.calls c
         where c.call_sid = call_sid
           and c.user_id = auth.uid()
      )
    )$$;
  end if;

  if not exists (
    select 1 from pg_policies
     where schemaname = 'public'
       and tablename = 'call_voicemails'
       and policyname = 'Call voicemails delete'
  ) then
    execute $$create policy "Call voicemails delete" on public.call_voicemails for delete using (user_id = auth.uid())$$;
  end if;
end
$$;
