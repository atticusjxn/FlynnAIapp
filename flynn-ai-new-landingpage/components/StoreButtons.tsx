import React from 'react';

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

const StoreButtons: React.FC = () => {
    return (
        <div className="flex flex-wrap gap-4 mt-8">
            <StoreButton
                store="apple"
                url="https://apps.apple.com/tr/app/flynnai/id6752254950"
            />
            <StoreButton
                store="google"
                url="https://play.google.com/store/apps/details?id=com.flynnai.app"
            />
        </div>
    );
};

export default StoreButtons;
