import React, { useState } from 'react';
import { trackMessagedFlynn } from '../services/tracking';

const DEMO = [
  { out: false, text: "Hey! I'm Flynn, your business brain." },
  { out: false, text: 'Invoices, parts orders, bookings — just text me.' },
  { out: true,  text: 'invoice dave for today, 2hrs + $120 parts' },
  { out: false, text: "Invoice ready — $340 inc GST. Sending to Dave. Good?" },
];

// iPhones reach Flynn over iMessage; Android can't, so it texts the Twilio SMS
// number, which the backend handles identically.
// Reverted to Twilio SMS number '+61480891471' for the Latitude 37 review to ensure reliability.
const FLYNN_IMESSAGE = '+61480891471';
const FLYNN_SMS = '+61480891471';
const FLYNN_NUMBER = FLYNN_IMESSAGE;
const FLYNN_NUMBER_DISPLAY = '+61 480 891 471';
const FLYNN_SMS_DISPLAY = '+61 480 891 471';

function isAndroid() {
  return typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent || '');
}

// iOS Messages wants sms:NUMBER&body=… ; Android wants sms:NUMBER?body=…
function buildSmsLink(body: string) {
  const android = isAndroid();
  const number = android ? FLYNN_SMS : FLYNN_IMESSAGE;
  const sep = android ? '?' : '&';
  return `sms:${number}${sep}body=${encodeURIComponent(body)}`;
}

const SMS_LINK = `sms:${FLYNN_IMESSAGE}&body=${encodeURIComponent('Hi Flynn')}`;

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
  const [copied, setCopied] = useState(false);

  async function copyNumber() {
    try {
      await navigator.clipboard.writeText(FLYNN_NUMBER);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  // Fire the MessagedFlynn conversion + attribution bridge, then open iMessage
  // with the ref embedded so the later Activated event attributes to this click.
  // The static href stays as a no-JS fallback.
  function handleMessageFlynn(e: React.MouseEvent<HTMLAnchorElement>) {
    try {
      const ref = trackMessagedFlynn();
      const link = buildSmsLink(`Hi Flynn [${ref}]`);
      e.preventDefault();
      window.location.href = link;
    } catch {
      // let the default href handle navigation
    }
  }

  return (
    <div className="flex flex-col items-center gap-5">
      {/* Phone mockup — decorative demo */}
      <div className="relative w-[300px] sm:w-[330px] rounded-[46px] bg-[#1A1714] p-[11px] shadow-[0_8px_32px_-8px_rgba(44,32,24,0.45)] order-2 lg:order-1">
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

          {/* Thread — static, all bubbles shown at once */}
          <div className="px-3 pt-3 pb-2 space-y-2 h-[160px] overflow-hidden flex flex-col justify-end">
            {DEMO.map((b, i) => (
              <div key={i}
                className={`max-w-[82%] text-[13px] leading-snug rounded-2xl px-3.5 py-2.5 ${
                  b.out
                    ? 'ml-auto bg-[#007AFF] text-white rounded-br-md'
                    : 'bg-[#E9E9EB] text-[#141416] rounded-bl-md'
                }`}
              >
                {b.text}
              </div>
            ))}
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

      {/* Primary CTA — glassmorphic light pill with green iMessage icon.
          Uses the shared .flynn-glass system (index.html) so the landing page,
          the hosted invoice page and the iOS app share one button language. */}
      <a
        href={SMS_LINK}
        onClick={handleMessageFlynn}
        className="flynn-glass flynn-glass--light !rounded-full flex items-center gap-3 px-5 py-3.5 order-1 lg:order-2"
      >
        <IMessageIcon size={30} />
        <span className="text-[17px] font-semibold text-[#1A1A1A]">Message Flynn</span>
      </a>

      {/* Desktop fallback */}
      <p className="text-sm text-[#8C7B6A] text-center -mt-1 order-3">
        On desktop? Text{' '}
        <button
          onClick={copyNumber}
          className="font-semibold text-[#2C2018] hover:text-[#FB5B1E] transition-colors"
        >
          {copied ? 'Copied!' : FLYNN_NUMBER_DISPLAY}
        </button>
        {' '}from your iPhone, or {FLYNN_SMS_DISPLAY} from Android.
      </p>
    </div>
  );
}
