-- Fix: handle_new_auth_user trigger fails with 23505 unique-violation when a
-- user signs up via magic link but an orphan public.users row already exists
-- for that email (typical when the iOS app onboarded the user first and the
-- auth.users row was later deleted/never created).
--
-- The original trigger uses ON CONFLICT (id) DO UPDATE which doesn't catch the
-- email unique constraint. The whole INSERT raises and propagates up, killing
-- the auth.users INSERT and returning a 500 to GoTrue / the client.
--
-- Fix: wrap the public.users mirror INSERT in its own EXCEPTION block so an
-- email-conflict downgrades to a warning. The auth.users INSERT now succeeds
-- and the user can sign in. The dashboard's RLS uses email-based lookups
-- (is_gtm_founder()) so id-mismatch is acceptable here.

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  -- Mirror row in public.users.
  -- If the email is already taken by a legacy/orphan row (different id),
  -- swallow the conflict so the auth signup still succeeds. The dashboard
  -- and iOS app can resolve the user by email.
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
  exception
    when unique_violation then
      raise warning 'public.users mirror skipped for % (orphan row with different id): %', new.email, sqlerrm;
  end;

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
$function$;
