-- Reshape jobs table to voicemail job schema.
set local search_path = public;
set local statement_timeout = '60s';

alter table public.jobs
  drop column if exists client_id,
  drop column if exists service_id,
  drop column if exists title,
  drop column if exists description,
  drop column if exists address,
  drop column if exists quoted_price,
  drop column if exists final_price,
  drop column if exists notes,
  drop column if exists updated_at;

alter table public.jobs
  add column if not exists call_sid text,
  add column if not exists customer_name text,
  add column if not exists customer_phone text,
  add column if not exists summary text,
  add column if not exists service_type text,
  add column if not exists status text default 'new',
  add column if not exists created_at timestamptz default now();

update public.jobs
   set status = coalesce(nullif(status, ''), 'new')
 where status is null or status not in ('new', 'in_progress', 'completed');

update public.jobs
   set created_at = coalesce(created_at, now());

alter table public.jobs
  alter column status set default 'new';

alter table public.jobs
  alter column created_at set default now();

alter table public.jobs
  alter column created_at set not null;

alter table public.jobs
  drop constraint if exists jobs_user_id_fkey;

alter table public.jobs
  add constraint jobs_user_id_fkey
    foreign key (user_id)
    references public.users(id)
    on delete cascade;

alter table public.jobs
  drop constraint if exists jobs_call_sid_fkey;

alter table public.jobs
  add constraint jobs_call_sid_fkey
    foreign key (call_sid)
    references public.calls(call_sid)
    on delete cascade;

alter table public.jobs
  drop constraint if exists jobs_status_check;

alter table public.jobs
  add constraint jobs_status_check
    check (status in ('new', 'in_progress', 'completed'));

create index if not exists jobs_user_id_idx
  on public.jobs(user_id);

create unique index if not exists jobs_call_sid_unique
  on public.jobs(call_sid);
