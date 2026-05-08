import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import Dashboard from './Dashboard';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-neutral-400 text-sm">Loading…</div>
      </div>
    );
  }

  if (!session) return <LoginScreen />;
  return <Dashboard session={session} />;
}

function LoginScreen() {
  const [email, setEmail] = useState('atticusjxn@gmail.com');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState('');
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  async function sendLink() {
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    setBusy(false);
    if (error) setError(error.message);
    else setSent(true);
  }

  async function verifyCode() {
    setVerifying(true);
    setVerifyError(null);
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: code.replace(/\s+/g, ''),
      type: 'email',
    });
    setVerifying(false);
    if (error) setVerifyError(error.message);
    // On success, onAuthStateChange in App() flips us into the dashboard
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="card card-md w-full max-w-md">
        <h1 className="font-display text-3xl font-bold mb-1">Flynn GTM</h1>
        <p className="text-sm text-neutral-500 mb-6">Sign in to see today's queue.</p>

        {!sent && (
          <>
            <label className="text-xs font-medium text-neutral-700 uppercase tracking-wider">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full mt-1 mb-4 px-3 py-2 border border-neutral-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <button onClick={sendLink} disabled={busy} className="btn-primary w-full">
              {busy ? 'Sending…' : 'Send sign-in email'}
            </button>
            {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
          </>
        )}

        {sent && (
          <>
            <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2 mb-4">
              Check {email} — Supabase sent either a sign-in link <em>or</em> a 6-digit code.
              Click the link, or paste the code below.
            </p>

            <label className="text-xs font-medium text-neutral-700 uppercase tracking-wider">6-digit code</label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="123456"
              className="w-full mt-1 mb-3 px-3 py-2 border border-neutral-300 rounded-md text-lg font-mono tracking-[0.4em] text-center focus:outline-none focus:ring-2 focus:ring-brand-500"
              autoFocus
            />
            <button onClick={verifyCode} disabled={verifying || code.length !== 6} className="btn-primary w-full">
              {verifying ? 'Verifying…' : 'Verify code'}
            </button>
            {verifyError && <p className="text-sm text-red-600 mt-3">{verifyError}</p>}
            <button
              onClick={() => { setSent(false); setCode(''); setVerifyError(null); }}
              className="btn-ghost w-full mt-2 text-xs"
            >
              ← Resend or change email
            </button>
          </>
        )}
      </div>
    </div>
  );
}
