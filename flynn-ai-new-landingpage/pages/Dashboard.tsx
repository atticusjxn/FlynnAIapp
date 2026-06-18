import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Brain, Plug, CalendarDays, FileText, ArrowRight, Sparkles } from 'lucide-react';
import { getSession } from '../services/auth';
import {
  getCurrentOrgId,
  getUpcomingJobs,
  getOpenQuotes,
  getBrainSummary,
  getIntegrations,
  UpcomingJob,
  OpenQuote,
  BrainSummary,
  IntegrationConnection,
} from '../services/api';
import { INTEGRATIONS } from '../data/integrations';

const ORANGE = '#FB5B1E';

function Card({
  title,
  icon: Icon,
  action,
  children,
}: {
  title: string;
  icon: React.FC<{ size?: number; className?: string }>;
  action?: { label: string; onClick: () => void };
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border-2 border-black rounded-xl p-5 shadow-[3px_3px_0_black] flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Icon size={18} className="text-gray-700" />
          <h2 className="font-bold text-[15px]">{title}</h2>
        </div>
        {action && (
          <button
            onClick={action.onClick}
            className="text-xs font-semibold inline-flex items-center gap-1 hover:underline"
            style={{ color: ORANGE }}
          >
            {action.label} <ArrowRight size={13} />
          </button>
        )}
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}

function fmtDate(d: string | null): string {
  if (!d) return '';
  const date = new Date(d + 'T00:00:00');
  return date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

const Dashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<UpcomingJob[]>([]);
  const [quotes, setQuotes] = useState<OpenQuote[]>([]);
  const [brain, setBrain] = useState<BrainSummary | null>(null);
  const [conns, setConns] = useState<IntegrationConnection[]>([]);

  useEffect(() => {
    (async () => {
      const session = await getSession();
      if (!session) {
        navigate('/login');
        return;
      }
      const orgId = await getCurrentOrgId();
      if (orgId) {
        const [j, q, b, c] = await Promise.all([
          getUpcomingJobs(orgId),
          getOpenQuotes(orgId),
          getBrainSummary(orgId),
          getIntegrations(orgId),
        ]);
        setJobs(j);
        setQuotes(q);
        setBrain(b);
        setConns(c);
      }
      setLoading(false);
    })();
  }, [navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-black" />
      </div>
    );
  }

  const connectedProviders = new Set(
    conns.filter((c) => c.status === 'connected').map((c) => c.provider),
  );
  const connectedCount = connectedProviders.size;
  const suggestions = INTEGRATIONS.filter(
    (i) => i.available && !connectedProviders.has(i.provider),
  ).slice(0, 3);

  const businessLabel = brain?.business_type || 'your business';

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-display font-bold">Your business at a glance</h1>
        <p className="text-gray-600 mt-1">
          Flynn builds this up from your chats. The more you text, the more it knows.
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Brain summary — always present (it's the context layer) */}
        <Card
          title="What Flynn knows"
          icon={Brain}
          action={{ label: 'Edit brain', onClick: () => navigate('/app/settings/business-brain') }}
        >
          {brain && (brain.business_type || brain.services.length) ? (
            <div className="space-y-2 text-sm">
              <p>
                <span className="text-gray-400">Business</span>{' '}
                <span className="font-medium capitalize">{businessLabel}</span>
              </p>
              {brain.services.length > 0 && (
                <p>
                  <span className="text-gray-400">Services</span>{' '}
                  <span className="font-medium">{brain.services.length} on file</span>
                </p>
              )}
              {brain.service_areas.length > 0 && (
                <p>
                  <span className="text-gray-400">Area</span>{' '}
                  <span className="font-medium">{brain.service_areas.slice(0, 3).join(', ')}</span>
                </p>
              )}
              {brain.pricing_notes && (
                <p className="text-gray-600 line-clamp-2">{brain.pricing_notes}</p>
              )}
            </div>
          ) : (
            <div className="text-sm text-gray-500">
              <p>Flynn doesn't know your business yet.</p>
              <button
                onClick={() => navigate('/app/settings/business-brain')}
                className="mt-3 text-xs font-semibold text-white border-2 border-black rounded-lg px-3 py-2 shadow-[2px_2px_0_black]"
                style={{ backgroundColor: ORANGE }}
              >
                Set up your brain
              </button>
            </div>
          )}
        </Card>

        {/* Integrations — front and centre: integrations are the product */}
        <Card
          title="Integrations"
          icon={Plug}
          action={{ label: 'Manage', onClick: () => navigate('/dashboard/integrations') }}
        >
          <p className="text-sm mb-3">
            {connectedCount > 0 ? (
              <>
                <span className="font-bold">{connectedCount}</span> connected
              </>
            ) : (
              <span className="text-gray-500">Nothing connected yet.</span>
            )}
          </p>
          {suggestions.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-gray-400">Suggested next</p>
              {suggestions.map((s) => (
                <button
                  key={s.provider}
                  onClick={() => navigate('/dashboard/integrations')}
                  className="w-full flex items-center gap-3 text-left border border-gray-200 rounded-lg px-3 py-2 hover:border-black transition-colors"
                >
                  <s.Icon className="w-7 h-7 shrink-0" />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{s.name}</span>
                    <span className="block text-xs text-gray-500 truncate">{s.value}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </Card>

        {/* Upcoming jobs — adaptive: only when there are any */}
        {jobs.length > 0 && (
          <Card title="Upcoming" icon={CalendarDays}>
            <ul className="divide-y divide-gray-100">
              {jobs.slice(0, 6).map((j) => (
                <li key={j.id} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {j.customer_name || j.service_type || j.summary || 'Booking'}
                    </p>
                    {(j.service_type || j.location) && (
                      <p className="text-xs text-gray-500 truncate">
                        {[j.service_type, j.location].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </div>
                  <span className="text-xs font-medium text-gray-600 whitespace-nowrap">
                    {fmtDate(j.scheduled_date)}
                    {j.scheduled_time ? ` · ${j.scheduled_time.slice(0, 5)}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {/* Open quotes — adaptive: only when there are any */}
        {quotes.length > 0 && (
          <Card title="Open quotes" icon={FileText}>
            <ul className="divide-y divide-gray-100">
              {quotes.slice(0, 6).map((q) => (
                <li key={q.id} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {q.client_name || q.quote_number || 'Quote'}
                    </p>
                    <p className="text-xs text-gray-500 capitalize">{q.status}</p>
                  </div>
                  {q.total != null && (
                    <span className="text-sm font-bold whitespace-nowrap">
                      ${Number(q.total).toLocaleString()}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>

      {/* New / quiet account: steer toward connecting, not empty lists */}
      {jobs.length === 0 && quotes.length === 0 && (
        <div
          className="border-2 border-black rounded-xl p-6 flex items-start gap-4"
          style={{ backgroundColor: '#fff' }}
        >
          <Sparkles size={22} style={{ color: ORANGE }} className="shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">This fills in as you use Flynn.</p>
            <p className="text-sm text-gray-600 mt-1 max-w-xl">
              Text Flynn like you'd text a mate who runs your admin. Bookings, quotes and jobs show
              up here automatically. Connect a few tools so Flynn can act on them for you.
            </p>
            <button
              onClick={() => navigate('/dashboard/integrations')}
              className="mt-4 text-sm font-semibold text-white border-2 border-black rounded-lg px-4 py-2 shadow-[2px_2px_0_black] hover:shadow-[1px_1px_0_black] hover:translate-x-0.5 hover:translate-y-0.5 transition-all"
              style={{ backgroundColor: ORANGE }}
            >
              Connect integrations
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
