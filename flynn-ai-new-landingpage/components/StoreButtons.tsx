import React from 'react';
import { trackStoreBadgeClick } from '../services/tracking';

/*
 * Store CTAs in the 2026 pill language (.flynn-dock / .flynn-pill in
 * index.html — mirrored by FlynnGlassButton.swift and the hosted invoice
 * page so every surface reads as one product).
 *
 * Default: a dark translucent dock capsule grouping the three platforms,
 * with the App Store as the accented segment (it's the primary funnel).
 * `variant="hero"` swaps to a single orange bloom pill + quiet secondary
 * links, for hero / final-CTA moments that want one unmissable action.
 */

const AppleLogo = ({ className = 'w-5 h-5' }: { className?: string }) => (
    <svg viewBox="0 0 384 512" fill="currentColor" className={className}>
        <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 52.3-11.4 69.5-34.3z" />
    </svg>
);

const GooglePlayLogo = ({ className = 'w-5 h-5' }: { className?: string }) => (
    <svg viewBox="0 0 512 512" fill="currentColor" className={className}>
        <path d="M325.3 234.3L104.6 13l280.8 161.2-60.1 60.1zM47 0C34 6.8 25.3 19.2 25.3 35.3v441.3c0 16.1 8.7 28.5 21.7 35.3l256.6-256L47 0zm425.2 225.6l-58.9-34.1-65.7 64.5 65.7 64.5 60.1-34.1c18-14.3 18-46.5-1.2-60.8zM104.6 499l220.7-221.2-60.1-60.1L104.6 499z" />
    </svg>
);

const MacLogo = ({ className = 'w-5 h-5' }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
    </svg>
);

const APP_STORE_URL = 'https://apps.apple.com/au/app/flynnai/id6752254950';
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.flynnai.app';
const MAC_URL = 'https://flynnai.app/download/Flynn.dmg';

interface StoreButtonsProps {
    variant?: 'dock' | 'hero';
}

const StoreButtons: React.FC<StoreButtonsProps> = ({ variant = 'dock' }) => {
    if (variant === 'hero') {
        return (
            <div className="flex flex-col items-center gap-4">
                <a
                    href={APP_STORE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => trackStoreBadgeClick('apple')}
                    className="flynn-glass flynn-glass--primary flynn-pill inline-flex items-center gap-3 px-9 py-4 font-display font-bold text-lg"
                >
                    <AppleLogo className="w-6 h-6" />
                    Get Flynn for iPhone
                </a>
                <div className="flex items-center gap-5 text-sm font-medium text-[#8C7B6A]">
                    <a href={PLAY_STORE_URL} target="_blank" rel="noopener noreferrer"
                        onClick={() => trackStoreBadgeClick('google')}
                        className="inline-flex items-center gap-1.5 hover:text-[#2C2018] transition-colors">
                        <GooglePlayLogo className="w-3.5 h-3.5" /> Android
                    </a>
                    <span className="opacity-40">·</span>
                    <a href={MAC_URL}
                        onClick={() => trackStoreBadgeClick('mac' as any)}
                        className="inline-flex items-center gap-1.5 hover:text-[#2C2018] transition-colors">
                        <MacLogo className="w-3.5 h-3.5" /> Mac
                    </a>
                </div>
            </div>
        );
    }

    return (
        <div className="flynn-dock">
            <a
                href={APP_STORE_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackStoreBadgeClick('apple')}
                className="flynn-dock__item flynn-dock__item--accent font-display"
            >
                <AppleLogo />
                <span className="flex flex-col items-start leading-none">
                    <span className="text-[9px] uppercase tracking-wide opacity-85 mb-0.5">Download on the</span>
                    <span className="text-[15px] font-bold tracking-tight">App Store</span>
                </span>
            </a>
            <a
                href={PLAY_STORE_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackStoreBadgeClick('google')}
                className="flynn-dock__item font-display"
            >
                <GooglePlayLogo />
                <span className="flex flex-col items-start leading-none">
                    <span className="text-[9px] uppercase tracking-wide opacity-70 mb-0.5">Get it on</span>
                    <span className="text-[15px] font-bold tracking-tight">Google Play</span>
                </span>
            </a>
            <a
                href={MAC_URL}
                onClick={() => trackStoreBadgeClick('mac' as any)}
                className="flynn-dock__item font-display"
            >
                <MacLogo />
                <span className="flex flex-col items-start leading-none">
                    <span className="text-[9px] uppercase tracking-wide opacity-70 mb-0.5">Download for</span>
                    <span className="text-[15px] font-bold tracking-tight">Mac</span>
                </span>
            </a>
        </div>
    );
};

export default StoreButtons;
