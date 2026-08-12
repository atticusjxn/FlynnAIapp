-- SECURITY: public.execute_sql(text) is SECURITY DEFINER, owned by postgres, and
-- had EXECUTE granted to `anon`. The anon key is public by design — it ships in
-- the iOS app bundle and in the landing page's JavaScript — so anyone who read
-- it could call this RPC and run arbitrary SQL as postgres against the whole
-- database. Read every tenant's data, drop any table, escalate at will.
--
-- The original migration (20251027045441) granted to `authenticated` and
-- `service_role`; production had drifted to `anon`. Either way it is a full
-- unauthenticated compromise.
--
-- Only the backend legitimately calls this, via supabaseMcpClient.executeSql,
-- and that client authenticates with SUPABASE_SERVICE_ROLE_KEY. So the fix is
-- to strip every grant except service_role. The function itself should be
-- retired once supabaseMcpClient stops issuing raw SQL.

REVOKE ALL ON FUNCTION public.execute_sql(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.execute_sql(text) FROM anon;
REVOKE ALL ON FUNCTION public.execute_sql(text) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.execute_sql(text) TO service_role;
