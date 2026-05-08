import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { ColdLead } from '@/lib/types';

export function ColdEmailQueue() {
  const queue = useQuery({
    queryKey: ['cold-leads-queue'],
    queryFn: async (): Promise<ColdLead[]> => {
      const { data, error } = await supabase
        .from('gtm_cold_leads')
        .select('*')
        .eq('replied', false)
        .eq('unsubscribed', false)
        .eq('bounced', false)
        .lt('sequence_step', 4)
        .order('next_send_at', { ascending: true, nullsFirst: true })
        .limit(100);
      if (error) throw error;
      return (data as ColdLead[]) ?? [];
    },
  });

  const stats = useQuery({
    queryKey: ['cold-email-stats'],
    queryFn: async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const since7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const [{ count: sent24h }, { count: sent7d }, { count: replied24h }, { count: bounced7d }] =
        await Promise.all([
          supabase
            .from('gtm_email_outreach')
            .select('id', { count: 'exact', head: true })
            .gte('sent_at', since),
          supabase
            .from('gtm_email_outreach')
            .select('id', { count: 'exact', head: true })
            .gte('sent_at', since7),
          supabase
            .from('gtm_cold_leads')
            .select('id', { count: 'exact', head: true })
            .gte('replied_at', since),
          supabase
            .from('gtm_cold_leads')
            .select('id', { count: 'exact', head: true })
            .eq('bounced', true)
            .gte('sent_at', since7),
        ]);
      return {
        sent24h: sent24h ?? 0,
        sent7d: sent7d ?? 0,
        replied24h: replied24h ?? 0,
        bounced7d: bounced7d ?? 0,
      };
    },
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Cold email queue</h1>
        <p className="text-sm text-muted">
          Auto-fires daily via GitHub Actions (07:30 AEST), 30/day cap. Manual sends are{' '}
          <code className="text-xs">npm run send:batch</code>.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Sent (24h)" value={stats.data?.sent24h ?? 0} />
        <Stat label="Sent (7d)" value={stats.data?.sent7d ?? 0} />
        <Stat label="Replies (24h)" value={stats.data?.replied24h ?? 0} />
        <Stat label="Bounces (7d)" value={stats.data?.bounced7d ?? 0} />
      </section>

      <div className="panel overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-zinc-900/40 text-xs uppercase tracking-wider text-muted">
            <tr>
              <th className="px-4 py-2 text-left">Email</th>
              <th className="px-4 py-2 text-left">First name</th>
              <th className="px-4 py-2 text-left">Trade</th>
              <th className="px-4 py-2 text-left">City</th>
              <th className="px-4 py-2 text-left">Step</th>
              <th className="px-4 py-2 text-left">Next send</th>
            </tr>
          </thead>
          <tbody>
            {(queue.data ?? []).map((l) => (
              <tr key={l.id} className="border-b border-border last:border-0">
                <td className="px-4 py-2">{l.email}</td>
                <td className="px-4 py-2 text-muted">{l.first_name || '—'}</td>
                <td className="px-4 py-2 text-muted">{l.trade || '—'}</td>
                <td className="px-4 py-2 text-muted">{l.city || '—'}</td>
                <td className="px-4 py-2">{l.sequence_step}/4</td>
                <td className="px-4 py-2 text-muted">
                  {l.next_send_at
                    ? new Date(l.next_send_at).toLocaleDateString('en-AU')
                    : 'now'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {queue.data?.length === 0 && (
          <div className="p-6 text-center text-sm text-muted">
            Queue empty. Run the scraper: <code>npm run scrape</code>.
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="panel p-4">
      <div className="text-xs uppercase tracking-wider text-muted">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}
