import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { MapPin, User, Calendar, Clock, CheckCircle } from 'lucide-react';

export const SceneJobCard: React.FC = () => {
    // Animation stages for filling in data
    const [step, setStep] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setStep(prev => (prev < 4 ? prev + 1 : prev));
        }, 800); // Progress every 0.8s
        return () => clearInterval(interval);
    }, []);

    // Mock Data
    const jobData = {
        client: "Sarah Jenkins",
        address: "128 Willow Creek Dr, Paddington",
        type: "Leaking Tap & Washer Replacement",
        time: "Tomorrow, 9:00 AM",
        status: "Action Required"
    };

    const containerVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
    };

    const itemVariants = {
        hidden: { opacity: 0, x: -10 },
        visible: { opacity: 1, x: 0, transition: { duration: 0.3 } }
    };

    return (
        <div className="h-full w-full bg-gray-50 p-6 flex flex-col pt-12 relative overflow-hidden">
            <h2 className="text-xl font-bold mb-6 text-gray-900">New Job Created</h2>

            <motion.div
                className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
            >
                {/* Header */}
                <div className="bg-blue-600 p-4 flex justify-between items-center text-white">
                    <span className="font-bold">#JOB-2481</span>
                    <span className="text-xs bg-white/20 px-2 py-1 rounded">New</span>
                </div>

                {/* Content */}
                <div className="p-5 space-y-4">
                    {/* Client Name */}
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-400">
                            <User size={16} />
                        </div>
                        <div className="flex-1 h-10 flex items-center">
                            {step >= 1 ? (
                                <motion.div variants={itemVariants} initial="hidden" animate="visible">
                                    <p className="font-bold text-gray-900">{jobData.client}</p>
                                    <p className="text-xs text-gray-500">0412 345 678</p>
                                </motion.div>
                            ) : (
                                <div className="h-4 w-32 bg-gray-100 rounded animate-pulse" />
                            )}
                        </div>
                    </div>

                    {/* Address */}
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-400">
                            <MapPin size={16} />
                        </div>
                        <div className="flex-1 h-6 flex items-center">
                            {step >= 2 ? (
                                <motion.div variants={itemVariants} initial="hidden" animate="visible" className="text-sm text-gray-700">
                                    {jobData.address}
                                </motion.div>
                            ) : (
                                <div className="h-4 w-full bg-gray-100 rounded animate-pulse" />
                            )}
                        </div>
                    </div>

                    {/* Job Type */}
                    <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                        {step >= 3 ? (
                            <motion.div variants={itemVariants} initial="hidden" animate="visible">
                                <p className="text-xs font-semibold text-blue-800 uppercase tracking-wide mb-1">Job Description</p>
                                <p className="text-sm font-medium text-blue-900">{jobData.type}</p>
                            </motion.div>
                        ) : (
                            <div className="h-10 w-full bg-blue-100/50 rounded animate-pulse" />
                        )}
                    </div>

                    {/* Date/Time */}
                    <div className="flex gap-4 pt-2">
                        <div className="flex items-center gap-2">
                            <Calendar size={14} className="text-gray-400" />
                            {step >= 4 ? (
                                <motion.div variants={itemVariants} initial="hidden" animate="visible" className="text-xs font-medium text-gray-600">
                                    Tomorrow
                                </motion.div>
                            ) : <div className="h-3 w-16 bg-gray-100 rounded animate-pulse" />}
                        </div>
                        <div className="flex items-center gap-2">
                            <Clock size={14} className="text-gray-400" />
                            {step >= 4 ? (
                                <motion.div variants={itemVariants} initial="hidden" animate="visible" className="text-xs font-medium text-gray-600">
                                    9:00 AM
                                </motion.div>
                            ) : <div className="h-3 w-16 bg-gray-100 rounded animate-pulse" />}
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* Success Toast */}
            {step >= 4 && (
                <motion.div
                    initial={{ opacity: 0, y: 50 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="absolute bottom-10 left-6 right-6 bg-green-900 text-white p-3 rounded-lg shadow-lg flex items-center justify-center gap-2"
                >
                    <CheckCircle size={18} className="text-green-400" />
                    <span className="font-medium text-sm">Draft Created</span>
                </motion.div>
            )}
        </div>
    );
};
