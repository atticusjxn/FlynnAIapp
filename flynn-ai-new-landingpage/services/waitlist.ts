// Writes to the current Flynn Supabase project with its publishable key. This is
// deliberately separate from services/supabase.ts, which still points at the old
// project. RLS on flynn_waitlist allows anon INSERT only.
const SUPABASE_URL = import.meta.env.VITE_WAITLIST_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_WAITLIST_SUPABASE_KEY;

export async function joinWaitlist(email: string, source: string, ref?: string): Promise<void> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/flynn_waitlist`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ email: email.trim(), source, ref: ref ?? null }),
  });

  // 409 means this email already joined, which is a success for the visitor.
  if (!response.ok && response.status !== 409) {
    throw new Error('Could not join the waitlist');
  }
}
