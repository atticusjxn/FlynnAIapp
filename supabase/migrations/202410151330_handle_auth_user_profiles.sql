-- Ensure each Supabase Auth user has a corresponding public.users profile
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, created_at, updated_at)
  values (
    new.id,
    new.email,
    coalesce(new.created_at, now()),
    now()
  )
  on conflict (id) do update
    set email = excluded.email,
        updated_at = excluded.updated_at;

  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();
-- Backfill existing auth users that do not yet have a profile row
insert into public.users (id, email, created_at, updated_at)
select u.id,
       u.email,
       coalesce(u.created_at, now()),
       now()
from auth.users u
left join public.users p on p.id = u.id
where p.id is null;
