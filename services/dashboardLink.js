/**
 * Short, tappable login link for the web dashboard.
 *
 * Flynn texts `${SERVER_URL}/d/<code>` (mirrors the /c/<code> connect links).
 * The code is stored in connect_links with provider='dashboard'; the /d/:code
 * route resolves it, mints a fresh Supabase web magic-link token via
 * authLink.generateDashboardLink, and 302s to flynnai.app/dashboard so the
 * browser establishes a session. Keeps the long token out of the texted URL.
 */

const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_SECRET;
const SERVER_URL = (process.env.SERVER_PUBLIC_URL || process.env.SERVER_URL || 'https://flynnai-telephony.fly.dev').replace(/\/$/, '');
const LINK_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function db() {
  if (!supabaseUrl || !supabaseServiceKey) return null;
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Mint a short dashboard login link. Returns `${SERVER_URL}/d/<code>` or null.
 */
async function createDashboardLoginLink({ userId, phone }) {
  const client = db();
  if (!client) return null;
  const code = crypto.randomBytes(8).toString('base64url');
  const { error } = await client.from('connect_links').insert({
    code,
    user_id: userId || null,
    user_phone: phone,
    provider: 'dashboard',
    expires_at: new Date(Date.now() + LINK_TTL_MS).toISOString(),
  });
  if (error) {
    console.warn('[dashboardLink] insert failed:', error.message);
    return null;
  }
  return `${SERVER_URL}/d/${code}`;
}

module.exports = { createDashboardLoginLink };
