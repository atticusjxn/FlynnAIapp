import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { FBGroup } from '@/lib/types';

export function FBQueue() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'joined' | 'not-joined'>('all');

  const groups = useQuery({
    queryKey: ['fb-groups', filter],
    queryFn: async (): Promise<FBGroup[]> => {
      let q = supabase.from('gtm_fb_groups').select('*').order('member_count', { ascending: false });
      if (filter === 'joined') q = q.eq('joined', true);
      if (filter === 'not-joined') q = q.eq('joined', false);
      const { data, error } = await q;
      if (error) throw error;
      return (data as FBGroup[]) ?? [];
    },
  });

  async function toggleJoined(id: string, joined: boolean) {
    await supabase.from('gtm_fb_groups').update({ joined }).eq('id', id);
    qc.invalidateQueries({ queryKey: ['fb-groups'] });
  }

  async function setStatus(id: string, status: FBGroup['status']) {
    await supabase.from('gtm_fb_groups').update({ status }).eq('id', id);
    qc.invalidateQueries({ queryKey: ['fb-groups'] });
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">FB groups</h1>
        <p className="text-sm text-muted">
          Mark groups as joined once you're approved. The Today view surfaces 5/day.
        </p>
      </header>

      <div className="flex gap-2">
        {(['all', 'joined', 'not-joined'] as const).map((s) => (
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
              <th className="px-4 py-2 text-left">Group</th>
              <th className="px-4 py-2 text-left">Members</th>
              <th className="px-4 py-2 text-left">Industry</th>
              <th className="px-4 py-2 text-left">Joined</th>
              <th className="px-4 py-2 text-left">Status</th>
              <th className="px-4 py-2 text-left">Last posted</th>
            </tr>
          </thead>
          <tbody>
            {(groups.data ?? []).map((g) => (
              <tr key={g.id} className="border-b border-border last:border-0">
                <td className="px-4 py-2">
                  <a
                    href={g.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline"
                  >
                    {g.name}
                  </a>
                </td>
                <td className="px-4 py-2 text-muted">
                  {(g.member_count ?? 0).toLocaleString()}
                </td>
                <td className="px-4 py-2 text-muted">{g.industry || '—'}</td>
                <td className="px-4 py-2">
                  <input
                    type="checkbox"
                    checked={g.joined}
                    onChange={(e) => toggleJoined(g.id, e.target.checked)}
                    className="h-4 w-4 accent-indigo-500"
                  />
                </td>
                <td className="px-4 py-2">
                  <select
                    className="field py-1"
                    value={g.status}
                    onChange={(e) => setStatus(g.id, e.target.value as FBGroup['status'])}
                  >
                    <option value="active">active</option>
                    <option value="banned">banned</option>
                    <option value="restricted">restricted</option>
                    <option value="pending-approval">pending-approval</option>
                  </select>
                </td>
                <td className="px-4 py-2 text-muted">
                  {g.last_posted_at
                    ? new Date(g.last_posted_at).toLocaleDateString('en-AU')
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
