import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { CopyButton } from '@/components/CopyButton';
import { IG_DM_TEMPLATES, igScriptLabel } from '@/templates/ig-dms';
import { FB_POST_TEMPLATES, fbPostLabel } from '@/templates/fb-posts';
import type { FBGroup, IGTarget, IGScript, FBPostType, DailyLog } from '@/lib/types';

export function Today() {
  const yesterdayKey = useQuery({
    queryKey: ['daily-log-yesterday'],
    queryFn: async (): Promise<DailyLog | null> => {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      const yIso = y.toISOString().slice(0, 10);
      const { data } = await supabase
        .from('gtm_daily_log')
        .select('*')
        .eq('log_date', yIso)
        .maybeSingle();
      return (data as DailyLog | null) ?? null;
    },
  });

  const coldStats = useQuery({
    queryKey: ['cold-email-today'],
    queryFn: async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const [{ count: sent24h }, { count: queue }, { count: replied24h }] = await Promise.all([
        supabase
          .from('gtm_email_outreach')
          .select('id', { count: 'exact', head: true })
          .gte('sent_at', since),
        supabase
          .from('gtm_cold_leads')
          .select('id', { count: 'exact', head: true })
          .eq('replied', false)
          .eq('unsubscribed', false)
          .eq('bounced', false)
          .lt('sequence_step', 4),
        supabase
          .from('gtm_cold_leads')
          .select('id', { count: 'exact', head: true })
          .gte('replied_at', since),
      ]);
      return { sent24h: sent24h ?? 0, queue: queue ?? 0, replied24h: replied24h ?? 0 };
    },
  });

  const igTargets = useQuery({
    queryKey: ['ig-targets-today'],
    queryFn: async (): Promise<IGTarget[]> => {
      const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from('gtm_ig_targets')
        .select('*')
        .or(`status.eq.not-contacted,and(status.eq.dm-sent,last_dm_at.lt.${fiveDaysAgo},reply_at.is.null)`)
        .limit(18);
      return (data as IGTarget[]) ?? [];
    },
  });

  const fbGroups = useQuery({
    queryKey: ['fb-groups-today'],
    queryFn: async (): Promise<FBGroup[]> => {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from('gtm_fb_groups')
        .select('*')
        .eq('joined', true)
        .eq('status', 'active')
        .or(`last_posted_at.is.null,last_posted_at.lt.${sevenDaysAgo}`)
        .order('last_posted_at', { ascending: true, nullsFirst: true })
        .limit(5);
      return (data as FBGroup[]) ?? [];
    },
  });

  const yLog = yesterdayKey.data;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">Today</h1>
        <p className="text-sm text-muted">
          {new Date().toLocaleDateString('en-AU', {
            weekday: 'long',
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })}
        </p>
      </header>

      {/* KPI strip */}
      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Kpi label="Yesterday: trial starts" value={yLog?.trial_starts ?? '—'} />
        <Kpi label="Yesterday: paid" value={yLog?.paid_conversions ?? '—'} />
        <Kpi
          label="Goal progress"
          value={`${yLog?.running_total ?? 0}/100`}
          sub={`Target ${import.meta.env.VITE_GOAL_DEADLINE ?? '2026-06-30'}`}
        />
        <Kpi
          label="Cold email queue"
          value={coldStats.data?.queue ?? '—'}
          sub={`Sent 24h: ${coldStats.data?.sent24h ?? 0}`}
        />
      </section>

      {/* Cold email card */}
      <section className="panel p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Cold email · today's batch</h2>
            <p className="text-sm text-muted">
              Auto-fires via GitHub Actions at 07:30 AEST. 30/day cap.
            </p>
          </div>
          <Link to="/queue/cold-email" className="btn-outline">
            Manage queue →
          </Link>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Stat label="Sent (24h)" value={coldStats.data?.sent24h ?? 0} />
          <Stat label="Replied (24h)" value={coldStats.data?.replied24h ?? 0} />
          <Stat label="In queue" value={coldStats.data?.queue ?? 0} />
        </div>
      </section>

      {/* IG DMs */}
      <section className="panel p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            IG DMs · {igTargets.data?.length ?? 0} for today
          </h2>
          <Link to="/queue/ig-dms" className="btn-outline">
            All targets →
          </Link>
        </div>
        {igTargets.isLoading && <p className="text-sm text-muted">Loading…</p>}
        {!igTargets.isLoading && igTargets.data?.length === 0 && (
          <p className="text-sm text-muted">
            No targets queued. Add some in the IG queue tab.
          </p>
        )}
        <ul className="divide-y divide-border">
          {(igTargets.data ?? []).map((t, idx) => {
            const script = pickIGScript(idx);
            return (
              <IGRow key={t.id} target={t} script={script} />
            );
          })}
        </ul>
      </section>

      {/* FB groups */}
      <section className="panel p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            FB groups · {fbGroups.data?.length ?? 0} for today
          </h2>
          <Link to="/queue/fb-groups" className="btn-outline">
            All groups →
          </Link>
        </div>
        {!fbGroups.isLoading && fbGroups.data?.length === 0 && (
          <p className="text-sm text-muted">
            No active joined groups due. Add or mark some joined in the FB queue.
          </p>
        )}
        <ul className="divide-y divide-border">
          {(fbGroups.data ?? []).map((g, idx) => (
            <FBRow key={g.id} group={g} type={pickFBType(idx, g.last_post_type)} />
          ))}
        </ul>
      </section>
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="panel p-4">
      <div className="text-xs uppercase tracking-wider text-muted">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
      {sub && <div className="mt-1 text-xs text-muted">{sub}</div>}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-muted">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
    </div>
  );
}

function IGRow({ target, script }: { target: IGTarget; script: IGScript }) {
  const message = IG_DM_TEMPLATES[script]({ handle: target.handle });
  return (
    <li className="flex items-start gap-4 py-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <a
            href={target.profile_url ?? `https://instagram.com/${target.handle.replace('@', '')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-zinc-100 hover:underline"
          >
            @{target.handle.replace('@', '')}
          </a>
          <span className="text-xs text-muted">
            {target.industry || 'other'} · {(target.follower_count ?? 0).toLocaleString()} followers
          </span>
        </div>
        <div className="text-xs text-muted">{igScriptLabel(script)}</div>
      </div>
      <CopyButton text={message} />
      <MarkDmSentButton targetId={target.id} script={script} />
    </li>
  );
}

function FBRow({ group, type }: { group: FBGroup; type: FBPostType }) {
  const post = FB_POST_TEMPLATES[type]({ trade: group.industry || undefined });
  return (
    <li className="flex items-start gap-4 py-3">
      <div className="flex-1 min-w-0">
        <a
          href={group.url}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-zinc-100 hover:underline"
        >
          {group.name}
        </a>
        <div className="text-xs text-muted">
          {fbPostLabel(type)} · {(group.member_count ?? 0).toLocaleString()} members
        </div>
      </div>
      <CopyButton text={post} />
      <MarkPostedButton groupId={group.id} type={type} />
    </li>
  );
}

function MarkDmSentButton({ targetId, script }: { targetId: string; script: IGScript }) {
  return (
    <button
      className="btn-ghost"
      onClick={async () => {
        await supabase
          .from('gtm_ig_targets')
          .update({
            status: 'dm-sent',
            last_dm_at: new Date().toISOString(),
            last_dm_script: script,
          })
          .eq('id', targetId);
        // Naive refetch — tiny dashboard, not worth a full mutation cache plumb.
        if (typeof window !== 'undefined') window.location.reload();
      }}
    >
      Mark sent
    </button>
  );
}

function MarkPostedButton({ groupId, type }: { groupId: string; type: FBPostType }) {
  return (
    <button
      className="btn-ghost"
      onClick={async () => {
        await supabase
          .from('gtm_fb_groups')
          .update({ last_posted_at: new Date().toISOString(), last_post_type: type })
          .eq('id', groupId);
        if (typeof window !== 'undefined') window.location.reload();
      }}
    >
      Mark posted
    </button>
  );
}

// 60% rev share, 30% free month, 10% feedback — matches gtm-supabase rotateScript.
function pickIGScript(idx: number): IGScript {
  const m = idx % 10;
  if (m < 5) return 'REV_SHARE';
  if (m < 8) return 'FREE_MONTH';
  return 'FEEDBACK';
}

function pickFBType(idx: number, last: FBPostType | null): FBPostType {
  const types: FBPostType[] = ['VALUE_QUESTION', 'CASE_STUDY', 'GENUINE_HELP'];
  const filtered = types.filter((t) => t !== last);
  return filtered[idx % filtered.length] ?? types[idx % types.length]!;
}
