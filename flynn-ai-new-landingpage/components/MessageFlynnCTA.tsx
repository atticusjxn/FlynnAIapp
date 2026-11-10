import React from 'react';
import WaitlistForm from './WaitlistForm';

interface MessageFlynnCTAProps {
    headline?: string;
    body?: string;
    /** Mascot pose to show beside the CTA (file in /public/mascots). Pass null to hide. */
    mascot?: string | null;
}

const MessageFlynnCTA: React.FC<MessageFlynnCTAProps> = ({
    headline = 'Want Flynn running your admin?',
    body = 'Flynn drafts replies, books jobs, sends invoices and chases payments.',
    mascot = 'phone',
}) => (
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
                <p className="text-gray-300 mb-3 leading-relaxed">{body}</p>
                <p className="text-gray-300 mb-6 leading-relaxed">
                    Flynn isn't taking new signups right now. Leave your email and we'll let you know when it opens up again.
                </p>
                <WaitlistForm source="blog" />
            </div>
        </div>
    </div>
);

export default MessageFlynnCTA;
