import { useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  supabase,
  fetchTodaysFBGroups,
  fetchTodaysIGTargets,
  fetchTodaysColdLeads,
  fetchPipelineStats,
  fetchRecentDailyLogs,
  markFBGroupPosted,
  markIGDMSent,
  markColdEmailSent,
  GOAL_TOTAL,
  GOAL_START_DATE,
  GOAL_DEADLINE,
  type FBGroupRow,
  type IGTargetRow,
  type ColdLeadRow,
  type DailyLogRow,
} from './lib/supabase';
import {
  COLD_EMAIL_TEMPLATES,
  IG_DM_SCRIPTS,
  FB_GROUP_POSTS,
  fillTemplate,
} from './templates';

type Tab = 'cold-email' | 'ig-dms' | 'fb-groups';

export default function Dashboard({ session }: { session: Session }) {
  const [tab, setTab] = useState<Tab>('cold-email');
  const [fbGroups, setFbGroups] = useState<FBGroupRow[]>([]);
  const [igTargets, setIgTargets] = useState<IGTargetRow[]>([]);
  const [coldLeads, setColdLeads] = useState<ColdLeadRow[]>([]);
  const [pipeline, setPipeline] = useState({ total: 0, notSent: 0, inSequence: 0, hotReplies: 0, bounced: 0 });
  const [dailyLogs, setDailyLogs] = useState<DailyLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([
      fetchTodaysFBGroups(5),
      fetchTodaysIGTargets(18),
      fetchTodaysColdLeads(30),
      fetchPipelineStats(),
      fetchRecentDailyLogs(14),
    ])
      .then(([fb, ig, leads, p, logs]) => {
        if (!alive) return;
        setFbGroups(fb);
        setIgTargets(ig);
        setColdLeads(leads);
        setPipeline(p);
        setDailyLogs(logs);
      })
      .catch((e) => console.error('[dashboard] load error', e))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [refreshKey]);

  const yesterday = dailyLogs[dailyLogs.length - 1];
  const runningTotal = yesterday?.running_total ?? 0;
  const today = new Date();
  const elapsedDays = Math.max(1, Math.floor((today.getTime() - GOAL_START_DATE.getTime()) / 86400000));
  const totalDays = Math.floor((GOAL_DEADLINE.getTime() - GOAL_START_DATE.getTime()) / 86400000);
  const daysLeft = Math.max(0, totalDays - elapsedDays);
  const expected = Math.round((elapsedDays / totalDays) * GOAL_TOTAL);
  const onPace = runningTotal >= expected * 0.85;

  return (
    <div className="min-h-screen bg-neutral-50">
      <Header email={session.user.email ?? ''} onRefresh={() => setRefreshKey((k) => k + 1)} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Top stat cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <GoalCard runningTotal={runningTotal} expected={expected} daysLeft={daysLeft} onPace={onPace} />
          <YesterdayCard yesterday={yesterday} />
          <PipelineCard pipeline={pipeline} />
        </div>

        {/* Today's outreach */}
        <section className="card">
          <div className="px-6 pt-5 pb-3 border-b border-neutral-200 flex items-center justify-between">
            <div>
              <h2 className="font-display text-lg font-bold">Today's outreach</h2>
              <p className="text-xs text-neutral-500 mt-0.5">
                Daily target: 30 cold emails · 18 IG DMs · 5 FB groups
              </p>
            </div>
            <div className="flex gap-1 bg-neutral-100 rounded-md p-1">
              <TabButton active={tab === 'cold-email'} onClick={() => setTab('cold-email')}>
                📧 Cold email · {coldLeads.length}
              </TabButton>
              <TabButton active={tab === 'ig-dms'} onClick={() => setTab('ig-dms')}>
                📱 IG DMs · {igTargets.length}
              </TabButton>
              <TabButton active={tab === 'fb-groups'} onClick={() => setTab('fb-groups')}>
                👥 FB groups · {fbGroups.length}
              </TabButton>
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center text-neutral-400 text-sm">Loading…</div>
          ) : tab === 'cold-email' ? (
            <ColdEmailQueue leads={coldLeads} onSent={() => setRefreshKey((k) => k + 1)} />
          ) : tab === 'ig-dms' ? (
            <IGDMQueue targets={igTargets} onSent={() => setRefreshKey((k) => k + 1)} />
          ) : (
            <FBGroupsQueue groups={fbGroups} onPosted={() => setRefreshKey((k) => k + 1)} />
          )}
        </section>

        {/* History chart */}
        <section className="card card-md">
          <h2 className="font-display text-lg font-bold mb-4">Last 14 days</h2>
          <HistoryChart logs={dailyLogs} />
        </section>
      </main>
    </div>
  );
}

// ==================== Header ====================

const QUICK_LINKS: Array<{ label: string; url: string; emoji: string }> = [
  { label: 'Meta Ads', url: 'https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=560664354692954&date=last_30d', emoji: '📘' },
  { label: 'TikTok Ads', url: 'https://ads.tiktok.com/i18n/dashboard', emoji: '🎵' },
  { label: 'Apple Search', url: 'https://app.searchads.apple.com', emoji: '🍎' },
  { label: 'PostHog', url: 'https://us.posthog.com/project/414817', emoji: '📊' },
  { label: 'Supabase', url: 'https://supabase.com/dashboard/project/zvfeafmmtfplzpnocyjw', emoji: '🗄️' },
  { label: 'Resend', url: 'https://resend.com/emails', emoji: '✉️' },
  { label: 'GitHub Actions', url: 'https://github.com/atticusjxn/FlynnAIapp/actions', emoji: '⚙️' },
  { label: 'Gmail', url: 'https://mail.google.com', emoji: '📧' },
];

function Header({ email, onRefresh }: { email: string; onRefresh: () => void }) {
  return (
    <header className="border-b border-neutral-200 bg-white sticky top-0 z-20 backdrop-blur supports-[backdrop-filter]:bg-white/85">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-7 h-7 bg-brand-500 rounded flex items-center justify-center text-white font-display font-bold text-sm">
            F
          </div>
          <span className="font-display font-bold text-lg">Flynn GTM</span>
        </div>
        <nav className="hidden md:flex items-center gap-1 overflow-x-auto flex-1 justify-center">
          {QUICK_LINKS.map((l) => (
            <a
              key={l.label}
              href={l.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 px-2 py-1 rounded transition-colors whitespace-nowrap"
              title={`Open ${l.label} in new tab`}
            >
              <span className="mr-1">{l.emoji}</span>
              {l.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={onRefresh} className="btn-ghost" title="Refresh">↻</button>
          <span className="hidden lg:inline text-xs text-neutral-500">{email}</span>
          <button onClick={() => supabase.auth.signOut()} className="btn-ghost text-xs">Sign out</button>
        </div>
      </div>
    </header>
  );
}

// ==================== Top cards ====================

function GoalCard({
  runningTotal,
  expected,
  daysLeft,
  onPace,
}: { runningTotal: number; expected: number; daysLeft: number; onPace: boolean }) {
  const pct = Math.min(100, Math.round((runningTotal / GOAL_TOTAL) * 100));
  return (
    <div className="card card-md">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium uppercase tracking-wider text-neutral-500">Goal</span>
        <span className={`pill ${onPace ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
          {onPace ? 'On pace' : 'Behind'}
        </span>
      </div>
      <div className="font-display text-4xl font-bold">{runningTotal}<span className="text-neutral-300 text-2xl">/{GOAL_TOTAL}</span></div>
      <div className="mt-3 h-2 bg-neutral-100 rounded-full overflow-hidden">
        <div className="h-full bg-brand-500 transition-all" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-neutral-500">
        <span>{daysLeft} days left</span>
        <span>Expected today: {expected}</span>
      </div>
    </div>
  );
}

function YesterdayCard({ yesterday }: { yesterday: DailyLogRow | undefined }) {
  return (
    <div className="card card-md">
      <span className="text-xs font-medium uppercase tracking-wider text-neutral-500">Yesterday</span>
      {yesterday ? (
        <>
          <div className="font-display text-4xl font-bold mt-2">
            {yesterday.trial_starts}
            <span className="text-base font-medium text-neutral-500 ml-2">trials</span>
          </div>
          <div className="mt-2 text-sm text-neutral-700">
            <span className="font-semibold">{yesterday.paid_conversions}</span> paid · ${yesterday.revenue_added.toFixed(0)} added
          </div>
          <div className="mt-3 text-xs text-neutral-500">
            {Object.entries(yesterday.trial_starts_breakdown ?? {}).map(([k, v]) => (
              <span key={k} className="mr-3">{k}: {v}</span>
            ))}
          </div>
        </>
      ) : (
        <div className="text-neutral-400 text-sm mt-3">No data yet — first daily log appears tomorrow.</div>
      )}
    </div>
  );
}

function PipelineCard({ pipeline }: { pipeline: ReturnType<typeof Object> & { total: number; notSent: number; inSequence: number; hotReplies: number; bounced: number } }) {
  return (
    <div className="card card-md">
      <span className="text-xs font-medium uppercase tracking-wider text-neutral-500">Cold-email pipeline</span>
      <div className="font-display text-4xl font-bold mt-2">{pipeline.total}</div>
      <div className="text-xs text-neutral-500 mt-1">leads in database</div>
      <div className="grid grid-cols-2 gap-y-2 mt-4 text-sm">
        <span className="text-neutral-600">Not yet sent</span>
        <span className="text-right font-semibold">{pipeline.notSent}</span>
        <span className="text-neutral-600">In sequence</span>
        <span className="text-right font-semibold">{pipeline.inSequence}</span>
        <span className="text-emerald-700">Hot replies</span>
        <span className="text-right font-semibold text-emerald-700">{pipeline.hotReplies}</span>
        <span className="text-red-600">Bounced</span>
        <span className="text-right font-semibold text-red-600">{pipeline.bounced}</span>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${
        active ? 'bg-white shadow-sm text-neutral-900' : 'text-neutral-600 hover:text-neutral-900'
      }`}
    >
      {children}
    </button>
  );
}

// ==================== Cold Email Queue ====================

function ColdEmailQueue({ leads, onSent }: { leads: ColdLeadRow[]; onSent: () => void }) {
  if (leads.length === 0) {
    return (
      <div className="p-12 text-center">
        <p className="text-neutral-500 text-sm mb-2">No cold leads in the queue.</p>
        <p className="text-neutral-400 text-xs">
          Run <code className="font-mono bg-neutral-100 px-1.5 py-0.5 rounded">npm run scrape</code> in gtm-automation/ to add 30 fresh AU tradie leads.
        </p>
      </div>
    );
  }
  return (
    <div className="divide-y divide-neutral-100">
      {leads.map((lead) => (
        <ColdLeadRow key={lead.id} lead={lead} onSent={onSent} />
      ))}
    </div>
  );
}

function ColdLeadRow({ lead, onSent }: { lead: ColdLeadRow; onSent: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const tpl = COLD_EMAIL_TEMPLATES.day1;
  const subject = fillTemplate(tpl.subject, {
    firstName: lead.first_name || 'mate',
    company: lead.company || '',
    trade: lead.trade || 'tradie',
    city: lead.city || 'your area',
  });
  const body = fillTemplate(tpl.body, {
    firstName: lead.first_name || 'mate',
    company: lead.company || '',
    trade: lead.trade || 'tradie',
    city: lead.city || 'your area',
  });

  async function copyAndOpenGmail() {
    await navigator.clipboard.writeText(body);
    const url = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(lead.email)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(url, '_blank', 'noopener');
  }

  async function markSent() {
    setBusy(true);
    try {
      await markColdEmailSent(lead.id, 1, subject);
      onSent();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="px-6 py-3 hover:bg-neutral-50/50 transition-colors">
      <div className="flex items-center gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm truncate">{lead.company || lead.email}</span>
            {lead.city && <span className="text-xs text-neutral-400">· {lead.city}</span>}
            {lead.trade && <span className="text-xs text-neutral-400">· {lead.trade}</span>}
          </div>
          <div className="text-xs text-neutral-500 truncate">{lead.email}{lead.phone ? ` · ${lead.phone}` : ''}</div>
        </div>
        <button onClick={() => setOpen(!open)} className="btn-outline">
          {open ? 'Hide' : 'Preview'}
        </button>
        <button onClick={copyAndOpenGmail} className="btn-outline">Open in Gmail</button>
        <button onClick={markSent} disabled={busy} className="btn-primary">
          {busy ? '…' : 'Mark sent'}
        </button>
      </div>
      {open && (
        <div className="mt-3 ml-0 bg-neutral-50 border border-neutral-200 rounded-md p-4 text-xs">
          <div className="mb-2 pb-2 border-b border-neutral-200">
            <span className="text-neutral-500">Subject:</span> <span className="font-medium">{subject}</span>
          </div>
          <pre className="whitespace-pre-wrap font-sans text-neutral-700 leading-relaxed">{body}</pre>
        </div>
      )}
    </div>
  );
}

// ==================== IG DM Queue ====================

function IGDMQueue({ targets, onSent }: { targets: IGTargetRow[]; onSent: () => void }) {
  if (targets.length === 0) {
    return (
      <div className="p-12 text-center">
        <p className="text-neutral-500 text-sm mb-2">No IG targets surfaced for today.</p>
        <p className="text-neutral-400 text-xs">
          Add Instagram accounts to the gtm_ig_targets table to start. Aim for 50-100 starter handles you already follow.
        </p>
      </div>
    );
  }
  return (
    <div className="divide-y divide-neutral-100">
      {targets.map((t, idx) => (
        <IGDMRow key={t.id} target={t} idx={idx} onSent={onSent} />
      ))}
    </div>
  );
}

function IGDMRow({ target, idx, onSent }: { target: IGTargetRow; idx: number; onSent: () => void }) {
  const script = useMemo<keyof typeof IG_DM_SCRIPTS>(() => {
    const m = idx % 10;
    if (m < 5) return 'REV_SHARE';
    if (m < 8) return 'FREE_MONTH';
    return 'FEEDBACK';
  }, [idx]);
  const [busy, setBusy] = useState(false);

  async function copyAndOpenIG() {
    const text = fillTemplate(IG_DM_SCRIPTS[script].text, { handle: target.handle });
    await navigator.clipboard.writeText(text);
    window.open(target.profile_url ?? `https://instagram.com/${target.handle.replace('@', '')}`, '_blank', 'noopener');
  }

  async function markSent() {
    setBusy(true);
    try {
      await markIGDMSent(target.id, script);
      onSent();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="px-6 py-3 hover:bg-neutral-50/50 transition-colors flex items-center gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">{target.handle}</span>
          <span className="text-xs text-neutral-400">{target.follower_count.toLocaleString()} followers</span>
          <span className="pill bg-neutral-100 text-neutral-700">{target.industry}</span>
          <span className="pill bg-brand-50 text-brand-600 font-medium">{IG_DM_SCRIPTS[script].label}</span>
        </div>
      </div>
      <button onClick={copyAndOpenIG} className="btn-outline">Copy + Open IG</button>
      <button onClick={markSent} disabled={busy} className="btn-primary">
        {busy ? '…' : 'Mark sent'}
      </button>
    </div>
  );
}

// ==================== FB Groups Queue ====================

function FBGroupsQueue({ groups, onPosted }: { groups: FBGroupRow[]; onPosted: () => void }) {
  if (groups.length === 0) {
    return (
      <div className="p-12 text-center">
        <p className="text-neutral-500 text-sm mb-2">No FB groups surfaced for today.</p>
        <p className="text-neutral-400 text-xs">
          Make sure your seeded groups are marked as joined=true in gtm_fb_groups (currently they're seeded as not-joined).
        </p>
      </div>
    );
  }
  return (
    <div className="divide-y divide-neutral-100">
      {groups.map((g, idx) => (
        <FBGroupRow key={g.id} group={g} idx={idx} onPosted={onPosted} />
      ))}
    </div>
  );
}

function FBGroupRow({ group, idx, onPosted }: { group: FBGroupRow; idx: number; onPosted: () => void }) {
  const types: Array<keyof typeof FB_GROUP_POSTS> = ['VALUE_QUESTION', 'CASE_STUDY', 'GENUINE_HELP'];
  const filtered = types.filter((t) => t !== group.last_post_type);
  const suggestedType = filtered[idx % filtered.length] ?? types[idx % types.length];
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function copyAndOpen() {
    await navigator.clipboard.writeText(FB_GROUP_POSTS[suggestedType].text);
    window.open(group.url, '_blank', 'noopener');
  }

  async function markPosted() {
    setBusy(true);
    try {
      await markFBGroupPosted(group.id, suggestedType);
      onPosted();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="px-6 py-3 hover:bg-neutral-50/50 transition-colors">
      <div className="flex items-center gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">{group.name}</span>
            <span className="text-xs text-neutral-400">{group.member_count.toLocaleString()} members</span>
            <span className="pill bg-brand-50 text-brand-600 font-medium">{FB_GROUP_POSTS[suggestedType].label}</span>
          </div>
          <div className="text-xs text-neutral-500 mt-0.5">
            Last posted: {group.last_posted_at ? new Date(group.last_posted_at).toLocaleDateString() : 'never'}
          </div>
        </div>
        <button onClick={() => setOpen(!open)} className="btn-outline">{open ? 'Hide' : 'Preview'}</button>
        <button onClick={copyAndOpen} className="btn-outline">Copy + Open FB</button>
        <button onClick={markPosted} disabled={busy} className="btn-primary">
          {busy ? '…' : 'Mark posted'}
        </button>
      </div>
      {open && (
        <pre className="mt-3 bg-neutral-50 border border-neutral-200 rounded-md p-4 text-xs whitespace-pre-wrap font-sans text-neutral-700 leading-relaxed">
          {FB_GROUP_POSTS[suggestedType].text}
        </pre>
      )}
    </div>
  );
}

// ==================== History Chart ====================

function HistoryChart({ logs }: { logs: DailyLogRow[] }) {
  if (logs.length === 0) {
    return <div className="text-neutral-400 text-sm">No history yet — daily log will populate after the first morning brief runs.</div>;
  }
  const maxTrials = Math.max(1, ...logs.map((l) => l.trial_starts));
  const maxPaid = Math.max(1, ...logs.map((l) => l.paid_conversions));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Sparkline title="Trial starts" logs={logs} value={(l) => l.trial_starts} max={maxTrials} color="bg-blue-500" />
      <Sparkline title="Paid conversions" logs={logs} value={(l) => l.paid_conversions} max={maxPaid} color="bg-emerald-500" />
    </div>
  );
}

function Sparkline({
  title, logs, value, max, color,
}: {
  title: string;
  logs: DailyLogRow[];
  value: (l: DailyLogRow) => number;
  max: number;
  color: string;
}) {
  const total = logs.reduce((s, l) => s + value(l), 0);
  return (
    <div>
      <div className="flex items-end justify-between mb-2">
        <span className="text-xs text-neutral-500 uppercase tracking-wider font-medium">{title}</span>
        <span className="font-display text-2xl font-bold">{total}</span>
      </div>
      <div className="flex items-end gap-1 h-20">
        {logs.map((l) => {
          const h = Math.round((value(l) / max) * 100);
          return (
            <div
              key={l.log_date}
              className="flex-1 flex flex-col justify-end"
              title={`${l.log_date}: ${value(l)}`}
            >
              <div className={`w-full ${color} rounded-sm`} style={{ height: `${Math.max(h, 2)}%` }} />
            </div>
          );
        })}
      </div>
      <div className="flex justify-between mt-1 text-[10px] text-neutral-400">
        <span>{logs[0]?.log_date.slice(5)}</span>
        <span>{logs[logs.length - 1]?.log_date.slice(5)}</span>
      </div>
    </div>
  );
}
