import React, { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
    LayoutDashboard,
    Settings,
    MessageSquare,
    Phone,
    LogOut,
    Menu,
    X,
    User
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const DashboardNav = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const navItems = [
        { path: '/dashboard', label: 'Overview', icon: LayoutDashboard, exact: true },
        { path: '/dashboard/setup', label: 'Setup & Settings', icon: Settings },
        { path: '/dashboard/messages', label: 'Messages', icon: MessageSquare },
        { path: '/dashboard/calls', label: 'Call Log', icon: Phone },
    ];

    const handleLogout = () => {
        navigate('/login');
    };

    const isActive = (path: string, exact: boolean = false) => {
        if (exact) {
            return location.pathname === path;
        }
        return location.pathname.startsWith(path);
    };

    return (
        <>
            {/* Desktop Sidebar */}
            <aside className="hidden lg:flex flex-col w-64 bg-black text-white h-screen fixed left-0 top-0 border-r border-[#1a1a1a]">
                <div className="p-6 border-b border-[#1a1a1a]">
                    <div className="font-display font-bold text-2xl tracking-tighter">
                        FLYNN<span className="text-brand-500">.AI</span>
                    </div>
                </div>

                <div className="flex-1 py-6 px-3 space-y-1">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            end={item.exact}
                            className={({ isActive }) => `
                                flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-200 group
                                ${isActive
                                    ? 'bg-brand-500 text-white font-medium'
                                    : 'text-gray-400 hover:bg-[#1a1a1a] hover:text-white'
                                }
                            `}
                        >
                            <item.icon size={20} />
                            <span className="font-display tracking-wide">{item.label}</span>
                            {/* Active Indicator */}
                            {isActive(item.path, item.exact) && (
                                <motion.div
                                    layoutId="activeNav"
                                    className="ml-auto w-1.5 h-1.5 rounded-full bg-white"
                                />
                            )}
                        </NavLink>
                    ))}
                </div>

                <div className="p-4 border-t border-[#1a1a1a]">
                    <div className="flex items-center gap-3 px-3 py-3 mb-2">
                        <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center border border-gray-700">
                            <User size={14} className="text-gray-400" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-white leading-none">Demo User</p>
                            <p className="text-xs text-brand-500">Premium Plan</p>
                        </div>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-500 hover:text-white transition-colors"
                    >
                        <LogOut size={16} />
                        Sign Out
                    </button>
                </div>
            </aside>

            {/* Mobile Header */}
            <div className="lg:hidden fixed top-0 left-0 right-0 bg-black text-white z-50 px-4 py-3 flex items-center justify-between border-b border-[#1a1a1a]">
                <div className="font-display font-bold text-xl tracking-tighter">
                    FLYNN<span className="text-brand-500">.AI</span>
                </div>
                <button
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    className="p-2"
                >
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
                        className="fixed inset-0 bg-black z-40 pt-16 lg:hidden"
                    >
                        <div className="p-4 space-y-2">
                            {navItems.map((item) => (
                                <NavLink
                                    key={item.path}
                                    to={item.path}
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    end={item.exact}
                                    className={({ isActive }) => `
                                        flex items-center gap-3 px-4 py-4 rounded-lg transition-all duration-200 border border-transparent
                                        ${isActive
                                            ? 'bg-brand-500 text-white font-medium shadow-[4px_4px_0px_0px_rgba(255,255,255,0.2)]'
                                            : 'text-gray-400 border-gray-800 bg-[#111]'
                                        }
                                    `}
                                >
                                    <item.icon size={20} />
                                    <span className="font-display tracking-wide text-lg">{item.label}</span>
                                </NavLink>
                            ))}
                            <button
                                onClick={handleLogout}
                                className="w-full flex items-center gap-3 px-4 py-4 text-gray-400 mt-8 border border-gray-800 bg-[#111] rounded-lg"
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
