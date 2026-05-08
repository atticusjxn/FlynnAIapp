import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { IGTarget } from '@/lib/types';

export function IGQueue() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'not-contacted' | 'dm-sent' | 'replied'>('all');
  const [newHandle, setNewHandle] = useState('');
  const [newIndustry, setNewIndustry] = useState('trades');

  const targets = useQuery({
    queryKey: ['ig-targets', filter],
    queryFn: async (): Promise<IGTarget[]> => {
      let q = supabase.from('gtm_ig_targets').select('*').order('created_at', { ascending: false });
      if (filter !== 'all') q = q.eq('status', filter);
      const { data, error } = await q;
      if (error) throw error;
      return (data as IGTarget[]) ?? [];
    },
  });

  async function addTarget(e: React.FormEvent) {
    e.preventDefault();
    const handle = newHandle.trim().replace(/^@/, '');
    if (!handle) return;
    const { error } = await supabase.from('gtm_ig_targets').insert({
      handle,
      profile_url: `https://instagram.com/${handle}`,
      industry: newIndustry,
      status: 'not-contacted',
    });
    if (error) alert(error.message);
    else {
      setNewHandle('');
      qc.invalidateQueries({ queryKey: ['ig-targets'] });
    }
  }

  async function setStatus(id: string, status: IGTarget['status']) {
    await supabase.from('gtm_ig_targets').update({ status }).eq('id', id);
    qc.invalidateQueries({ queryKey: ['ig-targets'] });
  }

  async function remove(id: string) {
    await supabase.from('gtm_ig_targets').delete().eq('id', id);
    qc.invalidateQueries({ queryKey: ['ig-targets'] });
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">IG DM targets</h1>
        <p className="text-sm text-muted">
          Add accounts to DM. The Today view surfaces 18 each morning.
        </p>
      </header>

      <form onSubmit={addTarget} className="panel flex gap-2 p-4">
        <input
          className="field flex-1"
          placeholder="@handle"
          value={newHandle}
          onChange={(e) => setNewHandle(e.target.value)}
        />
        <select
          className="field max-w-[160px]"
          value={newIndustry}
          onChange={(e) => setNewIndustry(e.target.value)}
        >
          <option value="trades">trades</option>
          <option value="beauty">beauty</option>
          <option value="hospitality">hospitality</option>
          <option value="health">health</option>
          <option value="general">general</option>
        </select>
        <button type="submit" className="btn-primary">
          Add target
        </button>
      </form>

      <div className="flex gap-2">
        {(['all', 'not-contacted', 'dm-sent', 'replied'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={filter === s ? 'btn-primary' : 'btn-outline'}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="panel overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-zinc-900/40 text-xs uppercase tracking-wider text-muted">
            <tr>
              <th className="px-4 py-2 text-left">Handle</th>
              <th className="px-4 py-2 text-left">Industry</th>
              <th className="px-4 py-2 text-left">Status</th>
              <th className="px-4 py-2 text-left">Last DM</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {(targets.data ?? []).map((t) => (
              <tr key={t.id} className="border-b border-border last:border-0">
                <td className="px-4 py-2">
                  <a
                    href={t.profile_url ?? `https://instagram.com/${t.handle}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline"
                  >
                    @{t.handle.replace('@', '')}
                  </a>
                </td>
                <td className="px-4 py-2 text-muted">{t.industry || '—'}</td>
                <td className="px-4 py-2">
                  <select
                    className="field py-1"
                    value={t.status}
                    onChange={(e) => setStatus(t.id, e.target.value as IGTarget['status'])}
                  >
                    <option value="not-contacted">not-contacted</option>
                    <option value="dm-sent">dm-sent</option>
                    <option value="replied">replied</option>
                    <option value="partnership-active">partnership-active</option>
                    <option value="declined">declined</option>
                  </select>
                </td>
                <td className="px-4 py-2 text-muted">
                  {t.last_dm_at
                    ? new Date(t.last_dm_at).toLocaleDateString('en-AU')
                    : '—'}
                </td>
                <td className="px-4 py-2 text-right">
                  <button onClick={() => remove(t.id)} className="btn-ghost text-red-400">
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {targets.data?.length === 0 && (
          <div className="p-6 text-center text-sm text-muted">No targets yet.</div>
        )}
      </div>
    </div>
  );
}
