-- Registers device push tokens for per-user notifications.
set local search_path = public;
set local statement_timeout = '60s';

create table if not exists public.notification_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  platform text not null check (platform in ('ios', 'android')),
  token text not null unique,
  created_at timestamptz not null default now()
);

alter table public.notification_tokens
  add column if not exists user_id uuid;

alter table public.notification_tokens
  add column if not exists platform text;

alter table public.notification_tokens
  add column if not exists token text;

alter table public.notification_tokens
  add column if not exists created_at timestamptz;

alter table public.notification_tokens
  alter column created_at set default now();

alter table public.notification_tokens
  drop constraint if exists notification_tokens_platform_check;

alter table public.notification_tokens
  add constraint notification_tokens_platform_check
    check (platform in ('ios', 'android'));

create unique index if not exists notification_tokens_token_key
  on public.notification_tokens(token);

create index if not exists notification_tokens_user_id_idx
  on public.notification_tokens(user_id);

alter table public.notification_tokens enable row level security;
alter table public.notification_tokens force row level security;

drop policy if exists "Notification tokens select" on public.notification_tokens;
create policy "Notification tokens select"
  on public.notification_tokens
  for select
  using (user_id = auth.uid());

drop policy if exists "Notification tokens insert" on public.notification_tokens;
create policy "Notification tokens insert"
  on public.notification_tokens
  for insert
  with check (user_id = auth.uid());

drop policy if exists "Notification tokens update" on public.notification_tokens;
create policy "Notification tokens update"
  on public.notification_tokens
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Notification tokens delete" on public.notification_tokens;
create policy "Notification tokens delete"
  on public.notification_tokens
  for delete
  using (user_id = auth.uid());
