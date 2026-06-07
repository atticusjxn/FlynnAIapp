import { supabase } from './supabase';

/**
 * Reads Supabase tokens from the URL hash (placed there by the Mac app's SettingsOpener),
 * establishes the session, then scrubs the tokens from the URL bar.
 *
 * Returns true if tokens were found and consumed, false if the hash was empty or invalid.
 * The caller should check for an existing session when this returns false.
 */
export async function consumeHashTokens(): Promise<boolean> {
  const hash = window.location.hash.slice(1);
  if (!hash) return false;

  const params = new URLSearchParams(hash);
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (!accessToken || !refreshToken) return false;

  const { error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  // Scrub tokens from URL immediately — they must not persist in browser history.
  history.replaceState(null, '', window.location.pathname + window.location.search);

  return !error;
}

/** Returns the section slug from the hash if present (e.g. "business-brain"). */
export function getSectionFromHash(): string | null {
  const hash = window.location.hash.slice(1);
  const params = new URLSearchParams(hash);
  return params.get('section');
}
