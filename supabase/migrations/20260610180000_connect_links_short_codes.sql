-- Short-code lookup for the connect links Flynn texts users. The texted link
-- becomes /c/<code> (a short, tappable URL) instead of a 250-char JWT in the
-- query string. The /c/:code route mints a fresh Nango connect session at
-- click time and 302s to the Connect UI. Codes are single short-lived secrets.
CREATE TABLE IF NOT EXISTS connect_links (
  code text PRIMARY KEY,
  user_id uuid,
  user_phone text NOT NULL,
  provider text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE connect_links ENABLE ROW LEVEL SECURITY; -- service-role only
CREATE INDEX IF NOT EXISTS connect_links_expires_idx ON connect_links (expires_at);
