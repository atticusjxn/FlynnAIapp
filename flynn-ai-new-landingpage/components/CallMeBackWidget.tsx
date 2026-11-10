import React, { useState } from 'react';
import { callMeBack } from '../services/api';
import { trackCallMeBack } from '../services/tracking';

/*
 * The primary funnel action: enter your number, Flynn calls you back in
 * seconds so you can hear the AI receptionist live — the call IS the demo
 * and the onboarding interview. Glass-pill language matches the rest of the
 * site (.flynn-glass / .flynn-pill, defined globally in index.html).
 */

type Status = 'idle' | 'submitting' | 'called' | 'error';

const CallMeBackWidget: React.FC<{ className?: string }> = ({ className = '' }) => {
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 8) {
      setStatus('error');
      setErrorMessage("That doesn't look like a full number.");
      return;
    }

    setStatus('submitting');
    setErrorMessage('');
    try {
      await callMeBack(phone);
      setStatus('called');
      // URL marker BEFORE firing the pixel event, not after: fbq reads
      // document.location at the moment it's called, so the custom
      // conversion's "URL contains call_requested=1" rule only ever matches
      // an event whose captured URL already has the marker on it. Tracking
      // first / marking second would silently never convert.
      try {
        const url = new URL(window.location.href);
        url.searchParams.set('call_requested', '1');
        window.history.replaceState(null, '', url.toString());
      } catch {
        // marker is best-effort only
      }
      trackCallMeBack();
    } catch (err) {
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'Something went wrong. Try again.');
    }
  }

  if (status === 'called') {
    return (
      <div className={`flynn-glass flynn-glass--light rounded-3xl px-6 py-5 flex items-center gap-4 ${className}`}>
        <span className="text-3xl">📞</span>
        <div>
          <p className="font-display font-bold text-lg text-[#2C2018]">Ringing your phone now!</p>
          <p className="text-sm text-[#5A4A3C]">Answer it, that's Flynn. Just talk like you would to a receptionist.</p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={className}>
      <div className="flynn-dock !bg-[#2C2018]/90 w-full max-w-md !p-2 !gap-2">
        <input
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          required
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="04XX XXX XXX"
          aria-label="Your mobile number"
          className="flex-1 min-w-0 bg-transparent text-white placeholder-white/50 font-display font-semibold text-base px-4 py-3 focus:outline-none"
        />
        <button
          type="submit"
          disabled={status === 'submitting'}
          className="flynn-glass flynn-glass--primary flynn-pill flex-none inline-flex items-center gap-2 px-6 py-3 font-display font-bold text-[15px] whitespace-nowrap disabled:opacity-70"
        >
          {status === 'submitting' ? 'Calling…' : 'Call me now'}
        </button>
      </div>
      {status === 'error' && (
        <p className="text-sm text-[#C5532B] mt-2 font-medium">{errorMessage}</p>
      )}
      <p className="text-xs text-[#8C7B6A] mt-2">Free call. No app needed to try it.</p>
    </form>
  );
};

export default CallMeBackWidget;
