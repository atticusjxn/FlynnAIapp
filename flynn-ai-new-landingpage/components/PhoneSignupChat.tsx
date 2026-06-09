import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const DEMO = [
  { out: false, text: "Hey! I'm Flynn, your business brain." },
  { out: false, text: 'Invoices, parts orders, bookings — just text me.' },
  { out: true,  text: 'invoice dave for today, 2hrs + $120 parts' },
  { out: false, text: "Invoice ready — $340 inc GST. Sending to Dave. Good?" },
];

const FLYNN_NUMBER = '+61497779071';
const FLYNN_NUMBER_DISPLAY = '+61 497 779 071';
const SMS_LINK = `sms:${FLYNN_NUMBER}&body=${encodeURIComponent('Hi Flynn')}`;

function IMessageIcon({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect width="24" height="24" rx="5.5" fill="#34C759" />
      <path
        d="M12 4.6C7.8 4.6 4.4 7.4 4.4 10.9c0 1.9.9 3.5 2.4 4.7-.2.7-.6 1.5-1.2 2.1 1.3-.1 2.4-.6 3.2-1.2.9.3 1.8.4 2.8.4 4.2 0 7.6-2.8 7.6-6.3C19.2 7.1 16.2 4.6 12 4.6z"
        fill="white"
      />
    </svg>
  );
}

export default function PhoneSignupChat() {
  const [visibleCount, setVisibleCount] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const delays = [400, 1000, 1700, 2500];
    const timers = delays.map((ms, i) => setTimeout(() => setVisibleCount(i + 1), ms));
    return () => timers.forEach(clearTimeout);
  }, []);

  async function copyNumber() {
    try {
      await navigator.clipboard.writeText(FLYNN_NUMBER);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  return (
    <div className="flex flex-col items-center gap-5">
      {/* Phone mockup — decorative demo */}
      <div className="relative w-[300px] sm:w-[330px] rounded-[46px] bg-[#1A1714] p-[11px] shadow-[0_8px_32px_-8px_rgba(44,32,24,0.45)]">
        <div className="rounded-[36px] overflow-hidden bg-white">
          {/* Status bar */}
          <div className="flex items-center justify-between px-6 pt-3 pb-1 text-[#141416]">
            <span className="font-display font-semibold text-[15px]">9:41</span>
            <span className="flex items-center gap-1.5">
              <span className="flex items-end gap-0.5 h-3">
                {[3, 5, 7, 9].map(h => (
                  <i key={h} style={{ height: h }} className="w-1 bg-[#141416] rounded-sm block" />
                ))}
              </span>
              <span className="w-6 h-3 rounded-[3px] border-2 border-[#141416] relative">
                <i className="absolute inset-[2px] right-1 bg-[#141416] rounded-[1px]" />
              </span>
            </span>
          </div>

          {/* Nav */}
          <div className="flex items-center px-4 py-2 border-b border-gray-200">
            <span className="text-[#007AFF] text-2xl leading-none">‹</span>
            <div className="flex-1 flex flex-col items-center -ml-3">
              <img src="/apple-touch-icon.png" alt="Flynn" className="w-10 h-10 rounded-full object-cover" />
              <span className="text-[13px] font-medium text-[#141416] mt-0.5">Flynn</span>
            </div>
            <span className="w-6 h-6 rounded-full border-2 border-[#007AFF] text-[#007AFF] grid place-items-center text-xs font-bold">i</span>
          </div>

          {/* Thread — fixed height so bubbles animate inside without pushing layout */}
          <div className="px-3 pt-3 pb-2 space-y-2 h-[160px] overflow-hidden flex flex-col justify-end">
            <AnimatePresence>
              {DEMO.slice(0, visibleCount).map((b, i) => (
                <motion.div key={i}
                  initial={{ opacity: 0, y: 8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.22 }}
                  className={`max-w-[82%] text-[13px] leading-snug rounded-2xl px-3.5 py-2.5 ${
                    b.out
                      ? 'ml-auto bg-[#007AFF] text-white rounded-br-md'
                      : 'bg-[#E9E9EB] text-[#141416] rounded-bl-md'
                  }`}
                >
                  {b.text}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Decorative compose bar */}
          <div className="px-3 pb-3 pt-1 flex items-center gap-2">
            <div className="flex-1 h-9 rounded-full border border-gray-300 bg-white flex items-center px-3">
              <span className="text-[13px] text-gray-400 select-none">iMessage</span>
            </div>
            <span className="w-8 h-8 rounded-full bg-[#D1D1D6] flex items-center justify-center flex-shrink-0">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="white" aria-hidden="true">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
              </svg>
            </span>
          </div>
        </div>
      </div>

      {/* Primary CTA — Series style: white pill, green iMessage icon */}
      <a
        href={SMS_LINK}
        className="flex items-center gap-3 bg-white rounded-full px-5 py-3.5 shadow-[0_4px_20px_-4px_rgba(44,32,24,0.2)] border border-gray-100 hover:shadow-[0_6px_28px_-4px_rgba(44,32,24,0.3)] active:scale-95 transition-all"
      >
        <IMessageIcon size={30} />
        <span className="text-[17px] font-semibold text-[#1A1A1A]">Message Flynn</span>
      </a>

      {/* Desktop fallback */}
      <p className="text-sm text-[#8C7B6A] text-center -mt-1">
        On desktop? Text{' '}
        <button
          onClick={copyNumber}
          className="font-semibold text-[#2C2018] hover:text-[#FB5B1E] transition-colors"
        >
          {copied ? 'Copied!' : FLYNN_NUMBER_DISPLAY}
        </button>
        {' '}from your phone.
      </p>
    </div>
  );
}
