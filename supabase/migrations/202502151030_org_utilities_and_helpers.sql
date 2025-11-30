-- Helper functions to operationalize multi-tenant provisioning flows.
set local search_path = public;
set local statement_timeout = '60s';

-- Generate unique slugs for organizations.
create or replace function public.generate_org_slug(source_name text)
returns citext
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  base text := lower(regexp_replace(coalesce(source_name, 'org'), '[^a-z0-9]+', '-', 'g'));
  trimmed text := regexp_replace(base, '^-+|-+$', '', 'g');
  candidate text := coalesce(nullif(trimmed, ''), 'org');
  counter int := 1;
begin
  while exists (select 1 from public.organizations where slug = candidate::citext) loop
    candidate := concat(candidate, '-', counter::text);
    counter := counter + 1;
  end loop;

  return candidate::citext;
end;
$$;

grant execute on function public.generate_org_slug(text) to authenticated, service_role;

-- Creates an organization plus default configuration for a user.
create or replace function public.create_org_with_defaults(
  p_display_name text,
  p_user_id uuid,
  p_website_url text default null,
  p_timezone text default 'UTC'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  acting_user uuid := auth.uid();
  new_org_id uuid;
  call_flow jsonb := jsonb_build_object(
    'nodes', jsonb_build_array(
      jsonb_build_object('id', 'receptionist', 'type', 'receptionist', 'prompt', 'Use business profile to greet caller'),
      jsonb_build_object('id', 'voicemail', 'type', 'voicemail')
    ),
    'edges', jsonb_build_array(
      jsonb_build_object('from', 'receptionist', 'to', 'voicemail', 'reason', 'fallback')
    )
  );
begin
  if p_display_name is null or length(trim(p_display_name)) = 0 then
    raise exception 'display name is required';
  end if;

  if auth.role() != 'service_role' and acting_user is distinct from p_user_id then
    raise exception 'cannot create organization for another user';
  end if;

  insert into public.organizations (display_name, slug, website_url, timezone, created_by, status, plan, metadata)
  values (
    trim(p_display_name),
    public.generate_org_slug(p_display_name),
    p_website_url,
    coalesce(p_timezone, 'UTC'),
    p_user_id,
    'onboarding',
    'trial',
    jsonb_build_object('source', 'create_org_with_defaults')
  )
  returning id into new_org_id;

  insert into public.business_profiles (org_id, public_name, website_url, metadata)
  values (
    new_org_id,
    trim(p_display_name),
    p_website_url,
    jsonb_build_object('auto', true, 'timezone', coalesce(p_timezone, 'UTC'))
  )
  on conflict (org_id) do nothing;

  insert into public.onboarding_sessions (org_id, user_id, current_step, payload)
  values (new_org_id, p_user_id, 'collect_website', jsonb_build_object())
  on conflict do nothing;

  insert into public.receptionist_configs (org_id, greeting_script, intake_questions, summary_delivery, timezone)
  values (
    new_org_id,
    'Hi, this is FlynnAI, the AI receptionist for ' || trim(p_display_name) || '. How can I help with your upcoming event?',
    jsonb_build_array(),
    'push',
    coalesce(p_timezone, 'UTC')
  )
  on conflict (org_id) do nothing;

  insert into public.call_flows (org_id, name, status, entrypoint, flow)
  values (new_org_id, 'Primary Receptionist Flow', 'draft', 'receptionist', call_flow)
  on conflict do nothing;

  update public.users
     set default_org_id = coalesce(default_org_id, new_org_id)
   where id = p_user_id;

  return new_org_id;
exception
  when unique_violation then
    -- Rerun with a different slug if a race condition occurs.
    return public.create_org_with_defaults(p_display_name || ' ' || to_char(now(), 'YYYYMMDDHH24MISS'), p_user_id, p_website_url, p_timezone);
end;
$$;

grant execute on function public.create_org_with_defaults(text, uuid, text, text) to authenticated, service_role;

-- Utility to record call lifecycle events while enforcing org ownership.
create or replace function public.record_call_event(
  p_call_sid text,
  p_event_type text,
  p_direction text default null,
  p_payload jsonb default '{}'::jsonb,
  p_occurred_at timestamptz default null
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  target_org uuid;
  target_number uuid;
  inserted_id bigint;
begin
  select c.org_id,
         pn.id
    into target_org, target_number
    from public.calls c
    left join public.phone_numbers pn on pn.e164_number = c.to_number
   where c.call_sid = p_call_sid;

  if target_org is null then
    raise exception 'Call % not associated with an organization; set calls.org_id first', p_call_sid;
  end if;

  if p_direction is not null and p_direction not in ('inbound', 'outbound') then
    raise exception 'Invalid direction %', p_direction;
  end if;

  insert into public.call_events (org_id, number_id, call_sid, event_type, direction, payload, occurred_at)
  values (
    target_org,
    target_number,
    p_call_sid,
    p_event_type,
    p_direction,
    coalesce(p_payload, '{}'::jsonb),
    coalesce(p_occurred_at, now())
  )
  returning id into inserted_id;

  return inserted_id;
end;
$$;

grant execute on function public.record_call_event(text, text, text, jsonb, timestamptz) to service_role;

-- Backfill helper to create an organization per existing user with jobs but no org context.
create or replace function public.backfill_legacy_orgs(batch_limit integer default 100)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer := 0;
  rec record;
begin
  for rec in
    with activity as (
      select user_id,
             min(created_at) as first_activity
        from (
          select user_id, min(created_at) as created_at
            from public.jobs
           where user_id is not null
           group by user_id
          union all
          select user_id, min(recorded_at) as created_at
            from public.calls
           where user_id is not null
           group by user_id
        ) t
       group by user_id
    )
    select u.id as user_id,
           coalesce(nullif(split_part(u.email, '@', 1), ''), 'Flynn Team') as display_name,
           a.first_activity
      from public.users u
      join activity a on a.user_id = u.id
     where u.default_org_id is null
       and not exists (
         select 1
           from public.organizations o
          where o.created_by = u.id
       )
     order by a.first_activity nulls last
     limit batch_limit
  loop
    perform public.create_org_with_defaults(coalesce(rec.display_name, 'Flynn Team'), rec.user_id, null, 'UTC');
    affected := affected + 1;
  end loop;

  return affected;
end;
$$;

grant execute on function public.backfill_legacy_orgs(integer) to service_role;
