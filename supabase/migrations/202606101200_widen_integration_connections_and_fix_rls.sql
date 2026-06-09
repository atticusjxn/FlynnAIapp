-- Widen integration_connections to support Flynn's full integration catalogue,
-- and FIX a broken RLS policy that exposed all orgs' connections.
--
-- Context: the original policies referenced `users.org_id`, a column that does
-- not exist. Postgres resolved the unqualified `org_id` in `SELECT org_id FROM
-- users` to the OUTER table (integration_connections), making the predicate
-- `org_id IN (org_id)` — TRUE for every row. Any authenticated user could read
-- and write every org's integration rows. Replaced with is_org_member().

-- ── Widen provider + type CHECK constraints ─────────────────────────────────
ALTER TABLE integration_connections DROP CONSTRAINT IF EXISTS integration_connections_provider_check;
ALTER TABLE integration_connections ADD CONSTRAINT integration_connections_provider_check
  CHECK (provider = ANY (ARRAY[
    'jobber','fergus','servicetitan','google_calendar','apple_calendar','calendly',
    'gmail','xero','myob','quickbooks','stripe','servicem8','instagram','google_drive','dropbox','reece','tradelink'
  ]));

ALTER TABLE integration_connections DROP CONSTRAINT IF EXISTS integration_connections_type_check;
ALTER TABLE integration_connections ADD CONSTRAINT integration_connections_type_check
  CHECK (type = ANY (ARRAY[
    'field_service','calendar','accounting','email','payments','supplier','social','storage'
  ]));

-- ── Fix broken RLS ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view own org connections" ON integration_connections;
DROP POLICY IF EXISTS "Users can manage own org connections" ON integration_connections;

CREATE POLICY "Org members can view connections" ON integration_connections
  FOR SELECT USING (auth.role() = 'service_role' OR is_org_member(org_id));

CREATE POLICY "Org members can manage connections" ON integration_connections
  FOR ALL
  USING (auth.role() = 'service_role' OR is_org_member(org_id))
  WITH CHECK (auth.role() = 'service_role' OR is_org_member(org_id));
