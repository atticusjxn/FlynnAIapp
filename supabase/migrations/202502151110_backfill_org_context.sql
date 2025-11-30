-- Backfill existing data into the new organization-scoped schema.
set local search_path = public;
set local statement_timeout = '60s';

-- Create organizations for legacy users in manageable batches.
do $$
declare
  processed integer;
begin
  loop
    processed := public.backfill_legacy_orgs(500);
    exit when processed = 0;
  end loop;
end;
$$;

-- Associate jobs with the default organization of their owner.
update public.jobs j
   set org_id = u.default_org_id
  from public.users u
 where j.org_id is null
   and j.user_id = u.id
   and u.default_org_id is not null;

-- Associate calls through the owning user when possible.
update public.calls c
   set org_id = u.default_org_id
  from public.users u
 where c.org_id is null
   and c.user_id = u.id
   and u.default_org_id is not null;

-- Leverage newly-set jobs to fill any remaining call orgs.
update public.calls c
   set org_id = j.org_id
  from public.jobs j
 where c.org_id is null
   and j.call_sid = c.call_sid
   and j.org_id is not null;

-- Ensure transcriptions follow their parent call org.
update public.transcriptions t
   set org_id = c.org_id
  from public.calls c
 where t.call_sid = c.call_sid
   and c.org_id is not null
   and (t.org_id is distinct from c.org_id or t.org_id is null);

-- Voice profiles inherit org context from the owning user.
update public.voice_profiles vp
   set org_id = u.default_org_id
  from public.users u
 where vp.org_id is null
   and vp.user_id = u.id
   and u.default_org_id is not null;

-- Notification tokens inherit org context from the owning user.
update public.notification_tokens nt
   set org_id = u.default_org_id
  from public.users u
 where nt.org_id is null
   and nt.user_id = u.id
   and u.default_org_id is not null;

-- Mark receptionist configs for newly created organizations if missing.
insert into public.receptionist_configs (org_id, greeting_script, intake_questions, summary_delivery, timezone)
select o.id,
       'Hi, this is FlynnAI, the AI receptionist for ' || o.display_name || '. How can I help with your upcoming event?',
       '[]'::jsonb,
       'push',
       o.timezone
  from public.organizations o
 where not exists (
         select 1
           from public.receptionist_configs rc
          where rc.org_id = o.id
       );

-- Establish receptionist configurations as "configured" for users tied to an org.
update public.users u
   set receptionist_configured = coalesce(receptionist_configured, false) or (default_org_id is not null);
