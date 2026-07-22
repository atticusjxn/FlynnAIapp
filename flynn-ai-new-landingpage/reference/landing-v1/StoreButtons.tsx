import React from 'react';
import { trackStoreBadgeClick } from '../services/tracking';

const AppleLogo = () => (
    <svg viewBox="0 0 384 512" fill="currentColor" className="w-6 h-6">
        <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 52.3-11.4 69.5-34.3z" />
    </svg>
);

const GooglePlayLogo = () => (
    <svg viewBox="0 0 512 512" fill="currentColor" className="w-6 h-6">
        <path d="M325.3 234.3L104.6 13l280.8 161.2-60.1 60.1zM47 0C34 6.8 25.3 19.2 25.3 35.3v441.3c0 16.1 8.7 28.5 21.7 35.3l256.6-256L47 0zm425.2 225.6l-58.9-34.1-65.7 64.5 65.7 64.5 60.1-34.1c18-14.3 18-46.5-1.2-60.8zM104.6 499l220.7-221.2-60.1-60.1L104.6 499z" />
    </svg>
);

interface StoreButtonProps {
    store: 'apple' | 'google';
    url: string;
}

const StoreButton: React.FC<StoreButtonProps> = ({ store, url }) => {
    const isApple = store === 'apple';
    const Icon = isApple ? AppleLogo : GooglePlayLogo;
    const subtitle = isApple ? 'Download on the' : 'GET IT ON';
    const title = isApple ? 'App Store' : 'Google Play';

    return (
        <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackStoreBadgeClick(store)}
            className="flex items-center gap-3 bg-black text-white px-5 py-2.5 rounded-lg border-2 border-black hover:bg-gray-900 transition-all hover:scale-105 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)]"
        >
            <Icon />
            <div className="flex flex-col items-start leading-none">
                <span className="text-[10px] uppercase font-medium opacity-80 mb-0.5">{subtitle}</span>
                <span className="text-lg font-bold font-display tracking-tight">{title}</span>
            </div>
        </a>
    );
};

const MacLogo = () => (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
    </svg>
);

const MacButton: React.FC = () => (
    <a
        href="https://flynnai.app/download/Flynn.dmg"
        onClick={() => trackStoreBadgeClick('mac' as any)}
        className="flex items-center gap-3 bg-black text-white px-5 py-2.5 rounded-lg border-2 border-black hover:bg-gray-900 transition-all hover:scale-105 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)]"
    >
        <MacLogo />
        <div className="flex flex-col items-start leading-none">
            <span className="text-[10px] uppercase font-medium opacity-80 mb-0.5">Download for</span>
            <span className="text-lg font-bold font-display tracking-tight">Mac</span>
        </div>
    </a>
);

const StoreButtons: React.FC = () => {
    return (
        <div className="flex flex-wrap gap-4 mt-8">
            <StoreButton
                store="apple"
                url="https://apps.apple.com/au/app/flynnai/id6752254950"
            />
            <StoreButton
                store="google"
                url="https://play.google.com/store/apps/details?id=com.flynnai.app"
            />
            <MacButton />
        </div>
    );
};

export default StoreButtons;
