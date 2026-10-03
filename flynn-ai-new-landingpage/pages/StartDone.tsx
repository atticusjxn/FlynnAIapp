import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { CalendarDays, Check, Copy, Loader2, Phone, PhoneForwarded } from 'lucide-react';

type Status = {
  state: 'pending' | 'provisioning' | 'live' | 'failed';
  phoneNumber?: string;
  forwardingCodes?: { noAnswer: string; busy: string; unreachable: string; allConditional: string; cancel: string };
  voice?: 'male' | 'female';
  coverage?: 'missed_calls' | 'after_hours' | 'always';
  calendarConnectUrl?: string;
  error?: string;
};

const pretty = (n?: string) => (n ? n.replace(/^\+61/, '0').replace(/^(\d{4})(\d{3})(\d{3})$/, '$1 $2 $3') : '');

const CopyCode: React.FC<{ code: string; label: string; primary?: boolean }> = ({ code, label, primary }) => {
  const [copied, setCopied] = useState(false);
  return (
    <button type="button" onClick={() => navigator.clipboard?.writeText(code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); })}
      className={`w-full rounded-2xl px-4 py-4 flex items-center justify-between gap-3 text-left border-2 ${primary ? 'border-[#ff4500] bg-[#fff4ee]' : 'border-black/10 bg-white'}`}>
      <span>
        <span className="block text-[13px] text-[#2C2018]/60">{label}</span>
        <span className="block font-mono font-bold text-[22px] tracking-wide text-[#2C2018]">{code}</span>
      </span>
      <span className="flex items-center gap-1.5 text-[14px] font-semibold text-[#ff4500] shrink-0">
        {copied ? <><Check size={17} strokeWidth={3} /> Copied</> : <><Copy size={17} /> Copy</>}
      </span>
    </button>
  );
};

const StartDone: React.FC = () => {
  const [params] = useSearchParams();
  const sessionId = params.get('session_id') || '';
  const [status, setStatus] = useState<Status>({ state: 'pending' });
  const [tries, setTries] = useState(0);

  useEffect(() => {
    if (!sessionId) { setStatus({ state: 'failed', error: 'missing_session' }); return; }
    let stop = false;
    const tick = async (n: number) => {
      try {
        const res = await fetch(`/api/signup/status?session_id=${encodeURIComponent(sessionId)}`);
        const data: Status = await res.json();
        if (stop) return;
        setStatus(data);
        if (data.state === 'live' || data.state === 'failed') return;
      } catch { /* keep polling */ }
      if (!stop && n < 40) setTimeout(() => { setTries(n + 1); tick(n + 1); }, 3000);
    };
    tick(0);
    return () => { stop = true; };
  }, [sessionId]);

  const codes = status.forwardingCodes;
  const live = status.state === 'live' && status.phoneNumber;
  const coverage = status.coverage ?? 'missed_calls';

  return (
    <div className="min-h-screen bg-[#F4E6CE] text-[#2C2018]">
      <Helmet><title>You're in — Flynn</title><meta name="robots" content="noindex" /></Helmet>
      <main className="max-w-xl mx-auto px-4 py-10 space-y-5">
        <img src="/flynn-logo.svg" alt="Flynn" className="h-7 w-auto" />

        {!live && status.state !== 'failed' && (
          <section className="bg-white/80 rounded-[28px] p-7 text-center">
            <Loader2 size={34} className="animate-spin mx-auto text-[#ff4500]" />
            <h1 className="font-display font-bold text-3xl mt-4">Setting up your Flynn number…</h1>
            <p className="text-[#2C2018]/60 mt-2">Your free week has started. This usually takes under a minute.</p>
            {tries > 20 && <p className="text-[14px] text-[#2C2018]/60 mt-4">Still working on it. We'll also text you the moment it's ready, so it's fine to close this page.</p>}
          </section>
        )}

        {status.state === 'failed' && (
          <section className="bg-white/80 rounded-[28px] p-7">
            <h1 className="font-display font-bold text-3xl">Your trial is started. We're finishing your setup.</h1>
            <p className="text-[#2C2018]/70 mt-3">Something didn't finish automatically, so a real person is on it now. You'll get a text with your Flynn number shortly. You won't be charged during your free week.</p>
          </section>
        )}

        {live && (
          <>
            <section className="bg-[#2C2018] text-[#F4E6CE] rounded-[28px] p-7">
              <p className="flex items-center gap-2 text-[#ff8a5c] font-semibold text-sm uppercase tracking-[0.16em]"><Check size={16} strokeWidth={3} /> Flynn is live</p>
              <h1 className="font-display font-bold text-[34px] leading-tight mt-2">Your Flynn number</h1>
              <a href={`tel:${status.phoneNumber}`} className="block font-display font-bold text-[40px] tracking-tight mt-1 text-white">{pretty(status.phoneNumber)}</a>
              <p className="text-[15px] text-[#F4E6CE]/70 mt-2">Call it now from any phone to hear Flynn answer as you.</p>
              <a href={`tel:${status.phoneNumber}`} className="mt-5 w-full h-14 rounded-2xl bg-[#ff4500] text-white font-bold text-[18px] flex items-center justify-center gap-2">
                <Phone size={20} /> Test call Flynn
              </a>
            </section>

            {coverage !== 'always' && codes && (
              <section className="bg-white/80 rounded-[28px] p-6 sm:p-7 space-y-3">
                <div className="flex items-center gap-3">
                  <PhoneForwarded size={22} className="text-[#ff4500]" />
                  <h2 className="font-display font-bold text-2xl">Last step: send missed calls to Flynn</h2>
                </div>
                <p className="text-[15px] text-[#2C2018]/70">
                  On your iPhone: copy the code below, open <b>Phone → Keypad</b>, paste it and press call. You'll see a confirmation on screen. Your phone still rings first. Flynn only answers if you're busy, decline, or don't pick up.
                </p>
                <CopyCode primary code={codes.allConditional} label="Busy, no answer or unreachable (recommended)" />
                <details className="text-[14px] text-[#2C2018]/70">
                  <summary className="cursor-pointer font-semibold py-1">Other options</summary>
                  <div className="space-y-2 mt-2">
                    <CopyCode code={codes.noAnswer} label="Only when it rings out" />
                    <CopyCode code={codes.cancel} label="Turn forwarding off any time" />
                  </div>
                </details>
              </section>
            )}

            {status.calendarConnectUrl && (
              <section className="bg-white/80 rounded-[28px] p-6 sm:p-7 space-y-3">
                <div className="flex items-center gap-3">
                  <CalendarDays size={22} className="text-[#ff4500]" />
                  <h2 className="font-display font-bold text-2xl">Connect your calendar</h2>
                </div>
                <p className="text-[15px] text-[#2C2018]/70">So Flynn can see when you're free and book callers straight in. Takes 20 seconds.</p>
                <a href={status.calendarConnectUrl} className="w-full h-14 rounded-2xl bg-[#2C2018] text-white font-bold text-[17px] flex items-center justify-center gap-2">
                  Connect Google or Apple Calendar
                </a>
                <p className="text-[13px] text-[#2C2018]/55">We've also texted you this link, so you can do it later.</p>
              </section>
            )}

            <section className="bg-white/80 rounded-[28px] p-6 text-[15px] text-[#2C2018]/70 space-y-2">
              <p><b className="text-[#2C2018]">What happens next:</b> when Flynn takes a call, you'll get a text with the caller's name, number and what they need.</p>
              <p>Your free week ends in 7 days, then it's $79/month. Cancel any time by replying to any Flynn text or emailing us. No lock-in.</p>
            </section>
          </>
        )}
      </main>
    </div>
  );
};

export default StartDone;
