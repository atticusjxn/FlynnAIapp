-- Payments-first pivot: org-keyed system-of-record spine, part 1.
-- See ~/.claude/plans/iridescent-floating-moore.md and memory flynn_positioning.
--
-- Verified against live prod (zvfeafmmtfplzpnocyjw) 2026-07-19 before applying:
-- organizations/org_members/jobs/clients/invoices/agent_invoices and the
-- is_org_member()/touch_updated_at() helpers all already exist. `clients`
-- exists but is user-keyed and was never captured in a migration file — see
-- the clients section below for how that's reconciled additively.
--
-- Everything here is additive (create-if-not-exists / add-column-if-not-exists)
-- so it is safe to run against the live Flynnai project without touching
-- existing agent (phone-keyed) behaviour. The agent tool loop is re-pointed at
-- this spine in a later phase, not by this migration.
set local search_path = public;
set local statement_timeout = '60s';

-- ---------------------------------------------------------------------------
-- Phone -> org resolution (keystone for the shared "Team Flynn" number)
-- ---------------------------------------------------------------------------
alter table public.org_members
  add column if not exists member_phone text;

create index if not exists org_members_member_phone_idx
  on public.org_members(member_phone);

-- A phone number should resolve to exactly one active member so inbound SMS
-- routing is unambiguous. Partial unique index (not a table constraint) so
-- multiple NULL/revoked rows don't collide.
create unique index if not exists org_members_active_phone_unique
  on public.org_members(member_phone)
  where member_phone is not null and status = 'active';

-- ---------------------------------------------------------------------------
-- clients — ALREADY EXISTS in prod (verified 2026-07-19 against
-- zvfeafmmtfplzpnocyjw), created out-of-band and never captured in a migration
-- file — hence it looked "missing" when grepping supabase/migrations/.
--
-- Its real shape is USER-keyed (user_id NOT NULL, no org_id) and matches the
-- existing iOS ClientDTO/ClientFormView fields (business_type,
-- preferred_contact_method, last_job_date, last_job_type, total_jobs). It has
-- live rows and 8 existing user-scoped RLS policies.
--
-- So this section is deliberately ADDITIVE, not a create-from-scratch: the
-- create-if-not-exists below mirrors the ACTUAL prod shape (so a fresh DB
-- converges to the same thing), and the alter adds org_id as a NULLABLE
-- column so the org spine can adopt clients incrementally WITHOUT breaking
-- user_id-keyed rows, the existing policies, or the shipped app.
-- user_id stays NOT NULL — inserts must still supply it.
-- ---------------------------------------------------------------------------
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  phone text,
  email text,
  address text,
  notes text,
  business_type text,
  preferred_contact_method text,
  total_jobs integer default 0,
  last_job_date timestamptz,
  last_job_type text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Org spine adoption: nullable so existing rows and the current user-keyed
-- app keep working; backfilled below from each owner's default org.
alter table public.clients
  add column if not exists org_id uuid references public.organizations(id) on delete cascade;

update public.clients c
   set org_id = u.default_org_id
  from public.users u
 where c.user_id = u.id
   and c.org_id is null
   and u.default_org_id is not null;

create index if not exists clients_org_idx on public.clients(org_id);
create index if not exists clients_user_idx on public.clients(user_id);
create index if not exists clients_org_phone_idx on public.clients(org_id, phone);

-- NOTE: deliberately NO updated_at trigger added here. Prod already has
-- clients_set_updated_at (BEFORE UPDATE), clients_ensure_created_at, and
-- clients_set_user_id_trigger (BEFORE INSERT, fills user_id from the session)
-- — none of which were visible from this folder because `clients` was created
-- out-of-band. Adding another updated_at trigger just double-fires.

alter table public.clients enable row level security;

-- Added ALONGSIDE the 8 pre-existing user-scoped policies (not replacing
-- them) so org members can reach org-adopted clients while user-keyed access
-- continues to work unchanged. Postgres ORs permissive policies together.
drop policy if exists "Clients org member access" on public.clients;
create policy "Clients org member access"
  on public.clients
  for all
  using (
    auth.role() = 'service_role'
    or (org_id is not null and public.is_org_member(org_id))
  )
  with check (
    auth.role() = 'service_role'
    or (org_id is not null and public.is_org_member(org_id))
  );

-- ---------------------------------------------------------------------------
-- jobs — extend the existing (voicemail-era) table into a work-order,
-- additively. Do NOT drop customer_name/client_name/location/notes: the iOS
-- app (EventDTO) and legacy voicemail ingestion both read them today.
-- ---------------------------------------------------------------------------
alter table public.jobs
  add column if not exists client_id uuid references public.clients(id) on delete set null,
  add column if not exists title text,
  add column if not exists scheduled_at timestamptz,
  add column if not exists created_by uuid references public.users(id) on delete set null;

create index if not exists jobs_client_id_idx on public.jobs(client_id);
create index if not exists jobs_org_status_idx on public.jobs(org_id, status);

-- Widen the status check to add work-order states without breaking the
-- existing voicemail states ('new', 'in_progress', 'completed').
alter table public.jobs
  drop constraint if exists jobs_status_check;
alter table public.jobs
  add constraint jobs_status_check
    check (status in (
      'new', 'in_progress', 'completed',
      'lead', 'quoted', 'scheduled', 'invoiced', 'paid'
    ));

-- ---------------------------------------------------------------------------
-- job_notes — threaded notes, replacing the single jobs.notes text field
-- ---------------------------------------------------------------------------
create table if not exists public.job_notes (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  author_member_id uuid references public.org_members(id) on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists job_notes_job_idx on public.job_notes(job_id, created_at desc);
create index if not exists job_notes_org_idx on public.job_notes(org_id);

alter table public.job_notes enable row level security;
alter table public.job_notes force row level security;

drop policy if exists "Job notes access" on public.job_notes;
create policy "Job notes access"
  on public.job_notes
  for all
  using (
    auth.role() = 'service_role'
    or public.is_org_member(org_id)
  )
  with check (
    auth.role() = 'service_role'
    or public.is_org_member(org_id)
  );

-- ---------------------------------------------------------------------------
-- job_photos — persistent gallery. job_photo_buffer (agent_invoices migration)
-- stays as the transient inbound landing zone before a photo is attached here.
-- ---------------------------------------------------------------------------
create table if not exists public.job_photos (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  storage_path text not null,
  public_url text not null,
  uploaded_by uuid references public.org_members(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists job_photos_job_idx on public.job_photos(job_id, created_at desc);
create index if not exists job_photos_org_idx on public.job_photos(org_id);

alter table public.job_photos enable row level security;
alter table public.job_photos force row level security;

drop policy if exists "Job photos access" on public.job_photos;
create policy "Job photos access"
  on public.job_photos
  for all
  using (
    auth.role() = 'service_role'
    or public.is_org_member(org_id)
  )
  with check (
    auth.role() = 'service_role'
    or public.is_org_member(org_id)
  );
