-- Waitlist for flynnai.app while Flynn is parked (no new signups).
--
-- The public site inserts directly with the publishable key, so RLS allows anon
-- INSERT only: nothing on the public site can read the list back.
create table if not exists public.flynn_waitlist (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  email text not null check (char_length(email) <= 254 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  source text check (char_length(source) <= 40),
  ref text check (char_length(ref) <= 80)
);

create unique index if not exists flynn_waitlist_email_key
  on public.flynn_waitlist (lower(email));

alter table public.flynn_waitlist enable row level security;

drop policy if exists "anyone can join the waitlist" on public.flynn_waitlist;
create policy "anyone can join the waitlist"
  on public.flynn_waitlist for insert
  to anon
  with check (true);

revoke all on public.flynn_waitlist from anon, authenticated;
grant insert on public.flynn_waitlist to anon;
