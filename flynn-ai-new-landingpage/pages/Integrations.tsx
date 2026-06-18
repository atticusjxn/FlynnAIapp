import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getSession } from '../services/auth';
import {
  getCurrentOrgId,
  getIntegrations,
  disconnectIntegration,
  connectIntegration,
  IntegrationConnection,
} from '../services/api';
import { INTEGRATIONS, CATEGORY_ORDER, IntegrationMeta } from '../data/integrations';

type ConnState = Record<string, IntegrationConnection>; // keyed by provider

const ORANGE = '#FB5B1E';
const CREAM = '#F4E6CE';

function StatusPill({ status }: { status?: IntegrationConnection['status'] }) {
  if (status === 'connected') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-green-700 bg-green-100 border border-green-200 rounded-full px-2 py-0.5">
        <span className="w-1.5 h-1.5 rounded-full bg-green-600" /> Connected
      </span>
    );
  }
  if (status === 'error' || status === 'expired') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-700 bg-red-100 border border-red-200 rounded-full px-2 py-0.5">
        <span className="w-1.5 h-1.5 rounded-full bg-red-600" /> {status === 'expired' ? 'Reconnect' : 'Error'}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-500 bg-gray-100 border border-gray-200 rounded-full px-2 py-0.5">
      <span className="w-1.5 h-1.5 rounded-full bg-gray-400" /> Not connected
    </span>
  );
}

function IntegrationCard({
  meta,
  conn,
  busy,
  confirming,
  onConnect,
  onAskDisconnect,
  onCancelDisconnect,
  onConfirmDisconnect,
}: {
  meta: IntegrationMeta;
  conn?: IntegrationConnection;
  busy: boolean;
  confirming: boolean;
  onConnect: () => void;
  onAskDisconnect: () => void;
  onCancelDisconnect: () => void;
  onConfirmDisconnect: () => void;
}) {
  const isConnected = conn?.status === 'connected';
  const Icon = meta.Icon;

  return (
    <div className="bg-white border-2 border-black rounded-xl p-5 flex flex-col shadow-[3px_3px_0_black]">
      <div className="flex items-start justify-between mb-3">
        <div className="w-11 h-11 shrink-0">
          <Icon className="w-11 h-11" />
        </div>
        <StatusPill status={conn?.status} />
      </div>

      <h3 className="font-bold text-[15px] leading-tight">{meta.name}</h3>
      <p className="text-xs text-gray-500 mt-1 flex-1">{meta.value}</p>

      {isConnected && conn?.account_name && (
        <p className="text-[11px] text-gray-400 mt-2 truncate">{conn.account_name}</p>
      )}

      <div className="mt-4">
        {!meta.available ? (
          <button
            disabled
            title={meta.note || 'Coming soon'}
            className="w-full text-xs font-semibold text-gray-400 bg-gray-100 border-2 border-gray-200 rounded-lg px-3 py-2 cursor-not-allowed"
          >
            {meta.note || 'Coming soon'}
          </button>
        ) : isConnected ? (
          confirming ? (
            <div className="flex gap-2">
              <button
                onClick={onConfirmDisconnect}
                disabled={busy}
                className="flex-1 text-xs font-semibold text-white bg-red-600 border-2 border-black rounded-lg px-3 py-2 disabled:opacity-60"
              >
                {busy ? 'Removing…' : 'Confirm'}
              </button>
              <button
                onClick={onCancelDisconnect}
                disabled={busy}
                className="flex-1 text-xs font-semibold text-gray-700 bg-white border-2 border-gray-300 rounded-lg px-3 py-2"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={onAskDisconnect}
              className="w-full text-xs font-semibold text-red-600 bg-white border-2 border-red-300 rounded-lg px-3 py-2 hover:bg-red-50 transition-colors"
            >
              Disconnect
            </button>
          )
        ) : (
          <button
            onClick={onConnect}
            disabled={busy}
            className="w-full text-xs font-semibold text-white border-2 border-black rounded-lg px-3 py-2 shadow-[2px_2px_0_black] hover:shadow-[1px_1px_0_black] hover:translate-x-0.5 hover:translate-y-0.5 transition-all disabled:opacity-60"
            style={{ backgroundColor: ORANGE }}
          >
            {busy ? 'Connecting…' : 'Connect'}
          </button>
        )}
      </div>
    </div>
  );
}

export default function Integrations() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [conns, setConns] = useState<ConnState>({});
  const [busyProvider, setBusyProvider] = useState<string | null>(null);
  const [confirmProvider, setConfirmProvider] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  // Initial load + session guard
  useEffect(() => {
    (async () => {
      const session = await getSession();
      if (!session) {
        navigate('/login');
        return;
      }
      const id = await getCurrentOrgId();
      setOrgId(id);
      if (id) {
        const rows = await getIntegrations(id);
        setConns(Object.fromEntries(rows.map((r) => [r.provider, r])));
      }
      setLoading(false);
    })();
  }, [navigate]);

  const startConnect = async (meta: IntegrationMeta, token?: string) => {
    setBusyProvider(meta.provider);
    setBanner(`Connecting your ${meta.name}…`);
    try {
      const { authUrl } = await connectIntegration(meta.connectSlug, token);
      window.location.assign(authUrl);
    } catch (e: any) {
      setBanner(null);
      setBusyProvider(null);
      alert(e?.message || `Couldn't start ${meta.name} connect. Please try again.`);
    }
  };

  // SMS deep-link: /dashboard/integrations?connect=<provider>&token=<jwt>
  // Auto-triggers the connect flow, forwarding the signed token to the server.
  useEffect(() => {
    if (loading) return;
    const connect = searchParams.get('connect');
    if (!connect) return;
    const token = searchParams.get('token') || undefined;
    const meta = INTEGRATIONS.find((i) => i.provider === connect || i.connectSlug === connect);
    // scrub query params regardless so a refresh doesn't re-fire
    setSearchParams({}, { replace: true });
    if (meta && meta.available) {
      startConnect(meta, token);
    } else if (meta) {
      setBanner(`${meta.name} isn't available to connect yet.`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  const handleDisconnect = async (meta: IntegrationMeta) => {
    if (!orgId) return;
    setBusyProvider(meta.provider);
    try {
      await disconnectIntegration(orgId, meta.provider);
      setConns((prev) => {
        const next = { ...prev };
        if (next[meta.provider]) next[meta.provider] = { ...next[meta.provider], status: 'disconnected' };
        return next;
      });
      setConfirmProvider(null);
    } catch (e: any) {
      alert(e?.message || 'Failed to disconnect.');
    } finally {
      setBusyProvider(null);
    }
  };

  const connectedCount = useMemo(
    () => Object.values(conns).filter((c) => c.status === 'connected').length,
    [conns],
  );

  const grouped = useMemo(() => {
    const map: Record<string, IntegrationMeta[]> = {};
    for (const i of INTEGRATIONS) (map[i.category] ||= []).push(i);
    return map;
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-black" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-display font-bold">Integrations</h1>
        <p className="text-gray-600 mt-1 max-w-2xl">
          Connect the tools you already use and Flynn can act on them for you — straight from a text.
          Add more as you go; each one unlocks something new.
        </p>
        <p className="text-sm text-gray-500 mt-2">
          {connectedCount > 0
            ? `${connectedCount} connected`
            : 'Nothing connected yet — start with your calendar.'}
        </p>
      </header>

      {banner && (
        <div
          className="border-2 border-black rounded-lg px-4 py-3 text-sm font-medium"
          style={{ backgroundColor: CREAM }}
        >
          {banner}
        </div>
      )}

      {CATEGORY_ORDER.filter((c) => grouped[c]?.length).map((category) => (
        <section key={category}>
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">{category}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {grouped[category].map((meta) => (
              <IntegrationCard
                key={meta.provider}
                meta={meta}
                conn={conns[meta.provider]}
                busy={busyProvider === meta.provider}
                confirming={confirmProvider === meta.provider}
                onConnect={() => startConnect(meta)}
                onAskDisconnect={() => setConfirmProvider(meta.provider)}
                onCancelDisconnect={() => setConfirmProvider(null)}
                onConfirmDisconnect={() => handleDisconnect(meta)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
