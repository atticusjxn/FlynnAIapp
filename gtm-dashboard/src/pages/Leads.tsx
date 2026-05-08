import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { ColdLead } from '@/lib/types';

export function Leads() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');

  const leads = useQuery({
    queryKey: ['leads', search],
    queryFn: async (): Promise<ColdLead[]> => {
      let q = supabase.from('gtm_cold_leads').select('*').order('scraped_at', { ascending: false }).limit(200);
      if (search.trim()) {
        const s = `%${search.trim()}%`;
        q = q.or(`email.ilike.${s},company.ilike.${s},city.ilike.${s},trade.ilike.${s}`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data as ColdLead[]) ?? [];
    },
  });

  async function markReplied(id: string) {
    await supabase
      .from('gtm_cold_leads')
      .update({ replied: true, replied_at: new Date().toISOString() })
      .eq('id', id);
    qc.invalidateQueries({ queryKey: ['leads'] });
  }

  async function unsubscribe(id: string) {
    await supabase.from('gtm_cold_leads').update({ unsubscribed: true }).eq('id', id);
    qc.invalidateQueries({ queryKey: ['leads'] });
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Leads</h1>
        <p className="text-sm text-muted">All scraped + manual cold leads.</p>
      </header>

      <input
        placeholder="Search email, company, city, trade…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="field"
      />

      <div className="panel overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-zinc-900/40 text-xs uppercase tracking-wider text-muted">
            <tr>
              <th className="px-4 py-2 text-left">Email</th>
              <th className="px-4 py-2 text-left">Company</th>
              <th className="px-4 py-2 text-left">Trade</th>
              <th className="px-4 py-2 text-left">City</th>
              <th className="px-4 py-2 text-left">Step</th>
              <th className="px-4 py-2 text-left">Status</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {(leads.data ?? []).map((l) => (
              <tr key={l.id} className="border-b border-border last:border-0">
                <td className="px-4 py-2">{l.email}</td>
                <td className="px-4 py-2 text-muted">{l.company || '—'}</td>
                <td className="px-4 py-2 text-muted">{l.trade || '—'}</td>
                <td className="px-4 py-2 text-muted">{l.city || '—'}</td>
                <td className="px-4 py-2">{l.sequence_step}/4</td>
                <td className="px-4 py-2 text-muted">
                  {l.replied
                    ? '✅ replied'
                    : l.bounced
                      ? '❌ bounced'
                      : l.unsubscribed
                        ? '🚫 unsubscribed'
                        : 'active'}
                </td>
                <td className="px-4 py-2 text-right">
                  {!l.replied && (
                    <button onClick={() => markReplied(l.id)} className="btn-ghost">
                      Mark replied
                    </button>
                  )}
                  {!l.unsubscribed && (
                    <button onClick={() => unsubscribe(l.id)} className="btn-ghost text-zinc-500">
                      Unsub
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
