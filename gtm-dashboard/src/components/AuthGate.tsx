import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase, FOUNDER_EMAIL } from '@/lib/supabase';

/**
 * Magic-link gate. Only the founder email can request a link; the RLS policy
 * `is_gtm_founder()` enforces server-side that any other email gets nothing.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { session, loading, email } = useAuth();
  const [requestEmail, setRequestEmail] = useState(FOUNDER_EMAIL);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading2, setLoading2] = useState(false);

  if (loading) {
    return <div className="grid h-screen place-items-center text-muted">Loading…</div>;
  }

  if (!session) {
    return (
      <div className="grid h-screen place-items-center px-6">
        <div className="panel w-full max-w-sm p-6">
          <h1 className="mb-1 text-xl font-semibold">Flynn GTM</h1>
          <p className="mb-5 text-sm text-muted">Founder access only.</p>
          {sent ? (
            <p className="text-sm text-zinc-300">
              Magic link sent. Open the email on this device.
            </p>
          ) : (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setLoading2(true);
                setError(null);
                const { error } = await supabase.auth.signInWithOtp({
                  email: requestEmail,
                  options: {
                    emailRedirectTo:
                      typeof window !== 'undefined' ? window.location.origin : undefined,
                  },
                });
                setLoading2(false);
                if (error) setError(error.message);
                else setSent(true);
              }}
              className="space-y-3"
            >
              <input
                type="email"
                className="field"
                value={requestEmail}
                onChange={(e) => setRequestEmail(e.target.value)}
                required
              />
              <button type="submit" disabled={loading2} className="btn-primary w-full">
                {loading2 ? 'Sending…' : 'Send magic link'}
              </button>
              {error && <p className="text-sm text-red-400">{error}</p>}
            </form>
          )}
        </div>
      </div>
    );
  }

  if (email !== FOUNDER_EMAIL) {
    return (
      <div className="grid h-screen place-items-center px-6 text-center">
        <div className="panel max-w-md p-6">
          <h1 className="mb-2 text-xl font-semibold">Not authorised</h1>
          <p className="mb-4 text-sm text-muted">
            Signed in as <span className="text-zinc-300">{email}</span>. This dashboard is
            founder-only.
          </p>
          <button onClick={() => supabase.auth.signOut()} className="btn-outline">
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
