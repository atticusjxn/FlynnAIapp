import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Plug, Settings, LogOut, Menu, X, User } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { getCurrentUser, signOut } from '../services/auth';

const ORANGE = '#FB5B1E';

const navItems = [
    { path: '/dashboard', label: 'Overview', icon: LayoutDashboard, end: true },
    { path: '/dashboard/integrations', label: 'Integrations', icon: Plug, end: false },
    { path: '/app/settings/business-brain', label: 'Brain & Settings', icon: Settings, end: false },
];

const DashboardNav = () => {
    const navigate = useNavigate();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [email, setEmail] = useState<string>('');

    useEffect(() => {
        (async () => {
            try {
                const user = await getCurrentUser();
                if (user?.email) setEmail(user.email);
            } catch {
                /* not signed in — Dashboard guards handle redirect */
            }
        })();
    }, []);

    const handleLogout = async () => {
        try {
            await signOut();
        } catch {
            /* ignore — still bounce to login */
        }
        navigate('/login');
    };

    const linkClass = ({ isActive }: { isActive: boolean }) =>
        [
            'flex items-center gap-3 px-3 py-3 rounded-lg transition-colors font-medium',
            isActive ? 'text-white' : 'text-gray-700 hover:bg-[#F4E6CE]',
        ].join(' ');

    const linkStyle = ({ isActive }: { isActive: boolean }) =>
        isActive ? { backgroundColor: ORANGE } : undefined;

    return (
        <>
            {/* Desktop Sidebar */}
            <aside className="hidden lg:flex flex-col w-64 bg-white text-gray-900 h-screen fixed left-0 top-0 border-r-2 border-black">
                <div className="p-6 border-b-2 border-black">
                    <div className="font-display font-bold text-2xl tracking-tighter">
                        FLYNN<span style={{ color: ORANGE }}>.AI</span>
                    </div>
                </div>

                <nav className="flex-1 py-6 px-3 space-y-1">
                    {navItems.map((item) => (
                        <NavLink key={item.path} to={item.path} end={item.end} className={linkClass} style={linkStyle}>
                            <item.icon size={20} />
                            <span className="font-display tracking-wide">{item.label}</span>
                        </NavLink>
                    ))}
                </nav>

                <div className="p-4 border-t-2 border-black">
                    <div className="flex items-center gap-3 px-2 py-2 mb-1">
                        <div className="w-8 h-8 rounded-full bg-[#F4E6CE] flex items-center justify-center border border-black">
                            <User size={14} className="text-gray-700" />
                        </div>
                        <p className="text-xs font-medium text-gray-700 truncate">{email || 'Signed in'}</p>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2 px-2 py-2 text-sm text-gray-500 hover:text-black transition-colors"
                    >
                        <LogOut size={16} />
                        Sign Out
                    </button>
                </div>
            </aside>

            {/* Mobile Header */}
            <div className="lg:hidden fixed top-0 left-0 right-0 bg-white text-gray-900 z-50 px-4 py-3 flex items-center justify-between border-b-2 border-black">
                <div className="font-display font-bold text-xl tracking-tighter">
                    FLYNN<span style={{ color: ORANGE }}>.AI</span>
                </div>
                <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2">
                    {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                </button>
            </div>

            {/* Mobile Menu Overlay */}
            <AnimatePresence>
                {isMobileMenuOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="fixed inset-0 bg-[#F4E6CE] z-40 pt-16 lg:hidden"
                    >
                        <div className="p-4 space-y-2">
                            {navItems.map((item) => (
                                <NavLink
                                    key={item.path}
                                    to={item.path}
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    end={item.end}
                                    className={({ isActive }) =>
                                        [
                                            'flex items-center gap-3 px-4 py-4 rounded-lg transition-colors border-2 border-black font-medium',
                                            isActive ? 'text-white' : 'text-gray-800 bg-white',
                                        ].join(' ')
                                    }
                                    style={linkStyle}
                                >
                                    <item.icon size={20} />
                                    <span className="font-display tracking-wide text-lg">{item.label}</span>
                                </NavLink>
                            ))}
                            <button
                                onClick={handleLogout}
                                className="w-full flex items-center gap-3 px-4 py-4 text-gray-700 mt-6 border-2 border-black bg-white rounded-lg"
                            >
                                <LogOut size={20} />
                                <span className="font-display tracking-wide text-lg">Sign Out</span>
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
};

export default DashboardNav;
