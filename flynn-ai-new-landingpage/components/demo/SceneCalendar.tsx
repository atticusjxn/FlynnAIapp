import React from 'react';
import { motion } from 'framer-motion';
import { Calendar as CalendarIcon } from 'lucide-react';

export const SceneCalendar: React.FC = () => {
    const hours = [8, 9, 10, 11, 12];

    return (
        <div className="h-full w-full bg-white flex flex-col pt-12 relative overflow-hidden">
            <div className="px-6 mb-4 flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-900">Calendar</h2>
                <div className="flex gap-2">
                    {/* Mock Integrations */}
                    <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-[10px] font-bold text-blue-600">G</div>
                    <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-600">A</div>
                </div>
            </div>

            <div className="flex-1 relative">
                {/* Grid */}
                {hours.map((hour) => (
                    <div key={hour} className="h-20 border-t border-gray-100 px-4 relative group">
                        <span className="text-xs text-gray-400 -mt-2 absolute bg-white px-1">{hour}:00</span>
                    </div>
                ))}

                {/* Event */}
                <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 80, opacity: 1 }}
                    transition={{ duration: 0.6, type: "spring" }}
                    className="absolute top-20 left-16 right-4 bg-blue-600 rounded-lg p-3 shadow-md border-l-4 border-blue-800 overflow-hidden"
                >
                    <div className="text-white text-sm font-bold truncate">Sarah Jenkins - Tap Repair</div>
                    <div className="text-blue-100 text-xs mt-1 flex items-center gap-1">
                        <CalendarIcon size={10} />
                        128 Willow Creek Dr
                    </div>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.8 }}
                        className="absolute bottom-2 right-2 bg-white/20 px-1.5 py-0.5 rounded text-[10px] text-white"
                    >
                        Synced
                    </motion.div>
                </motion.div>
            </div>

            {/* Integrations floating particles (optional polish) */}
        </div>
    );
};
