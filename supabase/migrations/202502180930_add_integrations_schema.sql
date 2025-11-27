-- Flynn AI Integrations Schema
-- Supports field service (Jobber, Fergus, ServiceTitan) and calendar (Google, Apple, Calendly) integrations

-- Integration connections table
CREATE TABLE IF NOT EXISTS integration_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('jobber', 'fergus', 'servicetitan', 'google_calendar', 'apple_calendar', 'calendly')),
  type TEXT NOT NULL CHECK (type IN ('field_service', 'calendar', 'accounting')),
  status TEXT NOT NULL DEFAULT 'connected' CHECK (status IN ('connected', 'disconnected', 'error', 'pending', 'expired')),

  -- OAuth credentials (encrypted)
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,

  -- Account info
  account_id TEXT,
  account_name TEXT,
  metadata JSONB DEFAULT '{}',

  -- Sync tracking
  last_sync_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Only one active connection per provider per org
  UNIQUE(org_id, provider)
);

-- Entity mappings (Flynn ID <-> External ID)
CREATE TABLE IF NOT EXISTS integration_entity_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('job', 'client', 'event', 'invoice')),
  flynn_entity_id UUID NOT NULL,
  external_entity_id TEXT NOT NULL,

  -- Metadata for conflict resolution
  flynn_updated_at TIMESTAMPTZ,
  external_updated_at TIMESTAMPTZ,
  last_synced_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Prevent duplicate mappings
  UNIQUE(provider, entity_type, flynn_entity_id),
  UNIQUE(provider, entity_type, external_entity_id)
);

-- Sync logs for auditing
CREATE TABLE IF NOT EXISTS integration_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES integration_connections(id) ON DELETE CASCADE,
  sync_type TEXT NOT NULL CHECK (sync_type IN ('push', 'pull', 'bidirectional')),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('job', 'client', 'event', 'invoice')),
  entity_id UUID,

  status TEXT NOT NULL CHECK (status IN ('success', 'failure', 'partial')),
  records_synced INTEGER DEFAULT 0,
  error_message TEXT,
  sync_duration_ms INTEGER,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Sync conflicts table
CREATE TABLE IF NOT EXISTS integration_sync_conflicts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES integration_connections(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('job', 'client', 'event', 'invoice')),
  flynn_entity_id UUID NOT NULL,
  external_entity_id TEXT NOT NULL,

  conflict_type TEXT NOT NULL CHECK (conflict_type IN ('update_conflict', 'delete_conflict', 'duplicate')),
  flynn_data JSONB NOT NULL,
  external_data JSONB NOT NULL,

  resolution_strategy TEXT CHECK (resolution_strategy IN ('flynn_wins', 'external_wins', 'manual', 'merge')),
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_integration_connections_org ON integration_connections(org_id);
CREATE INDEX IF NOT EXISTS idx_integration_connections_provider ON integration_connections(provider);
CREATE INDEX IF NOT EXISTS idx_integration_connections_status ON integration_connections(status);

CREATE INDEX IF NOT EXISTS idx_entity_mappings_flynn ON integration_entity_mappings(provider, entity_type, flynn_entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_mappings_external ON integration_entity_mappings(provider, entity_type, external_entity_id);

CREATE INDEX IF NOT EXISTS idx_sync_logs_connection ON integration_sync_logs(connection_id);
CREATE INDEX IF NOT EXISTS idx_sync_logs_created_at ON integration_sync_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sync_conflicts_connection ON integration_sync_conflicts(connection_id);
CREATE INDEX IF NOT EXISTS idx_sync_conflicts_resolved ON integration_sync_conflicts(resolved);

-- RLS policies
ALTER TABLE integration_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_entity_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_sync_conflicts ENABLE ROW LEVEL SECURITY;

-- Connections: Users can only access their own org's connections
CREATE POLICY "Users can view own org connections" ON integration_connections
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Users can manage own org connections" ON integration_connections
  FOR ALL USING (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
  );

-- Entity mappings: Users can access mappings for their org's entities
CREATE POLICY "Users can view own org entity mappings" ON integration_entity_mappings
  FOR SELECT USING (true); -- Checked at application level

CREATE POLICY "Users can manage own org entity mappings" ON integration_entity_mappings
  FOR ALL USING (true); -- Checked at application level

-- Sync logs: Read-only access for org members
CREATE POLICY "Users can view own org sync logs" ON integration_sync_logs
  FOR SELECT USING (
    connection_id IN (
      SELECT id FROM integration_connections WHERE org_id IN (
        SELECT org_id FROM users WHERE id = auth.uid()
      )
    )
  );

-- Sync conflicts: Full access for org members
CREATE POLICY "Users can view own org sync conflicts" ON integration_sync_conflicts
  FOR SELECT USING (
    connection_id IN (
      SELECT id FROM integration_connections WHERE org_id IN (
        SELECT org_id FROM users WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can resolve own org sync conflicts" ON integration_sync_conflicts
  FOR UPDATE USING (
    connection_id IN (
      SELECT id FROM integration_connections WHERE org_id IN (
        SELECT org_id FROM users WHERE id = auth.uid()
      )
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_integration_connection_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER update_integration_connection_timestamp
  BEFORE UPDATE ON integration_connections
  FOR EACH ROW
  EXECUTE FUNCTION update_integration_connection_timestamp();

-- Comments for documentation
COMMENT ON TABLE integration_connections IS 'OAuth connections to external platforms (Jobber, Fergus, ServiceTitan, Google Calendar, etc.)';
COMMENT ON TABLE integration_entity_mappings IS 'Maps Flynn AI entities (jobs, clients) to external platform IDs';
COMMENT ON TABLE integration_sync_logs IS 'Audit log of all sync operations';
COMMENT ON TABLE integration_sync_conflicts IS 'Tracks conflicts that occur during two-way sync';
