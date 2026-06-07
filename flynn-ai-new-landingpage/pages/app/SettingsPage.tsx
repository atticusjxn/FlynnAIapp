import React, { useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { consumeHashTokens, getSectionFromHash } from '../../services/tokenHandoff';
import { supabase } from '../../services/supabase';

/**
 * Auth gate for /app/settings routes.
 * 1. Consumes tokens from URL hash if the Mac app opened this page.
 * 2. Verifies an active session exists — redirects to /login if not.
 * 3. Redirects to the correct section slug from the hash if present.
 */
export default function SettingsPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    async function init() {
      const sectionFromHash = getSectionFromHash();
      const hadTokens = await consumeHashTokens();

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/login?next=/app/settings');
        return;
      }

      if (sectionFromHash) {
        navigate(`/app/settings/${sectionFromHash}`, { replace: true });
      }

      setReady(true);
    }
    init();
  }, []);

  if (!ready) {
    return (
      <div className="min-h-screen bg-[#F4E6CE] flex items-center justify-center">
        <div className="text-gray-500 text-sm">Loading Flynn settings…</div>
      </div>
    );
  }

  return <Outlet />;
}
