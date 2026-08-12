-- SECURITY: twelve SECURITY DEFINER functions were EXECUTE-able by `anon`, i.e.
-- by anyone holding the publishable anon key, which ships in the iOS bundle and
-- the landing page JS. Because they are SECURITY DEFINER they run as postgres
-- and bypass RLS entirely, so over the public PostgREST /rpc/ endpoint they
-- allowed, with no account at all:
--
--   merge_user_into(old, new, new_email)   merge any user into any other and
--                                          reset their email — account takeover
--   get_user_stats(user_uuid)              any user's job/client counts
--   get_user_event_stats(user_uuid)        any user's booking funnel
--   get_upcoming_events(user_uuid, days)   any user's upcoming jobs, with
--                                          titles and client names
--   get_business_context_for_org(org_id)   any org's full business brain
--   create_org_with_defaults(...)          create orgs at will
--   backfill_legacy_orgs(batch_limit)      mass mutation
--   bump_draft_usage(user_id)              burn any user's quota
--   record_call_event(...)                 inject fabricated call events
--   sync_all_calendars_now()               kick off mass calendar sync (cost)
--   trigger_calendar_sync()                same
--   generate_org_slug(text)                harmless, revoked for consistency
--
-- Every one of these is called only by the backend, which authenticates with
-- SUPABASE_SERVICE_ROLE_KEY. The only RPCs any client calls with the anon key
-- are generate_invoice_number and generate_quote_number (InvoicesRepository /
-- QuotesRepository) — deliberately untouched here.
--
-- is_org_admin/is_org_member are also SECURITY DEFINER with public grants but
-- are left alone: RLS policies call them, so revoking would break row access.
-- Trigger functions are left alone too; PostgREST will not expose a function
-- returning `trigger`.

DO $$
DECLARE
  fn text;
  fns text[] := ARRAY[
    'public.backfill_legacy_orgs(integer)',
    'public.bump_draft_usage(uuid)',
    'public.create_org_with_defaults(text, uuid, text, text)',
    'public.generate_org_slug(text)',
    'public.get_business_context_for_org(uuid)',
    'public.get_upcoming_events(uuid, integer)',
    'public.get_user_event_stats(uuid)',
    'public.get_user_stats(uuid)',
    'public.merge_user_into(uuid, uuid, text)',
    'public.record_call_event(text, text, text, jsonb, timestamp with time zone)',
    'public.sync_all_calendars_now()',
    'public.trigger_calendar_sync()'
  ];
BEGIN
  FOREACH fn IN ARRAY fns LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn);
  END LOOP;
END $$;
