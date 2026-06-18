import React, { useEffect, useState } from 'react';
import { supabase, consumeLoginHash } from './lib/supabase';
import { getManifest, regenerate, type Manifest } from './lib/api';
import ManifestRenderer from './components/ManifestRenderer';

type Phase = 'loading' | 'signed-out' | 'not-ready' | 'ready';

export default function App() {
  const [phase, setPhase] = useState<Phase>('loading');
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [reason, setReason] = useState<string>('');
  const [regenBusy, setRegenBusy] = useState(false);

  useEffect(() => {
    (async () => {
      await consumeLoginHash();
      const { data } = await supabase.auth.getSession();
      if (!data.session) { setPhase('signed-out'); return; }
      await loadManifest();
    })();
  }, []);

  async function loadManifest() {
    try {
      const r = await getManifest();
      if (!r.ready || !r.manifest) { setReason(r.reason || ''); setPhase('not-ready'); return; }
      setManifest(r.manifest);
      setPhase('ready');
    } catch {
      setPhase('signed-out');
    }
  }

  async function onRegenerate() {
    setRegenBusy(true);
    try {
      const r = await regenerate();
      setManifest(r.manifest);
    } catch { /* ignore */ } finally { setRegenBusy(false); }
  }

  if (phase === 'loading') return <Centered>loading your dashboard…</Centered>;

  if (phase === 'signed-out') {
    return (
      <Centered>
        <div className="text-center max-w-sm">
          <h1 className="h-display text-2xl mb-2">open the link Flynn texted you</h1>
          <p className="text-neutral-600 text-sm">your dashboard is invite-only. ask Flynn for a fresh link if this one's expired.</p>
        </div>
      </Centered>
    );
  }

  if (phase === 'not-ready') {
    return (
      <Centered>
        <div className="text-center max-w-sm">
          <h1 className="h-display text-2xl mb-2">nothing here yet</h1>
          <p className="text-neutral-600 text-sm">keep using Flynn over text and your custom dashboard will build itself.</p>
        </div>
      </Centered>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="border-b-2 border-neutral-900 bg-white">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <span className="h-display text-xl text-brand-500">Flynn</span>
          <button className="btn-ghost text-xs" disabled={regenBusy} onClick={onRegenerate}>
            {regenBusy ? 'refreshing…' : 'refresh'}
          </button>
        </div>
      </header>
      {manifest && <ManifestRenderer manifest={manifest} />}
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen flex items-center justify-center px-4">{children}</div>;
}
