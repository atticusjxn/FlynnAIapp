-- Carry the phone number across from auth.users into public.users.
--
-- handle_new_auth_user only ever mirrored id + email, so any user who signed up
-- by phone (app phone-OTP, or the magic link authLink mints after a funnel
-- call) landed with public.users.phone NULL. Every phone-keyed lookup then
-- silently missed them:
--   * /api/voice-onboarding/session finds no staged session, so the receptionist
--     config captured on the call never surfaces at first run
--   * the hosted invoice page resolves the business (and its bank/PayID
--     details) by users.phone, so invoices render with no way to pay
--   * the SMS agent's brain is keyed on phone
--
-- auth.users.phone is stored without the leading '+', so normalise on the way in.
-- The phone column carries a partial unique index, hence the not-exists guard:
-- a collision means another row already owns that identity and merging is a
-- separate concern — never fail sign-up over it.

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
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
  existing_id uuid;
  normalised_phone text := case
    when nullif(trim(new.phone), '') is null then null
    when left(trim(new.phone), 1) = '+' then trim(new.phone)
    else '+' || trim(new.phone)
  end;
begin
  -- Mirror row in public.users, keyed by the auth id.
  begin
    insert into public.users (id, email, phone, created_at, updated_at)
    values (new.id, new.email, normalised_phone, coalesce(new.created_at, now()), now())
    on conflict (id) do update
      set email = excluded.email,
          phone = coalesce(public.users.phone, excluded.phone),
          updated_at = excluded.updated_at;
  exception
    when unique_violation then
      -- Either the email is held by a different id (legacy/orphan row), or the
      -- phone collides with another account. Retry without the phone first: the
      -- mirror row matters more than the phone column.
      begin
        insert into public.users (id, email, created_at, updated_at)
        values (new.id, new.email, coalesce(new.created_at, now()), now())
        on conflict (id) do update
          set email = excluded.email,
              updated_at = excluded.updated_at;
      exception
        when unique_violation then
          begin
            select id into existing_id
              from public.users
             where lower(email) = lower(new.email) and id <> new.id
             limit 1;
            perform public.merge_user_into(existing_id, new.id, new.email);
          exception
            when others then
              raise warning 'handle_new_auth_user: identity merge for % failed: %', new.email, sqlerrm;
          end;
      end;
  end;

  -- Only auto-create an org if the (possibly just-merged) user has none yet.
  if not exists (
    select 1 from public.org_members where user_id = new.id and status = 'active'
  ) then
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
  end if;

  return new;
end;
$function$;

-- The trigger fires on INSERT only, so phone confirmation on an existing auth
-- row (the app's phone-OTP path signs in an already-created user) would still
-- leave the mirror stale. Keep them in step on update too.
create or replace function public.sync_auth_phone_to_users()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  normalised_phone text := case
    when nullif(trim(new.phone), '') is null then null
    when left(trim(new.phone), 1) = '+' then trim(new.phone)
    else '+' || trim(new.phone)
  end;
begin
  if normalised_phone is null then
    return new;
  end if;

  update public.users
     set phone = normalised_phone,
         updated_at = now()
   where id = new.id
     and phone is null
     and not exists (
       select 1 from public.users other
        where other.phone = normalised_phone and other.id <> new.id
     );

  return new;
end;
$function$;

drop trigger if exists on_auth_user_phone_changed on auth.users;
create trigger on_auth_user_phone_changed
  after update of phone on auth.users
  for each row
  execute function public.sync_auth_phone_to_users();

-- One-off backfill for accounts created before the mirror existed.
update public.users u
   set phone = '+' || trim(a.phone),
       updated_at = now()
  from auth.users a
 where a.id = u.id
   and u.phone is null
   and nullif(trim(a.phone), '') is not null
   and not exists (
     select 1 from public.users other
      where other.phone = '+' || trim(a.phone) and other.id <> u.id
   );
