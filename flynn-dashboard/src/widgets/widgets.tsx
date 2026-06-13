import React, { useEffect, useState } from 'react';
import { getWidgetData, type Module } from '../lib/api';
import ActionButton from './ActionButton';

export interface WidgetProps { module: Module; }

/** Shared card shell with title, proactive line, and CTAs. */
function WidgetCard({ module, children }: { module: Module; children?: React.ReactNode }) {
  return (
    <div className="card card-md flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <h3 className="h-display text-lg">{module.title}</h3>
      </div>
      {module.proactive && <p className="text-sm text-neutral-700">{module.proactive}</p>}
      {children}
      {module.actions?.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {module.actions.map((a, i) => <ActionButton key={i} action={a} variant={i === 0 ? 'primary' : 'outline'} />)}
        </div>
      )}
    </div>
  );
}

/** Lazily fetch a widget's bound data. */
function useWidgetData<T = any>(type: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let live = true;
    getWidgetData<T>(type)
      .then((r) => { if (live) setData(r.data); })
      .catch(() => { if (live) setData(null); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [type]);
  return { data, loading };
}

function CountLine({ type, label }: { type: string; label: string }) {
  const { data, loading } = useWidgetData<{ count_30d: number }>(type);
  if (loading) return <span className="text-xs text-neutral-400">loading…</span>;
  return <span className="text-sm text-neutral-500">{data?.count_30d ?? 0} {label} in the last 30 days</span>;
}

export function InvoicingWidget({ module }: WidgetProps) {
  return <WidgetCard module={module}><CountLine type="invoicing" label="invoices" /></WidgetCard>;
}

export function ExpensesWidget({ module }: WidgetProps) {
  return <WidgetCard module={module}><CountLine type="expenses" label="expenses logged" /></WidgetCard>;
}

export function EmailWidget({ module }: WidgetProps) {
  return <WidgetCard module={module}><CountLine type="email" label="email actions" /></WidgetCard>;
}

export function JobsPipelineWidget({ module }: WidgetProps) {
  const { data, loading } = useWidgetData<{ jobs: Array<{ id: string; customer_name: string; service_type: string; status: string }> }>('jobs_pipeline');
  return (
    <WidgetCard module={module}>
      {loading ? <span className="text-xs text-neutral-400">loading…</span> : (
        <ul className="flex flex-col gap-1">
          {(data?.jobs || []).slice(0, 6).map((j) => (
            <li key={j.id} className="flex items-center justify-between text-sm border-b border-neutral-100 py-1">
              <span className="font-medium">{j.customer_name || 'job'}</span>
              <span className="text-neutral-500">{j.service_type || ''}</span>
              <span className="pill bg-brand-100 text-brand-700">{j.status}</span>
            </li>
          ))}
          {(!data?.jobs || data.jobs.length === 0) && <span className="text-sm text-neutral-400">no jobs yet</span>}
        </ul>
      )}
    </WidgetCard>
  );
}

export function CalendarWidget({ module }: WidgetProps) {
  const { data, loading } = useWidgetData<{ jobs: Array<{ id: string; customer_name: string; created_at: string }> }>('calendar');
  return (
    <WidgetCard module={module}>
      {loading ? <span className="text-xs text-neutral-400">loading…</span> : (
        <ul className="flex flex-col gap-1">
          {(data?.jobs || []).slice(0, 5).map((j) => (
            <li key={j.id} className="text-sm flex justify-between border-b border-neutral-100 py-1">
              <span>{j.customer_name || 'booking'}</span>
              <span className="text-neutral-400">{new Date(j.created_at).toLocaleDateString()}</span>
            </li>
          ))}
        </ul>
      )}
    </WidgetCard>
  );
}

export function ClientsCrmWidget({ module }: WidgetProps) {
  const { data, loading } = useWidgetData<{ clients: Array<{ label: string; facts: Array<{ fact: string }> }> }>('clients_crm');
  return (
    <WidgetCard module={module}>
      {loading ? <span className="text-xs text-neutral-400">loading…</span> : (
        <div className="flex flex-col gap-2">
          {(data?.clients || []).slice(0, 5).map((c, i) => (
            <div key={i} className="text-sm">
              <div className="font-semibold">{c.label}</div>
              <ul className="text-neutral-600 list-disc pl-4">
                {c.facts.slice(0, 3).map((f, j) => <li key={j}>{f.fact}</li>)}
              </ul>
            </div>
          ))}
          {(!data?.clients || data.clients.length === 0) && <span className="text-sm text-neutral-400">no client notes yet</span>}
        </div>
      )}
    </WidgetCard>
  );
}

export function SuppliersWidget({ module }: WidgetProps) {
  const { data, loading } = useWidgetData<{ suppliers: string[] | null }>('suppliers');
  const suppliers = Array.isArray(data?.suppliers) ? data!.suppliers : [];
  return (
    <WidgetCard module={module}>
      {loading ? <span className="text-xs text-neutral-400">loading…</span> : (
        <div className="flex flex-wrap gap-2">
          {suppliers.length ? suppliers.map((s, i) => <span key={i} className="pill bg-neutral-100 text-neutral-700">{s}</span>)
            : <span className="text-sm text-neutral-400">no suppliers saved yet</span>}
        </div>
      )}
    </WidgetCard>
  );
}

export function BusinessBrainWidget({ module }: WidgetProps) {
  const { data, loading } = useWidgetData<{ brain: Record<string, unknown> }>('business_brain');
  const entries = data?.brain ? Object.entries(data.brain).filter(([, v]) => typeof v !== 'object') : [];
  return (
    <WidgetCard module={module}>
      {loading ? <span className="text-xs text-neutral-400">loading…</span> : (
        <dl className="text-sm grid grid-cols-1 gap-1">
          {entries.slice(0, 8).map(([k, v]) => (
            <div key={k} className="flex justify-between border-b border-neutral-100 py-0.5">
              <dt className="text-neutral-500">{k.replace(/_/g, ' ')}</dt>
              <dd className="font-medium text-right">{String(v)}</dd>
            </div>
          ))}
        </dl>
      )}
    </WidgetCard>
  );
}

export function ConnectToolsWidget({ module }: WidgetProps) {
  const { data, loading } = useWidgetData<{ connections: Array<{ provider: string; status: string }> }>('connect_tools');
  return (
    <WidgetCard module={module}>
      {loading ? <span className="text-xs text-neutral-400">loading…</span> : (
        <div className="flex flex-wrap gap-2">
          {(data?.connections || []).map((c, i) => (
            <span key={i} className={`pill ${c.status === 'connected' ? 'bg-green-100 text-green-700' : 'bg-neutral-100 text-neutral-500'}`}>
              {c.provider}
            </span>
          ))}
        </div>
      )}
    </WidgetCard>
  );
}

export function UnknownWidget({ module }: WidgetProps) {
  // Forward-compat: a manifest from a newer generator with an unknown type
  // renders a minimal card instead of crashing.
  return <WidgetCard module={module} />;
}
