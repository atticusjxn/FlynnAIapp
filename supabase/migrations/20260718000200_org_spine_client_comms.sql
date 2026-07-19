-- Payments-first pivot: org-keyed system-of-record spine, part 3.
-- Two-way client comms (SMS + email) — previously did not exist at all:
-- Flynn could email/text a client one-way, but replies were invisible to it.
-- See ~/.claude/plans/iridescent-floating-moore.md section "Client two-way
-- comms (biggest new build)".
set local search_path = public;
set local statement_timeout = '60s';

create table if not exists public.client_threads (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  channel text not null check (channel in ('sms', 'email')),
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, client_id, channel)
);

create index if not exists client_threads_org_idx on public.client_threads(org_id, last_message_at desc);
create index if not exists client_threads_client_idx on public.client_threads(client_id);

drop trigger if exists touch_client_threads_updated_at on public.client_threads;
create trigger touch_client_threads_updated_at
  before update on public.client_threads
  for each row
  execute function public.touch_updated_at();

alter table public.client_threads enable row level security;
alter table public.client_threads force row level security;

drop policy if exists "Client threads access" on public.client_threads;
create policy "Client threads access"
  on public.client_threads
  for all
  using (
    auth.role() = 'service_role'
    or public.is_org_member(org_id)
  )
  with check (
    auth.role() = 'service_role'
    or public.is_org_member(org_id)
  );

create table if not exists public.client_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.client_threads(id) on delete cascade,
  direction text not null check (direction in ('in', 'out')),
  body text,
  attachments jsonb not null default '[]'::jsonb,
  -- Threading keys for inbound email replies (match on message-id/subject
  -- back to the invoice/quote that started the thread).
  provider_message_id text,
  in_reply_to text,
  created_at timestamptz not null default now()
);

create index if not exists client_messages_thread_idx
  on public.client_messages(thread_id, created_at desc);
create index if not exists client_messages_provider_message_id_idx
  on public.client_messages(provider_message_id);

-- RLS on client_messages goes through the parent thread's org, since the row
-- itself has no org_id column.
alter table public.client_messages enable row level security;
alter table public.client_messages force row level security;

drop policy if exists "Client messages access" on public.client_messages;
create policy "Client messages access"
  on public.client_messages
  for all
  using (
    auth.role() = 'service_role'
    or exists (
      select 1 from public.client_threads t
      where t.id = client_messages.thread_id
        and public.is_org_member(t.org_id)
    )
  )
  with check (
    auth.role() = 'service_role'
    or exists (
      select 1 from public.client_threads t
      where t.id = client_messages.thread_id
        and public.is_org_member(t.org_id)
    )
  );

-- Keep client_threads.last_message_at fresh without a round trip from the app.
create or replace function public.touch_client_thread_on_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.client_threads
     set last_message_at = new.created_at
   where id = new.thread_id;
  return new;
end;
$$;

drop trigger if exists touch_client_thread_on_message on public.client_messages;
create trigger touch_client_thread_on_message
  after insert on public.client_messages
  for each row
  execute function public.touch_client_thread_on_message();
