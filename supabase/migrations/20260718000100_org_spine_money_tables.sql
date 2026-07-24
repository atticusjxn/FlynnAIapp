-- Payments-first pivot: org-keyed system-of-record spine, part 2 (money).
-- See ~/.claude/plans/iridescent-floating-moore.md and memory
-- flynn_payments_verified_facts for why these columns/rails exist.
set local search_path = public;
set local statement_timeout = '60s';

-- ---------------------------------------------------------------------------
-- expenses — first-class table. Xero/Google Sheets become sync targets, not
-- the source of truth (previously receipts only ever landed in Xero/Sheets).
-- ---------------------------------------------------------------------------
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  job_id uuid references public.jobs(id) on delete set null,
  vendor text,
  amount_cents integer not null default 0,
  gst_cents integer not null default 0,
  category text,
  receipt_url text,
  source text not null default 'manual'
    check (source in ('manual', 'sms_receipt', 'app', 'xero_sync', 'sheets_sync')),
  xero_synced boolean not null default false,
  created_by uuid references public.org_members(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists expenses_org_idx on public.expenses(org_id, created_at desc);
create index if not exists expenses_job_idx on public.expenses(job_id);

drop trigger if exists touch_expenses_updated_at on public.expenses;
create trigger touch_expenses_updated_at
  before update on public.expenses
  for each row
  execute function public.touch_updated_at();

alter table public.expenses enable row level security;
alter table public.expenses force row level security;

drop policy if exists "Expenses access" on public.expenses;
create policy "Expenses access"
  on public.expenses
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
-- parts_orders — first-class table for supplier orders placed via the agent
-- (Bunnings/Reece/etc via Browserbase). confirmation_ref/pickup_qr_url are
-- currently unpopulated by the agent (it only returns a cart total today) —
-- columns exist so that gap can be closed without another migration.
-- ---------------------------------------------------------------------------
create table if not exists public.parts_orders (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  job_id uuid references public.jobs(id) on delete set null,
  supplier text not null,
  line_items jsonb not null default '[]'::jsonb,
  cart_total_cents integer,
  status text not null default 'placed'
    check (status in ('placed', 'confirmed', 'ready_for_pickup', 'picked_up', 'cancelled')),
  confirmation_ref text,
  pickup_qr_url text,
  ordered_by uuid references public.org_members(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists parts_orders_org_idx on public.parts_orders(org_id, created_at desc);
create index if not exists parts_orders_job_idx on public.parts_orders(job_id);

drop trigger if exists touch_parts_orders_updated_at on public.parts_orders;
create trigger touch_parts_orders_updated_at
  before update on public.parts_orders
  for each row
  execute function public.touch_updated_at();

alter table public.parts_orders enable row level security;
alter table public.parts_orders force row level security;

drop policy if exists "Parts orders access" on public.parts_orders;
create policy "Parts orders access"
  on public.parts_orders
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
-- Payment rail columns. Added to BOTH the org-keyed `invoices` table and the
-- phone-keyed `agent_invoices` table, because the agent still writes
-- agent_invoices until it's re-pointed at the org spine (a later phase) — the
-- payments backend work (Stripe Connect + PayID rail) should not be blocked
-- on that re-point landing first.
-- ---------------------------------------------------------------------------
alter table public.invoices
  add column if not exists payment_method text
    check (payment_method is null or payment_method in ('payid', 'card', 'apple_pay', 'bank_transfer')),
  add column if not exists application_fee_cents integer not null default 0,
  add column if not exists paid_amount_cents integer,
  add column if not exists stripe_payment_intent_id text,
  add column if not exists payid_reference text;

alter table public.agent_invoices
  add column if not exists payment_method text
    check (payment_method is null or payment_method in ('payid', 'card', 'apple_pay', 'bank_transfer')),
  add column if not exists application_fee_cents integer not null default 0,
  add column if not exists paid_amount_cents integer,
  add column if not exists stripe_payment_intent_id text,
  add column if not exists payid_reference text;
