import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Check, Pause, Play, Phone, MessageSquare, CalendarDays, Moon, Clock, Sparkles, ShieldCheck, ArrowRight, Loader2 } from 'lucide-react';

/**
 * Personalised, phone-first signup: a few taps, then an embedded Stripe
 * checkout for the 7-day free trial. Answers go to POST /api/signup/checkout;
 * the backend provisions the receptionist once the trial starts.
 */

type Coverage = 'missed_calls' | 'after_hours' | 'always';
type Day = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
type Action = 'take_message' | 'text_summary' | 'book_appointment';

type Preset = {
  name: string;
  businessType: string;
  onMissedCall: Action[];
  coverage: Coverage;
  quote?: string;
};

// Leads we've already spoken to, so the form opens with their answers filled in.
const PRESETS: Record<string, Preset> = {
  bradley: {
    name: 'Bradley',
    businessType: 'Freelance prototype development',
    onMissedCall: ['take_message', 'text_summary', 'book_appointment'],
    coverage: 'missed_calls',
    quote: "If I miss a call I just need a message giving me the caller's contact and purpose.",
  },
};

const DAYS: { id: Day; label: string }[] = [
  { id: 'mon', label: 'M' }, { id: 'tue', label: 'T' }, { id: 'wed', label: 'W' }, { id: 'thu', label: 'T' },
  { id: 'fri', label: 'F' }, { id: 'sat', label: 'S' }, { id: 'sun', label: 'S' },
];
const TIMES = Array.from({ length: 33 }, (_, i) => {
  const mins = 6 * 60 + i * 30; // 06:00 → 22:00
  return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
});
const fmtTime = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return `${((h + 11) % 12) + 1}${m ? `:${String(m).padStart(2, '0')}` : ''}${h < 12 ? 'am' : 'pm'}`;
};

declare global {
  interface Window { Stripe?: (key: string) => any }
}
const loadStripeJs = () =>
  new Promise<void>((resolve, reject) => {
    if (window.Stripe) return resolve();
    const s = document.createElement('script');
    s.src = 'https://js.stripe.com/v3/';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Could not load Stripe'));
    document.head.appendChild(s);
  });

const Step: React.FC<{ n: number; title: string; hint?: string; children: React.ReactNode }> = ({ n, title, hint, children }) => (
  <section className="bg-white/80 backdrop-blur rounded-[28px] p-5 sm:p-7 shadow-[0_12px_40px_rgba(44,32,24,0.08)] border border-black/5">
    <div className="flex items-center gap-3 mb-1">
      <span className="w-7 h-7 rounded-full bg-[#2C2018] text-[#F4E6CE] text-sm font-bold flex items-center justify-center shrink-0">{n}</span>
      <h2 className="font-display font-bold text-xl sm:text-2xl tracking-tight text-[#2C2018]">{title}</h2>
    </div>
    {hint && <p className="text-[15px] text-[#2C2018]/60 ml-10 mb-4">{hint}</p>}
    <div className={hint ? '' : 'mt-4'}>{children}</div>
  </section>
);

const Choice: React.FC<{ on: boolean; onClick: () => void; icon: React.ReactNode; title: string; body?: string; badge?: string }> = ({ on, onClick, icon, title, body, badge }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={on}
    className={`w-full text-left rounded-2xl px-4 py-4 flex gap-3 items-start transition border-2 min-h-[64px] ${
      on ? 'border-[#ff4500] bg-[#fff4ee]' : 'border-black/10 bg-white hover:border-black/25'
    }`}
  >
    <span className={`mt-0.5 shrink-0 ${on ? 'text-[#ff4500]' : 'text-[#2C2018]/50'}`}>{icon}</span>
    <span className="flex-1">
      <span className="flex items-center gap-2 flex-wrap">
        <span className="font-semibold text-[17px] text-[#2C2018]">{title}</span>
        {badge && <span className="text-[11px] font-bold uppercase tracking-wider bg-[#2C2018] text-white rounded-full px-2 py-0.5">{badge}</span>}
      </span>
      {body && <span className="block text-[14px] text-[#2C2018]/60 mt-0.5 leading-snug">{body}</span>}
    </span>
    <span className={`w-6 h-6 rounded-full border-2 shrink-0 flex items-center justify-center ${on ? 'bg-[#ff4500] border-[#ff4500]' : 'border-black/20'}`}>
      {on && <Check size={15} className="text-white" strokeWidth={3} />}
    </span>
  </button>
);

const Start: React.FC = () => {
  const { ref = '' } = useParams();
  const preset = PRESETS[ref.toLowerCase()];

  const [onMissedCall, setOnMissedCall] = useState<Action[]>(preset?.onMissedCall ?? ['take_message', 'text_summary']);
  const [coverage, setCoverage] = useState<Coverage>(preset?.coverage ?? 'missed_calls');
  const [days, setDays] = useState<Day[]>(['mon', 'tue', 'wed', 'thu', 'fri']);
  const [start, setStart] = useState('08:00');
  const [end, setEnd] = useState('17:00');
  const [voice, setVoice] = useState<'male' | 'female'>('female');
  const [playing, setPlaying] = useState<'male' | 'female' | null>(null);
  const [name, setName] = useState(preset?.name ?? '');
  const [businessName, setBusinessName] = useState('');
  const [businessType, setBusinessType] = useState(preset?.businessType ?? '');
  const [notes, setNotes] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const audio = useRef<HTMLAudioElement | null>(null);
  const checkoutRef = useRef<HTMLDivElement | null>(null);
  const embedded = useRef<any>(null);

  useEffect(() => () => { audio.current?.pause(); embedded.current?.destroy?.(); }, []);

  const toggleAction = (a: Action) => setOnMissedCall((cur) => (cur.includes(a) ? cur.filter((x) => x !== a) : [...cur, a]));
  const toggleDay = (d: Day) => setDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]));

  const play = (g: 'male' | 'female') => {
    setVoice(g);
    if (playing === g) { audio.current?.pause(); setPlaying(null); return; }
    audio.current?.pause();
    const a = new Audio(`/voices/flynn-au-${g}.mp3`);
    a.onended = () => setPlaying(null);
    audio.current = a;
    a.play().then(() => setPlaying(g)).catch(() => setPlaying(null));
  };

  const mobileOk = /^(\+?61|0)4\d{8}$/.test(mobile.replace(/[\s()-]/g, ''));
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const ready = name.trim() && businessType.trim() && mobileOk && emailOk && onMissedCall.length > 0 && (coverage !== 'after_hours' || days.length > 0);

  const missing = useMemo(() => {
    const m: string[] = [];
    if (!onMissedCall.length) m.push('what Flynn should do');
    if (!name.trim()) m.push('your name');
    if (!businessType.trim()) m.push('what you do');
    if (!mobileOk) m.push('an Australian mobile');
    if (!emailOk) m.push('your email');
    return m;
  }, [onMissedCall, name, businessType, mobileOk, emailOk]);

  const startTrial = async () => {
    if (!ready || busy) return;
    setBusy(true); setError('');
    try {
      const res = await fetch('/api/signup/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ref: ref || undefined,
          answers: {
            name: name.trim(), email: email.trim(), mobile: mobile.replace(/[\s()-]/g, ''),
            businessName: businessName.trim() || `${name.trim()}'s business`, businessType: businessType.trim(),
            onMissedCall, coverage, voice, notes: notes.trim() || undefined,
            hours: coverage === 'after_hours' ? { days, start, end } : undefined,
          },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.clientSecret || !data.publishableKey) throw new Error(data.error || 'Something went wrong starting your trial.');
      await loadStripeJs();
      const stripe = window.Stripe!(data.publishableKey);
      embedded.current?.destroy?.();
      embedded.current = await stripe.initEmbeddedCheckout({ fetchClientSecret: async () => data.clientSecret });
      setCheckoutOpen(true);
      setTimeout(() => {
        embedded.current.mount('#flynn-checkout');
        checkoutRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 50);
    } catch (e: any) {
      setError(e?.message || 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const input = 'w-full rounded-2xl border-2 border-black/10 bg-white px-4 py-3.5 text-[17px] text-[#2C2018] placeholder:text-[#2C2018]/35 focus:outline-none focus:border-[#ff4500]';

  return (
    <div className="min-h-screen bg-[#F4E6CE] text-[#2C2018]">
      <Helmet>
        <title>{preset ? `${preset.name}, meet Flynn` : 'Start your free week with Flynn'}</title>
        <meta name="robots" content="noindex" />
      </Helmet>

      <header className="max-w-xl mx-auto px-5 pt-6 flex items-center justify-between">
        <a href="/" className="flex items-center gap-2" aria-label="Flynn home">
          <img src="/flynn-logo.svg" alt="Flynn" className="h-7 w-auto" />
        </a>
        <span className="text-[13px] text-[#2C2018]/60 flex items-center gap-1.5"><ShieldCheck size={15} /> 7 days free</span>
      </header>

      <main className="max-w-xl mx-auto px-4 pb-28 pt-8 space-y-5">
        <div className="px-1">
          <p className="text-[#ff4500] font-semibold text-sm uppercase tracking-[0.18em] mb-2 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#ff4500] animate-pulse" /> Your AI receptionist
          </p>
          <h1 className="font-display font-bold text-[40px] sm:text-5xl leading-[1.02] tracking-tight">
            {preset ? <>Hey {preset.name},<br />let's get Flynn<br />on your phone.</> : <>Let's get Flynn<br />on your phone.</>}
          </h1>
          <p className="text-[17px] text-[#2C2018]/70 mt-4 leading-relaxed">
            A few taps and you're set. Keep your number. When you can't pick up, Flynn answers, finds out who it is and what they need, and texts it to you.
          </p>
          {preset?.quote && (
            <figure className="mt-5 bg-[#2C2018] text-[#F4E6CE] rounded-3xl rounded-bl-md px-5 py-4">
              <blockquote className="text-[16px] leading-snug">“{preset.quote}”</blockquote>
              <figcaption className="text-[13px] text-[#F4E6CE]/60 mt-2">Got it. That's exactly what's set up below.</figcaption>
            </figure>
          )}
        </div>

        <Step n={1} title="When you miss a call, Flynn will…" hint="Tap to change.">
          <div className="space-y-2.5">
            <Choice on={onMissedCall.includes('take_message')} onClick={() => toggleAction('take_message')} icon={<Phone size={20} />} title="Answer and take their details" body="Name, best number and what it's about." />
            <Choice on={onMissedCall.includes('text_summary')} onClick={() => toggleAction('text_summary')} icon={<MessageSquare size={20} />} title="Text you a summary straight away" body="Who called, their number and why. Tap to call back." />
            <Choice on={onMissedCall.includes('book_appointment')} onClick={() => toggleAction('book_appointment')} icon={<CalendarDays size={20} />} title="Book them into your calendar" body="Flynn offers your free times and books it in. Connect Google or Apple Calendar right after signup." />
          </div>
        </Step>

        <Step n={2} title="When should Flynn pick up?">
          <div className="space-y-2.5">
            <Choice on={coverage === 'missed_calls'} onClick={() => setCoverage('missed_calls')} icon={<Phone size={20} />} title="Only when I can't answer" badge="Recommended" body="Your phone rings as normal. If you're busy, declined or it rings out, Flynn takes it." />
            <Choice on={coverage === 'after_hours'} onClick={() => setCoverage('after_hours')} icon={<Moon size={20} />} title="Outside my working hours" body="Flynn takes every call outside the hours you set." />
            <Choice on={coverage === 'always'} onClick={() => setCoverage('always')} icon={<Clock size={20} />} title="24/7, every call" body="Flynn answers everything and texts you the details." />
          </div>
          {coverage === 'after_hours' && (
            <div className="mt-4 rounded-2xl bg-[#F4E6CE]/60 p-4">
              <p className="text-[14px] font-semibold mb-2.5">Your working hours</p>
              <div className="flex gap-1.5 mb-3">
                {DAYS.map((d) => (
                  <button key={d.id} type="button" onClick={() => toggleDay(d.id)} aria-pressed={days.includes(d.id)} aria-label={d.id}
                    className={`flex-1 h-11 rounded-xl font-semibold text-[15px] ${days.includes(d.id) ? 'bg-[#2C2018] text-white' : 'bg-white text-[#2C2018]/60 border border-black/10'}`}>
                    {d.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <select value={start} onChange={(e) => setStart(e.target.value)} className={`${input} py-3`} aria-label="Start time">
                  {TIMES.map((t) => <option key={t} value={t}>{fmtTime(t)}</option>)}
                </select>
                <span className="text-[#2C2018]/50">to</span>
                <select value={end} onChange={(e) => setEnd(e.target.value)} className={`${input} py-3`} aria-label="End time">
                  {TIMES.map((t) => <option key={t} value={t}>{fmtTime(t)}</option>)}
                </select>
              </div>
            </div>
          )}
        </Step>

        <Step n={3} title="Pick Flynn's voice" hint="Both are Australian. Tap play to hear Flynn answer for you.">
          <div className="grid grid-cols-2 gap-3">
            {(['female', 'male'] as const).map((g) => (
              <button key={g} type="button" onClick={() => play(g)} aria-pressed={voice === g}
                className={`rounded-2xl p-4 text-left border-2 transition ${voice === g ? 'border-[#ff4500] bg-[#fff4ee]' : 'border-black/10 bg-white'}`}>
                <span className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 ${voice === g ? 'bg-[#ff4500] text-white' : 'bg-[#2C2018] text-white'}`}>
                  {playing === g ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-0.5" />}
                </span>
                <span className="block font-semibold text-[17px]">{g === 'female' ? 'Female' : 'Male'}</span>
                <span className="block text-[13px] text-[#2C2018]/55">{playing === g ? 'Playing…' : 'Aussie accent'}</span>
              </button>
            ))}
          </div>
        </Step>

        <Step n={4} title="About your business" hint="So Flynn sounds like it knows you.">
          <div className="space-y-3">
            <input className={input} value={businessType} onChange={(e) => setBusinessType(e.target.value)} placeholder="What do you do?" aria-label="What you do" />
            <input className={input} value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Business name (optional)" aria-label="Business name" />
            <textarea className={`${input} min-h-[92px] resize-none`} value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything Flynn should tell callers? e.g. 'I reply within a few hours' (optional)" aria-label="Notes for Flynn" />
          </div>
        </Step>

        <Step n={5} title="Where should Flynn text you?">
          <div className="space-y-3">
            <input className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Your first name" autoComplete="given-name" aria-label="Your first name" />
            <input className={input} value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="Your mobile, e.g. 0412 345 678" inputMode="tel" autoComplete="tel" aria-label="Your mobile" />
            <input className={input} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email for your receipt" inputMode="email" autoComplete="email" aria-label="Email" />
            {mobile && !mobileOk && <p className="text-[13px] text-[#c2410c] px-1">Enter an Australian mobile, like 0412 345 678.</p>}
          </div>
        </Step>

        <section ref={checkoutRef} className="bg-[#2C2018] text-[#F4E6CE] rounded-[28px] p-6 sm:p-7">
          <p className="flex items-center gap-2 text-[#ff8a5c] font-semibold text-sm uppercase tracking-[0.16em]"><Sparkles size={16} /> 7 days free</p>
          <h2 className="font-display font-bold text-3xl mt-2 leading-tight">Try Flynn free for a week.</h2>
          <ul className="mt-4 space-y-2 text-[16px]">
            {['Your own Flynn number, set up in minutes', 'Keep your mobile: Flynn only steps in when you need it', 'Then $79/month. Cancel any time, no lock-in'].map((t) => (
              <li key={t} className="flex gap-2.5"><Check size={19} className="text-[#ff8a5c] mt-0.5 shrink-0" strokeWidth={3} />{t}</li>
            ))}
          </ul>
          <p className="text-[14px] text-[#F4E6CE]/60 mt-4">We ask for a card so your number keeps working after the trial. You won't be charged today, and you can cancel before day 7 and pay nothing.</p>

          {!checkoutOpen && (
            <>
              <button type="button" onClick={startTrial} disabled={!ready || busy}
                className="mt-6 w-full h-14 rounded-2xl bg-[#ff4500] text-white font-bold text-[18px] flex items-center justify-center gap-2 disabled:opacity-40 active:scale-[0.99] transition">
                {busy ? <><Loader2 size={20} className="animate-spin" /> Setting up…</> : <>Start my free week <ArrowRight size={20} /></>}
              </button>
              {!ready && missing.length > 0 && <p className="text-[13px] text-[#F4E6CE]/55 mt-3 text-center">Still need: {missing.join(', ')}.</p>}
            </>
          )}
          {error && <p className="mt-4 text-[14px] bg-[#7f1d1d] text-white rounded-xl px-4 py-3">{error} If it keeps happening, just reply to our text and we'll set it up for you.</p>}
          <div id="flynn-checkout" className={checkoutOpen ? 'mt-6 bg-white rounded-2xl overflow-hidden' : 'hidden'} />
        </section>
      </main>
    </div>
  );
};

export default Start;
