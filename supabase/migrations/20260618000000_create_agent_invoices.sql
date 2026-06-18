-- Photo invoices for the iMessage agent.
--
-- Phone-keyed, mirroring agent_quotes. The org-based public.invoices table is the
-- app's invoice model (NOT NULL org_id, FK to organizations) and is never
-- populated by the phone-keyed agent, so the agent gets its own table here.
--
-- RLS is enabled with NO policies on purpose: the agent backend uses the service
-- role (which bypasses RLS), and nothing should be reachable with the anon key.

create table if not exists public.agent_invoices (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid references public.users(id) on delete set null,
  user_phone          text not null,
  client_name         text,
  client_handle       text,
  client_email        text,
  line_items          jsonb not null default '[]'::jsonb,
  subtotal_cents      integer not null default 0,
  tax_cents           integer not null default 0,
  total_cents         integer not null default 0,
  currency            text not null default 'AUD',
  photo_urls          jsonb not null default '[]'::jsonb,
  message             text,
  due_date            date,
  public_token        text not null unique,
  status              text not null default 'sent',
  pdf_url             text,
  share_card_url      text,
  stripe_payment_url  text,
  xero_synced         boolean not null default false,
  sent_at             timestamptz not null default now(),
  viewed_at           timestamptz,
  paid_at             timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists agent_invoices_phone_idx
  on public.agent_invoices (user_phone, created_at desc);

alter table public.agent_invoices enable row level security;

-- Short-lived buffer of job photos the user texts Flynn, so a later
-- "invoice the henderson job" can pull the photos sent moments earlier and embed
-- them. Rows are marked consumed when an invoice claims them; sweep old ones.
create table if not exists public.job_photo_buffer (
  id            uuid primary key default gen_random_uuid(),
  user_phone    text not null,
  storage_path  text not null,
  public_url    text not null,
  summary       text,
  consumed      boolean not null default false,
  created_at    timestamptz not null default now()
);

create index if not exists job_photo_buffer_phone_idx
  on public.job_photo_buffer (user_phone, created_at desc);

alter table public.job_photo_buffer enable row level security;
