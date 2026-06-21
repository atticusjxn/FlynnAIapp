import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import {
  TRACK_A, TRACK_B, CHALLENGE, BROLL, SCREEN_RECORDS, EDIT_QA, PLAYBOOK, POST_PLAN,
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

// ── How to film it: the "film everything raw, edit on the plane" plan ──────────
// Six phone albums. Bag content into each one this week, cut it all in transit.
const CAPTURE_INTRO =
  'The move: film everything raw this week into these 6 phone albums, then cut it all on the plane. Don\'t edit as you go.';
const CAPTURE_OUTRO =
  'Edit Mon/Tue/Wed — one video per sitting: pull that code\'s voice memo + hook take + job B-roll + screen-record, cut to the beat.';
const CAPTURE_BUCKETS: { tag: string; desc: string }[] = [
  { tag: 'HOOKS', desc: 'Just you talking to camera — the first line of each video. Film 3-4 takes of every hook below, ~10s each. Don\'t memorise it word for word, say it like you mean it.' },
  { tag: 'VOICE MEMOS', desc: 'Record each script as a voice memo while you drive — that\'s your voiceover. One memo per video, name it by code (A1, A6…). Talking while driving = natural delivery.' },
  { tag: 'ON THE JOB', desc: 'The real after-work work: mowing, whipper-snipping, hauling, the tip run, fading light. Un-fakeable proof. Grab way more than you think you need.' },
  { tag: 'UTE', desc: 'Driver-seat talking head, driving POV, phone-in-hand texting Flynn, the receipt pile on the console.' },
  { tag: 'BUILD / NIGHT', desc: 'You at the laptop, screen glow, the scrappy late-night setup. The other half of the fusion.' },
  { tag: 'SCREEN-RECORDS', desc: 'The Flynn demos (list near the bottom). One clean take each — do these at home where it\'s quiet.' },
];

// ── Copy-for-Notes: serialise the sprint to clean plain text you can paste ─────
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* fall through to legacy path */ }
  // iOS (esp. in "Add to Home Screen" standalone mode) often blocks the async
  // clipboard API. This execCommand path needs the iOS-specific selection dance:
  // a plain ta.select() is ignored, so use a range + setSelectionRange.
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.contentEditable = 'true';
    ta.readOnly = false;
    ta.style.position = 'fixed';
    ta.style.top = '0';
    ta.style.left = '0';
    ta.style.width = '1px';
    ta.style.height = '1px';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    const range = document.createRange();
    range.selectNodeContents(ta);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy');
    sel?.removeAllRanges();
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

function videoToText(v: SprintVideo): string {
  const head = `${v.code} — ${v.title}\n${v.badge} · ${v.length}${v.variants ? ' · ×5 hooks' : ''}`;
  const hook = `HOOK (frame 1): ${v.hook}`;
  const say = ['SAY THIS:', ...v.script.map((s) => `  • ${s}`)].join('\n');
  const shots = ['SHOTS:', ...v.shots.map((s, i) => `  ${i + 1}. ${s}`)].join('\n');
  const meta = `CAPTIONS: ${v.captions}\nAUDIO: ${v.audio}\nEDIT: ${v.editNote}`;
  return [head, hook, '', say, '', shots, '', meta].join('\n');
}

const RULE = '\n\n— — — — — — — —\n\n';
function tracksToText(title: string, vids: SprintVideo[]): string {
  return `${title}\n\n${vids.map(videoToText).join(RULE)}`;
}
function brollToText(): string {
  const groups = BROLL.map(
    (g) => `${g.title}\n${g.items.map((i) => `  ☐ ${i.label}`).join('\n')}`,
  ).join('\n\n');
  return `B-ROLL TO GRAB\n\n${groups}`;
}
function srToText(): string {
  return `SCREEN-RECORDS (one clean take each)\n\n${SCREEN_RECORDS.map((i) => `  ☐ ${i.label}`).join('\n')}`;
}
function bucketsToText(): string {
  const body = CAPTURE_BUCKETS.map((b) => `${b.tag}\n  ${b.desc}`).join('\n\n');
  return `HOW TO FILM THIS\n\n${CAPTURE_INTRO}\n\n${body}\n\n${CAPTURE_OUTRO}`;
}
function planToText(): string {
  const rows = POST_PLAN.map(
    (p) => `  ☐ ${p.date} — ${p.code} · ${p.title}\n      ${p.why}`,
  ).join('\n\n');
  return `POSTING PLAN — one a day, 24 Jun → 5 Jul (post to IG Reels + TikTok)\n\n${rows}`;
}
function allToText(): string {
  return [
    'FLYNN — CONTENT SPRINT',
    planToText(),
    bucketsToText(),
    tracksToText('TRACK A — founder / organic (@atticusjxn)', TRACK_A),
    tracksToText('TRACK B — demo / paid ads (→ Message Flynn)', TRACK_B),
    tracksToText('TRACK D — the $2,500 challenge (daily series)', CHALLENGE),
    brollToText(),
    srToText(),
  ].join('\n\n\n');
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

        <CaptureCard />

        <PostingPlan done={done} onToggle={toggle} />

        <CopyAllBlock />

        <SectionLabel copy={() => tracksToText('TRACK A — founder / organic (@atticusjxn)', TRACK_A)}>🟣 Track A — founder / organic (@atticusjxn)</SectionLabel>
        {TRACK_A.map((v) => (
          <VideoCard key={v.id} v={v} done={done} open={openVideo === v.id}
            onOpen={() => setOpenVideo(openVideo === v.id ? null : v.id)} onToggle={toggle} />
        ))}

        <SectionLabel copy={() => tracksToText('TRACK B — demo / paid ads (→ Message Flynn)', TRACK_B)}>🔵 Track B — demo / paid ads (→ Message Flynn)</SectionLabel>
        {TRACK_B.map((v) => (
          <VideoCard key={v.id} v={v} done={done} open={openVideo === v.id}
            onOpen={() => setOpenVideo(openVideo === v.id ? null : v.id)} onToggle={toggle} />
        ))}

        <SectionLabel copy={() => tracksToText('TRACK D — the $2,500 challenge (daily series)', CHALLENGE)}>🟢 Track D — the $2,500 challenge (daily series, @atticusjxn)</SectionLabel>
        <p style={S.note}>Post each day, raw. Cold "day N of $2,500" open + running $ tally on frame 1. Fill the script after you film each day — don't pre-write days that haven't happened.</p>
        {CHALLENGE.map((v) => (
          <VideoCard key={v.id} v={v} done={done} open={openVideo === v.id}
            onOpen={() => setOpenVideo(openVideo === v.id ? null : v.id)} onToggle={toggle} />
        ))}

        <SectionLabel copy={brollToText}>🎬 B-roll to grab</SectionLabel>
        <p style={S.note}>Preferably the shot listed, but go with whatever you have best. Grab way more than you think you need.</p>
        {BROLL.map((g) => (
          <div key={g.id} style={S.group}>
            <div style={S.groupTitle}>{g.title}</div>
            {g.items.map((i) => (
              <CheckRow key={i.id} checked={!!done[i.id]} label={i.label} onClick={() => toggle(i.id)} />
            ))}
          </div>
        ))}

        <SectionLabel copy={srToText}>📱 Screen-records — one clean take each</SectionLabel>
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

function SectionLabel({ children, copy }: { children: React.ReactNode; copy?: () => string }) {
  return (
    <div style={S.sectionRow}>
      <h2 style={S.section}>{children}</h2>
      {copy && <CopyBtn getText={copy} />}
    </div>
  );
}

// The whole-sprint copy. Programmatic copy first, but iOS standalone mode often
// blocks it — so a "show as text" escape hatch reveals a selectable textarea the
// user can long-press → Select All → Copy, which works everywhere, every time.
function CopyAllBlock() {
  const text = useMemo(allToText, []);
  const [state, setState] = useState<'idle' | 'copied' | 'manual'>('idle');

  const onCopy = async () => {
    const ok = await copyText(text);
    if (ok) {
      setState('copied');
      setTimeout(() => setState((s) => (s === 'copied' ? 'idle' : s)), 2200);
    } else {
      setState('manual');
    }
  };

  return (
    <div style={S.copyAllWrap}>
      <button
        onClick={onCopy}
        style={{ ...S.copyBtn, ...S.copyBtnBig, ...(state === 'copied' ? S.copyBtnDone : {}) }}
      >
        {state === 'copied' ? '✓ copied — paste into Notes' : '⧉ copy the whole sprint to Notes'}
      </button>
      <button onClick={() => setState((s) => (s === 'manual' ? 'idle' : 'manual'))} style={S.copyAllLink}>
        {state === 'manual' ? 'hide text' : 'not pasting? open as text →'}
      </button>
      {state === 'manual' && (
        <div style={S.manualWrap}>
          <div style={S.manualHint}>
            Tap inside the box, <strong>Select All</strong>, <strong>Copy</strong>, then paste into Notes.
          </div>
          <textarea
            readOnly
            value={text}
            style={S.manualArea}
            onFocus={(e) => e.currentTarget.select()}
          />
        </div>
      )}
    </div>
  );
}

function CopyBtn({ getText, label = 'copy for Notes', big = false }: { getText: () => string; label?: string; big?: boolean }) {
  const [copied, setCopied] = useState(false);
  const onClick = async () => {
    const ok = await copyText(getText());
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    }
  };
  return (
    <button onClick={onClick} style={{ ...S.copyBtn, ...(big ? S.copyBtnBig : {}), ...(copied ? S.copyBtnDone : {}) }}>
      {copied ? '✓ copied' : `⧉ ${label}`}
    </button>
  );
}

function CaptureCard() {
  const [open, setOpen] = useState(true);
  return (
    <div style={S.capture}>
      <button style={S.captureHead} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span style={S.captureTitle}>🎒 how to film this</span>
        <span style={S.chev}>{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div style={S.captureBody}>
          <p style={S.captureIntro}>{CAPTURE_INTRO}</p>
          {CAPTURE_BUCKETS.map((b) => (
            <div key={b.tag} style={S.bucketRow}>
              <span style={S.bucketTag}>{b.tag}</span>
              <span style={S.bucketDesc}>{b.desc}</span>
            </div>
          ))}
          <p style={S.captureOutro}>{CAPTURE_OUTRO}</p>
        </div>
      )}
    </div>
  );
}

function PostingPlan({ done, onToggle }: { done: Record<string, boolean>; onToggle: (id: string) => void }) {
  const [open, setOpen] = useState(true);
  const posted = POST_PLAN.filter((p) => done[p.id]).length;
  return (
    <div style={S.capture}>
      <button style={S.captureHead} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span style={S.captureTitle}>🗓️ posting plan · {posted}/{POST_PLAN.length}</span>
        <span style={S.chev}>{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div style={S.captureBody}>
          <p style={S.captureIntro}>One drop a day, 24 Jun → 5 Jul. Post each to IG Reels + TikTok. Tick it once it's up.</p>
          {POST_PLAN.map((p) => {
            const up = !!done[p.id];
            return (
              <button key={p.id} style={S.planRow} onClick={() => onToggle(p.id)}>
                <span style={{ ...S.box, background: up ? C.green : 'transparent', borderColor: up ? C.green : C.inkSoft, marginTop: 1 }}>{up ? '✓' : ''}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={S.planTop}>
                    <span style={S.planDate}>{p.date}</span>
                    <span style={S.planCode}>{p.code}</span>
                    <span style={{ ...S.planTitle, textDecoration: up ? 'line-through' : 'none', color: up ? C.inkSoft : C.ink }}>{p.title}</span>
                  </span>
                  <span style={S.planWhy}>{p.why}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
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

      <div style={S.hookLabel}>Hook · frame 1 (the line that lands on mute)</div>
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
  section: { fontFamily: "'Space Grotesk', sans-serif", fontSize: 15, fontWeight: 700, margin: 0, color: C.ink },
  sectionRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, margin: '26px 0 10px' },
  copyBtn: { flexShrink: 0, background: 'transparent', border: `1px solid ${C.line}`, color: C.inkSoft, fontSize: 11.5, fontWeight: 600, borderRadius: 999, padding: '5px 10px', cursor: 'pointer', whiteSpace: 'nowrap' },
  copyBtnBig: { fontSize: 13, padding: '10px 16px', borderColor: C.orange, color: C.orange, fontWeight: 700 },
  copyBtnDone: { borderColor: C.green, color: C.green },
  copyAllWrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, margin: '14px 0 4px' },
  copyAllLink: { background: 'none', border: 'none', color: C.inkSoft, fontSize: 12.5, fontWeight: 600, textDecoration: 'underline', cursor: 'pointer', padding: 2 },
  manualWrap: { width: '100%', marginTop: 4 },
  manualHint: { fontSize: 12.5, lineHeight: 1.45, color: C.inkSoft, marginBottom: 6, textAlign: 'center' },
  manualArea: { width: '100%', height: 260, boxSizing: 'border-box', border: `1px solid ${C.line}`, borderRadius: 12, padding: 12, fontSize: 13, lineHeight: 1.5, color: C.ink, background: C.card, fontFamily: 'ui-monospace, Menlo, monospace', WebkitUserSelect: 'text', userSelect: 'text' },
  capture: { background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: '12px 14px', marginTop: 16 },
  captureHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' },
  captureTitle: { fontFamily: "'Space Grotesk', sans-serif", fontSize: 15, fontWeight: 700, color: C.ink },
  captureBody: { marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.line}` },
  captureIntro: { fontSize: 13.5, lineHeight: 1.5, color: C.ink, margin: '0 0 12px', fontWeight: 600 },
  bucketRow: { display: 'flex', gap: 10, marginBottom: 9, alignItems: 'baseline' },
  bucketTag: { flexShrink: 0, width: 96, fontSize: 11, fontWeight: 700, letterSpacing: 0.5, color: C.orange },
  bucketDesc: { fontSize: 13, lineHeight: 1.45, color: C.inkSoft },
  captureOutro: { fontSize: 13, lineHeight: 1.5, color: C.ink, margin: '12px 0 2px', paddingTop: 10, borderTop: `1px dashed ${C.line}`, fontStyle: 'italic' },
  planRow: { display: 'flex', gap: 11, width: '100%', background: 'none', border: 'none', borderTop: `1px solid ${C.line}`, padding: '11px 2px', cursor: 'pointer', textAlign: 'left', alignItems: 'flex-start' },
  planTop: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 3 },
  planDate: { fontSize: 12, fontWeight: 700, color: C.inkSoft, letterSpacing: 0.3 },
  planCode: { fontSize: 11, fontWeight: 700, color: '#fff', background: C.ink, borderRadius: 5, padding: '2px 6px' },
  planTitle: { fontSize: 14, fontWeight: 600 },
  planWhy: { display: 'block', fontSize: 12.5, lineHeight: 1.45, color: C.inkSoft },
  note: { fontSize: 13, color: C.inkSoft, margin: '-4px 0 10px', lineHeight: 1.4 },
  card: { background: C.card, border: '1px solid', borderRadius: 14, padding: '14px 14px 12px', marginBottom: 12 },
  cardHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' },
  cardHeadLeft: { display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 },
  code: { color: '#fff', fontWeight: 700, fontSize: 12, borderRadius: 6, padding: '3px 7px', flexShrink: 0 },
  cardTitle: { fontWeight: 600, fontSize: 15.5, overflow: 'hidden', textOverflow: 'ellipsis' },
  chev: { color: C.inkSoft, fontSize: 14, paddingLeft: 8 },
  meta: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: C.inkSoft, margin: '8px 0 8px' },
  dot: { opacity: 0.5 },
  hookLabel: { fontSize: 11, fontWeight: 700, letterSpacing: 1, color: C.orange, marginBottom: 4, textTransform: 'uppercase' as const },
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
