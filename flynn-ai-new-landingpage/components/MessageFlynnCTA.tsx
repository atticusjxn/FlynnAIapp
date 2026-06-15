import React, { useState } from 'react';
import { trackMessagedFlynn } from '../services/tracking';

// Same number + link the landing-page hero uses. Conversions from the blog
// should land in the exact same place: a text to Flynn.
const FLYNN_NUMBER = '+61495023092';
const FLYNN_NUMBER_DISPLAY = '+61 495 023 092';
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

interface MessageFlynnCTAProps {
    headline?: string;
    body?: string;
    /** Mascot pose to show beside the CTA (file in /public/mascots). Pass null to hide. */
    mascot?: string | null;
}

const MessageFlynnCTA: React.FC<MessageFlynnCTAProps> = ({
    headline = 'Want Flynn running your admin?',
    body = 'Text Flynn like you\'d text a mate. It drafts replies, books jobs, sends invoices and chases payments — all from your messages. No app to set up first.',
    mascot = 'phone',
}) => {
    const [copied, setCopied] = useState(false);

    async function copyNumber() {
        try {
            await navigator.clipboard.writeText(FLYNN_NUMBER);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {}
    }

    // Fire the MessagedFlynn conversion + attribution bridge, then open iMessage
    // with the ref embedded. Static href stays as the no-JS fallback.
    function handleMessageFlynn(e: React.MouseEvent<HTMLAnchorElement>) {
        try {
            const ref = trackMessagedFlynn();
            const link = `sms:${FLYNN_NUMBER}&body=${encodeURIComponent(`Hi Flynn [${ref}]`)}`;
            e.preventDefault();
            window.location.href = link;
        } catch {
            // let the default href handle navigation
        }
    }

    return (
        <div className="not-prose bg-black text-white p-8 my-12 border-4 border-black shadow-[8px_8px_0px_0px_#ff4500]">
            <div className="flex items-start gap-6">
                {mascot && (
                    <img
                        src={`/mascots/${mascot}.png`}
                        alt=""
                        aria-hidden="true"
                        draggable={false}
                        className="hidden sm:block w-24 h-24 flex-shrink-0 select-none pointer-events-none -mt-1"
                    />
                )}
                <div className="flex-1">
                    <h3 className="text-2xl font-bold font-display mb-3">{headline}</h3>
                    <p className="text-gray-300 mb-6 leading-relaxed">{body}</p>

                    <a
                        href={SMS_LINK}
                        onClick={handleMessageFlynn}
                        className="inline-flex items-center gap-3 bg-white rounded-full px-6 py-3.5 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.4)] hover:scale-105 active:scale-95 transition-all"
                    >
                        <IMessageIcon size={28} />
                        <span className="text-[17px] font-semibold text-[#1A1A1A]">Message Flynn</span>
                    </a>

                    <p className="text-sm text-gray-400 mt-4">
                        On desktop? Text{' '}
                        <button
                            onClick={copyNumber}
                            className="font-semibold text-white hover:text-brand-500 transition-colors"
                        >
                            {copied ? 'Copied!' : FLYNN_NUMBER_DISPLAY}
                        </button>
                        {' '}from your phone.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default MessageFlynnCTA;
