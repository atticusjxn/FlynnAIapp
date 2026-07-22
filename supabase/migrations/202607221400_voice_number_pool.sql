-- Pre-provisioned pool of AU Twilio numbers so a claimed receptionist goes
-- live in seconds instead of waiting on regulatory-bundle provisioning.
-- Allocation is an RPC because supabase-js can't express FOR UPDATE SKIP LOCKED.

create table if not exists public.voice_number_pool (
  id uuid primary key default gen_random_uuid(),
  phone_number text not null unique,
  twilio_sid text,
  status text not null default 'available'
    check (status in ('available', 'assigned', 'quarantined')),
  assigned_user_id uuid references public.users(id),
  assigned_org_id uuid references public.organizations(id),
  assigned_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.voice_number_pool enable row level security;

create or replace function public.allocate_pool_number(p_user_id uuid, p_org_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_number text;
begin
  update voice_number_pool
     set status = 'assigned',
         assigned_user_id = p_user_id,
         assigned_org_id = p_org_id,
         assigned_at = now()
   where id = (
     select id from voice_number_pool
      where status = 'available'
      order by created_at
      limit 1
      for update skip locked
   )
  returning phone_number into v_number;

  return v_number; -- null when the pool is empty
end;
$$;

revoke execute on function public.allocate_pool_number(uuid, uuid) from public, anon, authenticated;
