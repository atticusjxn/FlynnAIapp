import React from 'react';

interface PhoneFrameProps {
    children: React.ReactNode;
}

export const PhoneFrame: React.FC<PhoneFrameProps> = ({ children }) => {
    return (
        <div className="relative mx-auto border-gray-900 bg-gray-900 border-[14px] rounded-[2.5rem] h-[600px] w-[300px] shadow-xl overflow-hidden ring-[1px] ring-gray-900/50">
            {/* Notch / Dynamic Island */}
            <div className="absolute top-0 left-1/2 transform -translate-x-1/2 h-[24px] w-[100px] bg-black rounded-b-[1rem] z-50"></div>

            {/* Screen Content */}
            <div className="h-full w-full bg-white rounded-[2rem] overflow-hidden relative">
                {/* Status Bar Mock */}
                <div className="h-[44px] w-full bg-white flex justify-between items-center px-6 pt-2 z-40 relative">
                    <span className="text-[10px] font-semibold text-black">9:41</span>
                    <div className="flex gap-1">
                        <div className="w-4 h-2.5 bg-black rounded-[1px]"></div>
                        <div className="w-4 h-2.5 bg-black rounded-[1px]"></div>
                        <div className="w-2.5 h-2.5 bg-black rounded-[1px]"></div>
                    </div>
                </div>
                {children}
            </div>
        </div>
    );
};
