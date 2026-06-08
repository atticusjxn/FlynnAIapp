import React, { useEffect, useState } from 'react';
import { supabase } from '../../../services/supabase';

interface CalendarConnection {
  provider: 'google' | 'apple';
  connected: boolean;
  email?: string;
}

export default function CalendarSection() {
  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleEmail, setGoogleEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return setLoading(false);
      const { data } = await supabase
        .from('calendar_connections')
        .select('provider, email')
        .eq('user_id', user.id)
        .eq('provider', 'google')
        .maybeSingle();
      if (data) { setGoogleConnected(true); setGoogleEmail(data.email); }
      setLoading(false);
    }
    load();
  }, []);

  async function connectGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        scopes: 'https://www.googleapis.com/auth/calendar.readonly',
        redirectTo: `${window.location.origin}/app/settings/calendar`,
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
    });
    if (error) alert(error.message);
  }

  async function disconnectGoogle() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('calendar_connections').delete()
      .eq('user_id', user.id).eq('provider', 'google');
    setGoogleConnected(false); setGoogleEmail(null);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Calendar</h1>
      <p className="text-sm text-gray-500 mb-8">
        Flynn reads your calendar to propose real open slots when a draft needs one.
        It never writes to your calendar without you confirming.
      </p>

      <div className="space-y-4">
        {/* Apple Calendar */}
        <div className="bg-white border-2 border-black rounded p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🍎</span>
              <div>
                <p className="font-semibold text-sm">Apple Calendar</p>
                <p className="text-xs text-gray-500">Granted via the Mac app, no action needed here.</p>
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
                  <p className="text-xs text-gray-500">{googleEmail ?? 'Connected'}</p>
                ) : (
                  <p className="text-xs text-gray-500">Not connected</p>
                )}
              </div>
            </div>
            {!loading && (
              googleConnected ? (
                <button onClick={disconnectGoogle}
                  className="text-xs font-medium text-red-600 border-2 border-red-300 rounded px-3 py-1 hover:bg-red-50 transition-colors">
                  Disconnect
                </button>
              ) : (
                <button onClick={connectGoogle}
                  className="text-xs font-semibold bg-[#FB5B1E] text-white border-2 border-black rounded px-3 py-1.5 shadow-[2px_2px_0_black] hover:shadow-[1px_1px_0_black] hover:translate-x-0.5 hover:translate-y-0.5 transition-all">
                  Connect
                </button>
              )
            )}
          </div>
        </div>
      </div>

      <p className="mt-6 text-xs text-gray-400">
        Flynn only reads free/busy data to find open slots. It never reads event titles or descriptions.
      </p>
    </div>
  );
}
