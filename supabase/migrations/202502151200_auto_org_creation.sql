-- Ensure every new auth user automatically gets an organization scaffold.
set local search_path = public;
set local statement_timeout = '60s';

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  metadata jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  display_name text := coalesce(
    nullif(trim(metadata->>'business_name'), ''),
    nullif(trim(metadata->>'full_name'), ''),
    split_part(new.email, '@', 1),
    'Flynn Team'
  );
  website_url text := nullif(trim(metadata->>'website_url'), '');
  timezone_pref text := coalesce(nullif(trim(metadata->>'timezone'), ''), 'UTC');
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

  begin
    perform public.create_org_with_defaults(
      display_name,
      new.id,
      website_url,
      timezone_pref
    );
  exception
    when undefined_function then
      raise warning 'create_org_with_defaults not yet available; skip auto org creation for user %', new.id;
    when others then
      raise warning 'create_org_with_defaults failed for user %: %', new.id, sqlerrm;
  end;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();
