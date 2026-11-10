import React, { useState } from 'react';
import { joinWaitlist } from '../services/waitlist';

type Status = 'idle' | 'submitting' | 'joined' | 'error';

interface WaitlistFormProps {
  source: string;
  refCode?: string;
  className?: string;
}

const WaitlistForm: React.FC<WaitlistFormProps> = ({ source, refCode, className = '' }) => {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('submitting');
    try {
      await joinWaitlist(email, source, refCode);
      setStatus('joined');
    } catch {
      setStatus('error');
    }
  }

  if (status === 'joined') {
    return (
      <div className={`flynn-glass flynn-glass--light rounded-3xl px-6 py-5 ${className}`}>
        <p className="font-display font-bold text-lg text-[#2C2018]">You're on the list.</p>
        <p className="text-sm text-[#5A4A3C]">We'll email you when Flynn opens up again.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={className}>
      <div className="flynn-dock !bg-[#2C2018]/90 w-full max-w-md !p-2 !gap-2">
        <input
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@yourbusiness.com.au"
          aria-label="Your email"
          className="flex-1 min-w-0 bg-transparent text-white placeholder-white/50 font-display font-semibold text-base px-4 outline-none"
        />
        <button
          type="submit"
          disabled={status === 'submitting'}
          className="flynn-glass flynn-glass--primary flynn-pill flex-none inline-flex items-center gap-2 px-6 py-3 font-display font-bold disabled:opacity-60"
        >
          {status === 'submitting' ? 'Joining…' : 'Join the waitlist'}
        </button>
      </div>
      {status === 'error' && (
        <p className="text-sm text-[#C5532B] mt-2 font-medium">That didn't work. Please try again.</p>
      )}
    </form>
  );
};

export default WaitlistForm;
