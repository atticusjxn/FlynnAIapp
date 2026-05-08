import { useQuery } from '@tanstack/react-query';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  BarChart,
  Bar,
  Legend,
} from 'recharts';
import { supabase } from '@/lib/supabase';
import type { DailyLog } from '@/lib/types';

export function Metrics() {
  const logs = useQuery({
    queryKey: ['daily-logs-60d'],
    queryFn: async (): Promise<DailyLog[]> => {
      const since = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from('gtm_daily_log')
        .select('*')
        .gte('log_date', since)
        .order('log_date', { ascending: true });
      if (error) throw error;
      return (data as DailyLog[]) ?? [];
    },
  });

  const data = (logs.data ?? []).map((d) => ({
    date: d.log_date.slice(5),
    trial_starts: d.trial_starts,
    paid: d.paid_conversions,
    running: d.running_total,
    coldEmail: d.trial_starts_breakdown?.coldEmail ?? 0,
    igDm: d.trial_starts_breakdown?.igDm ?? 0,
    paidAds: d.trial_starts_breakdown?.paidAds ?? 0,
    organic: d.trial_starts_breakdown?.organic ?? 0,
  }));

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">Metrics · last 60 days</h1>
        <p className="text-sm text-muted">From gtm_daily_log (written nightly by morning-brief).</p>
      </header>

      <section className="panel p-5">
        <h2 className="mb-3 text-lg font-semibold">Cumulative paying customers</h2>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid stroke="#1f1f23" />
              <XAxis dataKey="date" stroke="#71717a" fontSize={11} />
              <YAxis stroke="#71717a" fontSize={11} />
              <Tooltip contentStyle={{ background: '#111114', border: '1px solid #1f1f23' }} />
              <Line type="monotone" dataKey="running" stroke="#6366f1" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="panel p-5">
        <h2 className="mb-3 text-lg font-semibold">Trial starts by source (daily)</h2>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid stroke="#1f1f23" />
              <XAxis dataKey="date" stroke="#71717a" fontSize={11} />
              <YAxis stroke="#71717a" fontSize={11} />
              <Tooltip contentStyle={{ background: '#111114', border: '1px solid #1f1f23' }} />
              <Legend />
              <Bar dataKey="paidAds" stackId="a" fill="#6366f1" name="Paid ads" />
              <Bar dataKey="coldEmail" stackId="a" fill="#22d3ee" name="Cold email" />
              <Bar dataKey="igDm" stackId="a" fill="#f472b6" name="IG DM" />
              <Bar dataKey="organic" stackId="a" fill="#facc15" name="Organic" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}
