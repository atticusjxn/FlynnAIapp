import React, { useEffect, useState } from 'react';
import { Outlet, useLocation, Link } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';

const CookieBanner = () => {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (!localStorage.getItem('cookie-consent')) {
            setVisible(true);
        }
    }, []);

    const accept = () => {
        localStorage.setItem('cookie-consent', 'true');
        setVisible(false);
    };

    if (!visible) return null;

    return (
        <div className="fixed bottom-4 right-4 max-w-sm bg-black text-white p-6 border-2 border-white shadow-[4px_4px_0px_0px_rgba(255,255,255,0.5)] z-50">
            <h4 className="font-bold font-display uppercase tracking-wider mb-2">Cookies & Privacy</h4>
            <p className="text-sm text-gray-300 mb-4">
                We use cookies to ensure you get the best experience on our website.
            </p>
            <div className="flex gap-4">
                <button onClick={accept} className="bg-brand-500 text-white px-4 py-2 font-bold uppercase text-xs tracking-wider hover:bg-white hover:text-black transition-colors">
                    Accept
                </button>
            </div>
        </div>
    );
};

const Layout: React.FC = () => {
    const { pathname } = useLocation();

    useEffect(() => {
        window.scrollTo(0, 0);
    }, [pathname]);

    return (
        <div className="flex flex-col min-h-screen bg-surface-50">
            <Navbar />
            <main className="flex-grow pt-20">
                <Outlet />
            </main>
            <Footer />
            <CookieBanner />
        </div>
    );
};

export default Layout;
