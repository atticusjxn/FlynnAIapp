-- Web signup sessions for the flynnai.app/start lead form.
--
-- One row per Stripe Checkout Session (embedded, 7-day trial). The form's answers
-- live here, not only in Stripe metadata (500-char value limit, and we never want
-- to depend on Stripe as our store of record). Provisioning — auth user, org,
-- pool number, receptionist settings — is claimed with a conditional status
-- update so the webhook and the status poll can both trigger it and it still
-- runs exactly once.
create table if not exists public.web_signups (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status text not null default 'pending'
    check (status in ('pending', 'provisioning', 'live', 'failed')),
  ref text,
  email text not null,
  mobile text not null,
  answers jsonb not null,
  stripe_session_id text unique,
  stripe_customer_id text,
  stripe_subscription_id text,
  user_id uuid references public.users(id) on delete set null,
  org_id uuid references public.organizations(id) on delete set null,
  phone_number text,
  calendar_connect_url text,
  provision_claimed_at timestamptz,
  provisioned_at timestamptz,
  error text
);

create index if not exists web_signups_status_idx on public.web_signups(status);

-- Service role only: the browser never reads this table directly.
alter table public.web_signups enable row level security;
