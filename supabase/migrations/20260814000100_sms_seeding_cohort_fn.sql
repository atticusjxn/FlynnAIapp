-- Seeding cohort: per org, per week since its Flynn number went live, how many
-- distinct clients have been seeded (texted FROM the org number) and how many
-- have replied on that thread.
--
-- Deliberately NOT a "share of the client's texts that reach Flynn": texts sent
-- to the operator's personal mobile are invisible to us by construction, so any
-- such share would use an unobservable denominator. Both columns here are
-- directly observed. See services/smsSeeding.js.
--
-- Both counts are CUMULATIVE through each week, so the curve shape is the
-- signal — week 1 on its own means nothing.
create or replace function public.sms_seeding_cohort(p_weeks int default 12)
returns table (
  org_id           uuid,
  week             int,
  seeded_clients   bigint,
  replied_clients  bigint,
  seeding_rate     numeric,
  inbound_messages bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with org_start as (
    -- Seeding becomes possible when the org's number goes live. No assignment
    -- timestamp is stored, so fall back to its first client-facing send.
    select m.org_id,
           min(m.created_at) as started_at
    from public.sms_messages m
    where m.org_id is not null
      and m.direction = 'out'
      and m.to_number is not null
    group by m.org_id
  ),
  -- First time each client was seeded on the org's number.
  seeded as (
    select m.org_id,
           m.user_phone as client_phone,
           min(m.created_at) as first_seeded_at
    from public.sms_messages m
    where m.org_id is not null
      and m.direction = 'out'
      and m.to_number is not null
    group by m.org_id, m.user_phone
  ),
  -- First time each client replied on that number.
  replied as (
    select m.org_id,
           m.user_phone as client_phone,
           min(m.created_at) as first_replied_at
    from public.sms_messages m
    where m.org_id is not null
      and m.direction = 'in'
      and m.sender_role = 'client'
    group by m.org_id, m.user_phone
  ),
  weeks as (
    select s.org_id, s.started_at, w.week
    from org_start s
    cross join generate_series(1, greatest(p_weeks, 1)) as w(week)
  )
  select
    w.org_id,
    w.week,
    count(distinct sd.client_phone)                             as seeded_clients,
    count(distinct rp.client_phone)                             as replied_clients,
    case when count(distinct sd.client_phone) > 0
         then round(count(distinct rp.client_phone)::numeric
                    / count(distinct sd.client_phone), 3)
         else 0 end                                             as seeding_rate,
    coalesce(max(im.msgs), 0)                                   as inbound_messages
  from weeks w
  left join seeded sd
    on sd.org_id = w.org_id
   and sd.first_seeded_at < w.started_at + (w.week * interval '7 days')
  left join replied rp
    on rp.org_id = w.org_id
   and rp.first_replied_at < w.started_at + (w.week * interval '7 days')
  left join lateral (
    select count(*) as msgs
    from public.sms_messages m
    where m.org_id = w.org_id
      and m.direction = 'in'
      and m.sender_role = 'client'
      and m.created_at < w.started_at + (w.week * interval '7 days')
  ) im on true
  group by w.org_id, w.week
  order by w.org_id, w.week;
$$;

revoke all on function public.sms_seeding_cohort(int) from public, anon, authenticated;
grant execute on function public.sms_seeding_cohort(int) to service_role;
