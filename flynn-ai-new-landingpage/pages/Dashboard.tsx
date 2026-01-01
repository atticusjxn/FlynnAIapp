import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Phone, MessageSquare, Bell, ArrowUpRight, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import DownloadAppPopup from '../components/DownloadAppPopup';
import { getSession, getCurrentUser } from '../services/auth';
import { getCalls, getJobs, getAnalytics } from '../services/api';

// Helper function to format time ago
const getTimeAgo = (timestamp: string): string => {
    const now = new Date();
    const then = new Date(timestamp);
    const secondsAgo = Math.floor((now.getTime() - then.getTime()) / 1000);

    if (secondsAgo < 60) return 'Just now';
    if (secondsAgo < 3600) return `${Math.floor(secondsAgo / 60)} mins ago`;
    if (secondsAgo < 86400) return `${Math.floor(secondsAgo / 3600)} hours ago`;
    if (secondsAgo < 604800) return `${Math.floor(secondsAgo / 86400)} days ago`;
    return then.toLocaleDateString();
};

const StatCard = ({ title, value, change, icon: Icon, onClick }: any) => (
    <motion.div
        whileHover={{ y: -5 }}
        onClick={onClick}
        className="bg-white p-6 border-2 border-transparent hover:border-black hover:shadow-[8px_8px_0px_0px_#000000] transition-all cursor-pointer rounded-xl shadow-sm"
    >
        <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-gray-50 rounded-lg">
                <Icon size={24} className="text-gray-700" />
            </div>
            {change && (
                <span className="flex items-center text-green-600 text-sm font-bold bg-green-50 px-2 py-1 rounded-full">
                    <ArrowUpRight size={14} className="mr-1" /> {change}
                </span>
            )}
        </div>
        <h3 className="text-gray-500 font-medium mb-1">{title}</h3>
        <p className="text-4xl font-display font-bold">{value}</p>
    </motion.div>
);

const ActivityItem = ({ type, title, time, isNew }: any) => (
    <div className="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-lg hover:border-gray-300 transition-colors">
        <div className="flex items-center gap-4">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${type === 'call' ? 'bg-blue-50 text-blue-600' : 'bg-brand-50 text-brand-500'}`}>
                {type === 'call' ? <Phone size={18} /> : <MessageSquare size={18} />}
            </div>
            <div>
                <h4 className="font-bold text-gray-900">{title}</h4>
                <p className="text-xs text-gray-500">{time}</p>
            </div>
        </div>
        {isNew && <span className="w-2 h-2 bg-brand-500 rounded-full"></span>}
    </div>
);

const Dashboard = () => {
    const navigate = useNavigate();
    const [showPopup, setShowPopup] = useState(false);
    const [loading, setLoading] = useState(true);
    const [orgId, setOrgId] = useState<string | null>(null);
    const [analytics, setAnalytics] = useState({
        missed_calls: 0,
        new_leads: 0,
        total_calls: 0,
    });
    const [recentCalls, setRecentCalls] = useState<any[]>([]);

    useEffect(() => {
        const loadDashboardData = async () => {
            try {
                // Check if user is logged in
                const session = await getSession();
                if (!session) {
                    navigate('/login');
                    return;
                }

                const user = await getCurrentUser();
                if (!user) {
                    navigate('/login');
                    return;
                }

                // Get user's organization ID from metadata or default
                // This assumes org_id is stored in user metadata
                const userOrgId = user.user_metadata?.org_id || user.id;
                setOrgId(userOrgId);

                // Load analytics
                const analyticsData = await getAnalytics(userOrgId);
                setAnalytics(analyticsData);

                // Load recent calls
                const calls = await getCalls(userOrgId, 5);
                setRecentCalls(calls);

                setLoading(false);
            } catch (error) {
                console.error('Error loading dashboard data:', error);
                setLoading(false);
            }
        };

        loadDashboardData();
    }, [navigate]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
                    <p className="text-gray-500">Loading dashboard...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-display font-bold">Dashboard</h1>
                    <p className="text-gray-500">Welcome back! Here's what's happening today.</p>
                </div>
                <button
                    onClick={() => navigate('/dashboard/setup')}
                    className="bg-black text-white px-6 py-3 font-bold font-display uppercase tracking-wider hover:bg-brand-500 transition-colors flex items-center gap-2"
                >
                    <Plus size={20} /> Setup Receptionist
                </button>
            </header>

            {/* Stats Grid */}
            <div className="grid md:grid-cols-3 gap-6">
                <StatCard
                    title="Missed Calls Handled"
                    value={analytics.missed_calls}
                    change={analytics.missed_calls > 0 ? `+${Math.round((analytics.missed_calls / analytics.total_calls) * 100)}%` : undefined}
                    icon={Phone}
                    onClick={() => setShowPopup(true)}
                />
                <StatCard
                    title="New Leads"
                    value={analytics.new_leads}
                    change={analytics.new_leads > 0 ? `+${analytics.new_leads}` : undefined}
                    icon={MessageSquare}
                    onClick={() => setShowPopup(true)}
                />
                <StatCard
                    title="Total Calls"
                    value={analytics.total_calls}
                    icon={Bell}
                    onClick={() => setShowPopup(true)}
                />
            </div>

            <div className="grid lg:grid-cols-3 gap-8">
                {/* Recent Activity */}
                <div className="lg:col-span-2 space-y-6">
                    <h2 className="font-display font-bold text-xl">Recent Activity</h2>
                    <div className="space-y-3">
                        {recentCalls.length > 0 ? (
                            recentCalls.map((call) => {
                                const timeAgo = getTimeAgo(call.created_at);
                                const isRecent = new Date().getTime() - new Date(call.created_at).getTime() < 3600000; // Less than 1 hour
                                const callStatus = call.status === 'no-answer' ? 'Missed call' :
                                                  call.status === 'completed' ? 'Call completed' :
                                                  'Call forwarded';

                                return (
                                    <ActivityItem
                                        key={call.id}
                                        type="call"
                                        title={`${callStatus} from ${call.from_number}`}
                                        time={timeAgo}
                                        isNew={isRecent}
                                    />
                                );
                            })
                        ) : (
                            <div className="text-center py-12 text-gray-400">
                                <Phone size={48} className="mx-auto mb-4 opacity-30" />
                                <p className="font-medium">No calls yet</p>
                                <p className="text-sm mt-1">Your call activity will appear here</p>
                            </div>
                        )}
                    </div>
                    {recentCalls.length > 0 && (
                        <button
                            onClick={() => setShowPopup(true)}
                            className="w-full py-3 text-center text-sm font-bold text-gray-500 hover:text-black border-2 border-dashed border-gray-200 hover:border-black rounded-lg transition-all"
                        >
                            View All Activity
                        </button>
                    )}
                </div>

                {/* Quick Actions / Upsell */}
                <div className="bg-brand-500 text-white p-8 rounded-2xl relative overflow-hidden flex flex-col justify-between">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-10 rounded-full translate-x-1/2 -translate-y-1/2 blur-2xl"></div>

                    <div className="relative z-10">
                        <h3 className="font-display font-bold text-2xl mb-4">Go Mobile</h3>
                        <p className="text-white/80 mb-8">
                            Get instant push notifications for every missed call and new lead. Manage your business from anywhere.
                        </p>
                    </div>

                    <button
                        onClick={() => setShowPopup(true)}
                        className="relative z-10 bg-white text-black px-6 py-3 font-bold uppercase tracking-widest hover:bg-black hover:text-white transition-colors text-sm w-full"
                    >
                        Download App
                    </button>
                </div>
            </div>

            <DownloadAppPopup
                isOpen={showPopup}
                onClose={() => setShowPopup(false)}
            />
        </div>
    );
};

export default Dashboard;
