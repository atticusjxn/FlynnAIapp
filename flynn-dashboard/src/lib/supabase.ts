import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY env vars');
}

// The web session lives here purely for auth (the token Flynn texts). All
// dashboard DATA comes from the JWT-gated backend API, never direct table reads.
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
});

/**
 * Flynn texts a /d/<code> link that bounces to flynnai.app/dashboard with a
 * magic-link token in the URL hash. Exchange it for a session, then clean the URL.
 */
export async function consumeLoginHash(): Promise<boolean> {
  const hash = window.location.hash.replace(/^#/, '');
  if (!hash) return false;
  const params = new URLSearchParams(hash);
  const tokenHash = params.get('token_hash');
  const type = params.get('type');
  if (!tokenHash || !type) return false;
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: type as any });
  // Strip the token from the address bar regardless of outcome.
  window.history.replaceState({}, '', window.location.pathname);
  if (error) {
    console.warn('[auth] verifyOtp failed:', error.message);
    return false;
  }
  return true;
}
