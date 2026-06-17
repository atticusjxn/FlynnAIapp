import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import {
  TRACK_A, TRACK_B, CHALLENGE, BROLL, SCREEN_RECORDS, EDIT_QA, PLAYBOOK,
  type SprintVideo,
} from '../data/sprint';

/**
 * /sprint — the founder's content-sprint, as an interactive mobile checklist.
 * Add-to-homescreen friendly (PWA meta + manifest). Progress persists in
 * localStorage so Atticus can tick clips off over days and watch the bar fill.
 * Public on purpose; it's his accountability surface, not marketing.
 */

const STORE_KEY = 'flynn_sprint_v1';
const HINT_KEY = 'flynn_sprint_a2hs_dismissed';

const C = {
  cream: '#F4E6CE',
  ink: '#2C2018',
  inkSoft: '#6B5A48',
  orange: '#FB5B1E',
  green: '#1FA36B',
  card: '#FFFDF8',
  line: '#E4D4B8',
};

// Every tickable id, so we can compute totals + a "complete" state.
const VIDEO_IDS = [...TRACK_A, ...TRACK_B, ...CHALLENGE].flatMap((v) => [`${v.id}-filmed`, `${v.id}-edited`]);
const BROLL_IDS = BROLL.flatMap((g) => g.items.map((i) => i.id));
const SR_IDS = SCREEN_RECORDS.map((i) => i.id);
const ALL_IDS = [...VIDEO_IDS, ...BROLL_IDS, ...SR_IDS];

function loadState(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

export default function Sprint() {
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [openVideo, setOpenVideo] = useState<string | null>(null);
  const [showRef, setShowRef] = useState(false);
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    setDone(loadState());
    setShowHint(localStorage.getItem(HINT_KEY) !== '1');
  }, []);

  const persist = useCallback((next: Record<string, boolean>) => {
    setDone(next);
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(next));
    } catch {
      /* private mode — ignore */
    }
  }, []);

  const toggle = useCallback(
    (id: string) => persist({ ...done, [id]: !done[id] }),
    [done, persist],
  );

  const completed = useMemo(() => ALL_IDS.filter((id) => done[id]).length, [done]);
  const total = ALL_IDS.length;
  const pct = Math.round((completed / total) * 100);
  const allDone = completed === total;

  const dismissHint = () => {
    setShowHint(false);
    try { localStorage.setItem(HINT_KEY, '1'); } catch { /* ignore */ }
  };

  const resetAll = () => {
    if (window.confirm('Reset all sprint progress? This can\'t be undone.')) persist({});
  };

  return (
    <div style={S.page}>
      <Helmet>
        <title>Flynn Content Sprint</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content={C.orange} />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Sprint" />
        <link rel="manifest" href="/sprint-manifest.json" />
        <meta name="robots" content="noindex" />
      </Helmet>

      {/* Sticky progress header */}
      <header style={S.header}>
        <div style={S.headerRow}>
          <span style={S.kicker}>FLYNN · CONTENT SPRINT</span>
          <button onClick={resetAll} style={S.reset} aria-label="Reset progress">reset</button>
        </div>
        <h1 style={S.h1}>
          {allDone ? 'sprint done. europe, here you come.' : 'film it before europe.'}
        </h1>
        <div style={S.barTrack}>
          <div style={{ ...S.barFill, width: `${pct}%`, background: allDone ? C.green : C.orange }} />
        </div>
        <div style={S.progressMeta}>
          <strong style={{ color: allDone ? C.green : C.ink }}>{completed}/{total}</strong>
          <span style={{ color: C.inkSoft }}> done · {pct}%</span>
        </div>
      </header>

      <main style={S.main}>
        {showHint && (
          <div style={S.hint}>
            <div style={{ flex: 1 }}>
              <strong>add this to your homescreen</strong> — tap Share <span aria-hidden>⎙</span> then
              "Add to Home Screen". Opens full-screen, remembers your ticks.
            </div>
            <button onClick={dismissHint} style={S.hintX} aria-label="Dismiss">×</button>
          </div>
        )}

        <SectionLabel>🟣 Track A — founder / organic (@atticusjxn)</SectionLabel>
        {TRACK_A.map((v) => (
          <VideoCard key={v.id} v={v} done={done} open={openVideo === v.id}
            onOpen={() => setOpenVideo(openVideo === v.id ? null : v.id)} onToggle={toggle} />
        ))}

        <SectionLabel>🔵 Track B — demo / paid ads (→ Message Flynn)</SectionLabel>
        {TRACK_B.map((v) => (
          <VideoCard key={v.id} v={v} done={done} open={openVideo === v.id}
            onOpen={() => setOpenVideo(openVideo === v.id ? null : v.id)} onToggle={toggle} />
        ))}

        <SectionLabel>🟢 Track D — the $1,500 challenge (daily series, @atticusjxn)</SectionLabel>
        <p style={S.note}>Post each night, raw. Cold "day N of $1,500" open + running $ tally on frame 1. Fill the script after you film each day — don't pre-write nights that haven't happened.</p>
        {CHALLENGE.map((v) => (
          <VideoCard key={v.id} v={v} done={done} open={openVideo === v.id}
            onOpen={() => setOpenVideo(openVideo === v.id ? null : v.id)} onToggle={toggle} />
        ))}

        <SectionLabel>🎬 B-roll to grab</SectionLabel>
        <p style={S.note}>Preferably the shot listed, but go with whatever you have best. Grab way more than you think you need.</p>
        {BROLL.map((g) => (
          <div key={g.id} style={S.group}>
            <div style={S.groupTitle}>{g.title}</div>
            {g.items.map((i) => (
              <CheckRow key={i.id} checked={!!done[i.id]} label={i.label} onClick={() => toggle(i.id)} />
            ))}
          </div>
        ))}

        <SectionLabel>📱 Screen-records — one clean take each</SectionLabel>
        <div style={S.group}>
          {SCREEN_RECORDS.map((i) => (
            <CheckRow key={i.id} checked={!!done[i.id]} label={i.label} onClick={() => toggle(i.id)} />
          ))}
        </div>

        {/* Reference — not tickable, collapsible */}
        <button style={S.refToggle} onClick={() => setShowRef((s) => !s)}>
          {showRef ? '▾' : '▸'} reference: editing playbook + on-train QA
        </button>
        {showRef && (
          <div style={S.refBody}>
            {PLAYBOOK.map((p) => (
              <div key={p.heading} style={{ marginBottom: 14 }}>
                <div style={S.refHeading}>{p.heading}</div>
                {p.points.map((pt, idx) => (
                  <div key={idx} style={S.refPoint}>· {pt}</div>
                ))}
              </div>
            ))}
            <div style={S.refHeading}>On-train edit QA (per clip)</div>
            {EDIT_QA.map((q, idx) => (
              <div key={idx} style={S.refPoint}>☐ {q}</div>
            ))}
          </div>
        )}

        {allDone && (
          <div style={S.doneBanner}>
            🎉 every clip filmed + edited, all B-roll, all screen-records.<br />
            that's the sprint. go get the ute packed.
          </div>
        )}

        <div style={S.footer}>built from your production bible · ticks save on this phone</div>
      </main>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h2 style={S.section}>{children}</h2>;
}

function VideoCard({
  v, done, open, onOpen, onToggle,
}: {
  v: SprintVideo; done: Record<string, boolean>; open: boolean;
  onOpen: () => void; onToggle: (id: string) => void;
}) {
  const filmed = !!done[`${v.id}-filmed`];
  const edited = !!done[`${v.id}-edited`];
  const cardDone = filmed && edited;
  return (
    <div style={{ ...S.card, borderColor: cardDone ? C.green : C.line }}>
      <button style={S.cardHead} onClick={onOpen} aria-expanded={open}>
        <div style={S.cardHeadLeft}>
          <span style={{ ...S.code, background: cardDone ? C.green : C.ink }}>{v.code}</span>
          <span style={S.cardTitle}>{v.title}</span>
        </div>
        <span style={S.chev}>{open ? '▾' : '▸'}</span>
      </button>

      <div style={S.meta}>
        <span>{v.badge}</span><span style={S.dot}>·</span><span>{v.length}</span>
        {v.variants && (<><span style={S.dot}>·</span><span style={{ color: C.orange, fontWeight: 700 }}>×5 hooks</span></>)}
      </div>

      <div style={S.hook}>{v.hook}</div>

      {open && (
        <div style={S.detail}>
          <div style={S.detailLabel}>Say this</div>
          <div style={S.scriptBox}>
            {v.script.map((line, i) => <div key={i} style={S.scriptLine}>{line}</div>)}
          </div>
          <div style={S.detailLabel}>Shots</div>
          <ol style={S.ol}>
            {v.shots.map((s, i) => <li key={i} style={S.li}>{s}</li>)}
          </ol>
          <div style={S.kv}><span style={S.k}>Captions</span> {v.captions}</div>
          <div style={S.kv}><span style={S.k}>Audio</span> {v.audio}</div>
          <div style={S.kv}><span style={S.k}>Edit</span> {v.editNote}</div>
        </div>
      )}

      <div style={S.toggles}>
        <ToggleBtn on={filmed} onClick={() => onToggle(`${v.id}-filmed`)} label="FILMED" />
        <ToggleBtn on={edited} onClick={() => onToggle(`${v.id}-edited`)} label="EDITED" />
      </div>
    </div>
  );
}

function ToggleBtn({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} style={{
      ...S.toggle,
      background: on ? C.green : 'transparent',
      color: on ? '#fff' : C.inkSoft,
      borderColor: on ? C.green : C.line,
    }}>
      {on ? '✓ ' : ''}{label}
    </button>
  );
}

function CheckRow({ checked, label, onClick }: { checked: boolean; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={S.checkRow}>
      <span style={{
        ...S.box,
        background: checked ? C.green : 'transparent',
        borderColor: checked ? C.green : C.inkSoft,
      }}>{checked ? '✓' : ''}</span>
      <span style={{ ...S.checkLabel, color: checked ? C.inkSoft : C.ink, textDecoration: checked ? 'line-through' : 'none' }}>{label}</span>
    </button>
  );
}

const S: Record<string, React.CSSProperties> = {
  page: { background: C.cream, color: C.ink, minHeight: '100vh', fontFamily: "'Inter', system-ui, sans-serif", WebkitFontSmoothing: 'antialiased' },
  header: { position: 'sticky', top: 0, zIndex: 10, background: C.cream, padding: '14px 18px 12px', borderBottom: `1px solid ${C.line}`, paddingTop: 'max(14px, env(safe-area-inset-top))' },
  headerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  kicker: { fontSize: 11, letterSpacing: 1.5, fontWeight: 700, color: C.orange },
  reset: { background: 'none', border: 'none', color: C.inkSoft, fontSize: 12, cursor: 'pointer', padding: 4 },
  h1: { fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, fontWeight: 700, margin: '6px 0 12px', lineHeight: 1.15 },
  barTrack: { height: 10, background: C.line, borderRadius: 999, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 999, transition: 'width 0.35s ease' },
  progressMeta: { fontSize: 13, marginTop: 6 },
  main: { padding: '0 16px 64px', maxWidth: 640, margin: '0 auto' },
  hint: { display: 'flex', gap: 10, alignItems: 'flex-start', background: '#FFF3E6', border: `1px solid ${C.orange}`, borderRadius: 12, padding: '12px 14px', margin: '16px 0 8px', fontSize: 13, lineHeight: 1.4 },
  hintX: { background: 'none', border: 'none', fontSize: 22, lineHeight: 1, color: C.inkSoft, cursor: 'pointer', padding: 0 },
  section: { fontFamily: "'Space Grotesk', sans-serif", fontSize: 15, fontWeight: 700, margin: '26px 0 10px', color: C.ink },
  note: { fontSize: 13, color: C.inkSoft, margin: '-4px 0 10px', lineHeight: 1.4 },
  card: { background: C.card, border: '1px solid', borderRadius: 14, padding: '14px 14px 12px', marginBottom: 12 },
  cardHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' },
  cardHeadLeft: { display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 },
  code: { color: '#fff', fontWeight: 700, fontSize: 12, borderRadius: 6, padding: '3px 7px', flexShrink: 0 },
  cardTitle: { fontWeight: 600, fontSize: 15.5, overflow: 'hidden', textOverflow: 'ellipsis' },
  chev: { color: C.inkSoft, fontSize: 14, paddingLeft: 8 },
  meta: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: C.inkSoft, margin: '8px 0 8px' },
  dot: { opacity: 0.5 },
  hook: { fontSize: 14.5, lineHeight: 1.45, color: C.ink, fontStyle: 'italic' },
  detail: { marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.line}` },
  detailLabel: { fontSize: 11, fontWeight: 700, letterSpacing: 1, color: C.orange, marginBottom: 4, marginTop: 4 },
  scriptBox: { background: C.cream, borderRadius: 10, padding: '10px 12px', marginBottom: 12 },
  scriptLine: { fontSize: 14, lineHeight: 1.5, color: C.ink, marginBottom: 7 },
  ol: { margin: '0 0 10px', paddingLeft: 20 },
  li: { fontSize: 13.5, lineHeight: 1.5, marginBottom: 5, color: C.ink },
  kv: { fontSize: 13.5, lineHeight: 1.5, marginBottom: 6, color: C.ink },
  k: { fontWeight: 700, color: C.orange, marginRight: 4 },
  toggles: { display: 'flex', gap: 10, marginTop: 12 },
  toggle: { flex: 1, padding: '11px 0', borderRadius: 10, border: '1.5px solid', fontWeight: 700, fontSize: 13, letterSpacing: 0.5, cursor: 'pointer' },
  group: { background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: '6px 6px', marginBottom: 12 },
  groupTitle: { fontSize: 12.5, fontWeight: 700, color: C.inkSoft, padding: '8px 10px 4px', textTransform: 'uppercase', letterSpacing: 0.5 },
  checkRow: { display: 'flex', alignItems: 'center', gap: 12, width: '100%', background: 'none', border: 'none', padding: '11px 10px', cursor: 'pointer', textAlign: 'left' },
  box: { width: 22, height: 22, borderRadius: 6, border: '2px solid', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13, fontWeight: 700, flexShrink: 0 },
  checkLabel: { fontSize: 14, lineHeight: 1.4 },
  refToggle: { display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', color: C.inkSoft, fontSize: 14, fontWeight: 600, padding: '20px 4px 8px', cursor: 'pointer' },
  refBody: { background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: 16 },
  refHeading: { fontSize: 13.5, fontWeight: 700, color: C.ink, marginBottom: 5 },
  refPoint: { fontSize: 13, lineHeight: 1.5, color: C.inkSoft, marginBottom: 3 },
  doneBanner: { background: '#E9F8F0', border: `1.5px solid ${C.green}`, borderRadius: 14, padding: 18, textAlign: 'center', fontSize: 15, lineHeight: 1.5, fontWeight: 600, color: C.ink, marginTop: 24 },
  footer: { textAlign: 'center', fontSize: 12, color: C.inkSoft, marginTop: 28, opacity: 0.8 },
};
