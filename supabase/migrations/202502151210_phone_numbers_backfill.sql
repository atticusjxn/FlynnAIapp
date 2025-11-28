-- Align legacy phone_numbers tables with the org-aware schema.
set local search_path = public;
set local statement_timeout = '60s';

alter table public.phone_numbers
  add column if not exists org_id uuid references public.organizations(id) on delete cascade,
  add column if not exists call_flow_id uuid references public.call_flows(id) on delete set null,
  add column if not exists provisioned_by uuid references public.users(id) on delete set null,
  add column if not exists e164_number text,
  add column if not exists friendly_label text,
  add column if not exists twilio_sid text,
  add column if not exists twilio_subaccount_sid text,
  add column if not exists status text,
  add column if not exists forwarding_type text,
  add column if not exists connected_number text,
  add column if not exists original_number text,
  add column if not exists capabilities jsonb,
  add column if not exists verification_state text,
  add column if not exists verified_at timestamptz,
  add column if not exists is_primary boolean,
  add column if not exists provisioned_at timestamptz,
  add column if not exists released_at timestamptz,
  add column if not exists metadata jsonb,
  add column if not exists created_at timestamptz,
  add column if not exists updated_at timestamptz;

update public.phone_numbers
   set status = coalesce(status, 'pending'),
       forwarding_type = coalesce(forwarding_type, 'flynn_number'),
       verification_state = coalesce(verification_state, 'unverified'),
       capabilities = coalesce(capabilities, '{}'::jsonb),
       metadata = coalesce(metadata, '{}'::jsonb),
       created_at = coalesce(created_at, now()),
       updated_at = coalesce(updated_at, now());

alter table public.phone_numbers
  alter column status set default 'pending',
  alter column status set not null,
  alter column forwarding_type set default 'flynn_number',
  alter column forwarding_type set not null,
  alter column capabilities set default '{}'::jsonb,
  alter column verification_state set default 'unverified',
  alter column verification_state set not null,
  alter column is_primary set default false,
  alter column metadata set default '{}'::jsonb,
  alter column created_at set default now(),
  alter column updated_at set default now();

alter table public.phone_numbers
  drop constraint if exists phone_numbers_status_check;

alter table public.phone_numbers
  add constraint phone_numbers_status_check
    check (status in ('pending', 'reserved', 'active', 'ported', 'released', 'failed'));

alter table public.phone_numbers
  drop constraint if exists phone_numbers_forwarding_type_check;

alter table public.phone_numbers
  add constraint phone_numbers_forwarding_type_check
    check (forwarding_type in ('flynn_number', 'call_forwarding', 'ported', 'sip_trunk'));

alter table public.phone_numbers
  drop constraint if exists phone_numbers_verification_state_check;

alter table public.phone_numbers
  add constraint phone_numbers_verification_state_check
    check (verification_state in ('unverified', 'verifying', 'verified', 'failed'));
