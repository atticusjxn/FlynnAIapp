import React, { useMemo } from 'react';
import { trackStoreBadgeClick } from '../services/tracking';

const APP_STORE_URL = 'https://apps.apple.com/au/app/flynnai/id6752254950';
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.flynnai.app';

const AppleLogo = () => (
    <svg viewBox="0 0 384 512" fill="currentColor" className="w-6 h-6 flex-shrink-0">
        <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 52.3-11.4 69.5-34.3z" />
    </svg>
);

const GooglePlayLogo = () => (
    <svg viewBox="0 0 512 512" fill="currentColor" className="w-6 h-6 flex-shrink-0">
        <path d="M325.3 234.3L104.6 13l280.8 161.2-60.1 60.1zM47 0C34 6.8 25.3 19.2 25.3 35.3v441.3c0 16.1 8.7 28.5 21.7 35.3l256.6-256L47 0zm425.2 225.6l-58.9-34.1-65.7 64.5 65.7 64.5 60.1-34.1c18-14.3 18-46.5-1.2-60.8zM104.6 499l220.7-221.2-60.1-60.1L104.6 499z" />
    </svg>
);

type DeviceType = 'ios' | 'android' | 'desktop';

function detectDevice(): DeviceType {
    if (typeof navigator === 'undefined') return 'desktop';
    const ua = navigator.userAgent;
    if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
    if (/Android/i.test(ua)) return 'android';
    return 'desktop';
}

interface SmartStoreCTAProps {
    headline?: string;
    body?: string;
    forceDevice?: DeviceType;
}

const SmartStoreCTA: React.FC<SmartStoreCTAProps> = ({
    headline = 'Ready to Stop Missing Calls?',
    body = 'Flynn answers every missed call and instantly texts callers a booking or quote link. Set up in 5 minutes, no new number needed.',
    forceDevice,
}) => {
    const device = useMemo(() => forceDevice ?? detectDevice(), [forceDevice]);
    const showIOS = device === 'ios' || device === 'desktop';
    const showAndroid = device === 'android' || device === 'desktop';

    return (
        <div className="bg-black text-white p-8 my-10 border-4 border-black shadow-[8px_8px_0px_0px_#ff4500]">
            <h3 className="text-2xl font-bold font-display mb-3">{headline}</h3>
            <p className="text-gray-300 mb-6 leading-relaxed">{body}</p>

            <div className="flex flex-wrap gap-4">
                {showIOS && (
                    <a
                        href={APP_STORE_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => trackStoreBadgeClick('apple')}
                        className="flex items-center gap-3 bg-white text-black px-5 py-3 border-2 border-white hover:bg-gray-100 transition-all hover:scale-105"
                    >
                        <AppleLogo />
                        <div className="flex flex-col items-start leading-none">
                            <span className="text-[10px] uppercase font-medium opacity-60 mb-0.5">Download on the</span>
                            <span className="text-lg font-bold font-display tracking-tight">App Store</span>
                        </div>
                    </a>
                )}
                {showAndroid && (
                    <a
                        href={PLAY_STORE_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => trackStoreBadgeClick('google')}
                        className="flex items-center gap-3 bg-white text-black px-5 py-3 border-2 border-white hover:bg-gray-100 transition-all hover:scale-105"
                    >
                        <GooglePlayLogo />
                        <div className="flex flex-col items-start leading-none">
                            <span className="text-[10px] uppercase font-medium opacity-60 mb-0.5">GET IT ON</span>
                            <span className="text-lg font-bold font-display tracking-tight">Google Play</span>
                        </div>
                    </a>
                )}
            </div>
        </div>
    );
};

export default SmartStoreCTA;
