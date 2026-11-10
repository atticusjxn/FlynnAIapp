import React from 'react';
import WaitlistForm from './WaitlistForm';

interface SmartStoreCTAProps {
    headline?: string;
    body?: string;
}

const SmartStoreCTA: React.FC<SmartStoreCTAProps> = ({
    headline = 'Ready to Stop Missing Calls?',
    body = 'Flynn answers every missed call and instantly texts callers a booking or quote link.',
}) => (
    <div className="bg-black text-white p-8 my-10 border-4 border-black shadow-[8px_8px_0px_0px_#ff4500]">
        <h3 className="text-2xl font-bold font-display mb-3">{headline}</h3>
        <p className="text-gray-300 mb-3 leading-relaxed">{body}</p>
        <p className="text-gray-300 mb-6 leading-relaxed">
            Flynn isn't taking new signups right now. Leave your email and we'll let you know when it opens up again.
        </p>
        <WaitlistForm source="blog" />
    </div>
);

export default SmartStoreCTA;
