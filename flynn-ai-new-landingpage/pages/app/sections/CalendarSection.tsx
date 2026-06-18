import React, { useEffect, useState } from 'react';
import {
  getCurrentOrgId,
  getIntegrations,
  disconnectIntegration,
  connectIntegration,
} from '../../../services/api';

export default function CalendarSection() {
  const [orgId, setOrgId] = useState<string | null>(null);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleAccount, setGoogleAccount] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const id = await getCurrentOrgId();
      setOrgId(id);
      if (id) {
        const rows = await getIntegrations(id);
        const gc = rows.find((r) => r.provider === 'google_calendar' && r.status === 'connected');
        if (gc) {
          setGoogleConnected(true);
          setGoogleAccount(gc.account_name);
        }
      }
      setLoading(false);
    })();
  }, []);

  async function connectGoogle() {
    setBusy(true);
    try {
      const { authUrl } = await connectIntegration('google-calendar');
      window.location.assign(authUrl);
    } catch (e: any) {
      setBusy(false);
      alert(e?.message || "Couldn't start Google Calendar connect.");
    }
  }

  async function disconnectGoogle() {
    if (!orgId) return;
    setBusy(true);
    try {
      await disconnectIntegration(orgId, 'google_calendar');
      setGoogleConnected(false);
      setGoogleAccount(null);
    } catch (e: any) {
      alert(e?.message || 'Failed to disconnect.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Calendar</h1>
      <p className="text-sm text-gray-500 mb-8">
        Flynn reads your calendar to propose real open slots, and books the agreed time once you confirm.
      </p>

      <div className="space-y-4">
        {/* Apple Calendar */}
        <div className="bg-white border-2 border-black rounded p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🍎</span>
              <div>
                <p className="font-semibold text-sm">Apple Calendar</p>
                <p className="text-xs text-gray-500">Granted via the Flynn iOS app, no action needed here.</p>
              </div>
            </div>
            <span className="text-xs font-medium text-green-700 bg-green-100 border border-green-200 rounded-full px-2.5 py-0.5">
              System permission
            </span>
          </div>
        </div>

        {/* Google Calendar */}
        <div className="bg-white border-2 border-black rounded p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">📆</span>
              <div>
                <p className="font-semibold text-sm">Google Calendar</p>
                {loading ? (
                  <p className="text-xs text-gray-400">Checking…</p>
                ) : googleConnected ? (
                  <p className="text-xs text-gray-500">{googleAccount ?? 'Connected'}</p>
                ) : (
                  <p className="text-xs text-gray-500">Not connected</p>
                )}
              </div>
            </div>
            {!loading &&
              (googleConnected ? (
                <button
                  onClick={disconnectGoogle}
                  disabled={busy}
                  className="text-xs font-medium text-red-600 border-2 border-red-300 rounded px-3 py-1 hover:bg-red-50 transition-colors disabled:opacity-60"
                >
                  Disconnect
                </button>
              ) : (
                <button
                  onClick={connectGoogle}
                  disabled={busy}
                  className="text-xs font-semibold bg-[#FB5B1E] text-white border-2 border-black rounded px-3 py-1.5 shadow-[2px_2px_0_black] hover:shadow-[1px_1px_0_black] hover:translate-x-0.5 hover:translate-y-0.5 transition-all disabled:opacity-60"
                >
                  {busy ? 'Connecting…' : 'Connect'}
                </button>
              ))}
          </div>
        </div>
      </div>

      <p className="mt-6 text-xs text-gray-400">
        Manage every connection from the{' '}
        <a href="/dashboard/integrations" className="underline">
          Integrations
        </a>{' '}
        page.
      </p>
    </div>
  );
}
