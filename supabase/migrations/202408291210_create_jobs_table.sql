create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  call_sid text references public.calls(call_sid) on delete cascade,
  customer_name text,
  customer_phone text,
  summary text,
  service_type text,
  status text default 'new',
  created_at timestamptz default now()
);

create index if not exists jobs_user_id_idx on public.jobs(user_id);
create unique index if not exists jobs_call_sid_unique on public.jobs(call_sid);
