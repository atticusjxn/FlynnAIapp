import React, { ReactNode } from 'react';
import DashboardNav from './DashboardNav';

interface DashboardLayoutProps {
    children: ReactNode;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
    return (
        <div className="min-h-screen bg-[#f3f4f6]">
            <DashboardNav />
            <div className="lg:pl-64 pt-16 lg:pt-0 min-h-screen transition-all duration-300">
                <main className="p-4 lg:p-8 max-w-7xl mx-auto">
                    {children}
                </main>
            </div>
        </div>
    );
};

export default DashboardLayout;
