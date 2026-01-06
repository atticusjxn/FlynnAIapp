import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ArrowUp } from 'lucide-react';

const PATH_F_BODY = "M0 0 C116.82 0 233.64 0 354 0 C354 32.34 354 64.68 354 98 C273.81 98 193.62 98 111 98 C111 106.58 111 115.16 111 124 C170.07 124 229.14 124 290 124 C290 156.01 290 188.02 290 221 C230.93 221 171.86 221 111 221 C111 227.93 111 234.86 111 242 C74.37 242 37.74 242 0 242 C0 162.14 0 82.28 0 0 Z";
const PATH_F_DOT = "M0 0 C36.3 0 72.6 0 110 0 C110 28.38 110 56.76 110 86 C73.7 86 37.4 86 0 86 C0 57.62 0 29.24 0 0 Z";

const InstagramAd: React.FC = () => {
    // Single scene flow using delays
    return (
        <div className="w-full h-screen bg-[#f9fafb] text-[#111] overflow-hidden flex flex-col items-center justify-center relative font-sans" style={{ fontFamily: 'Inter, sans-serif' }}>

            {/* Logo Section */}
            <motion.div
                className="mb-12"
                initial={{ opacity: 1 }}
            >
                <svg width="200" height="200" viewBox="0 0 500 500">
                    <motion.path
                        d={PATH_F_BODY}
                        transform="translate(82, 75)"
                        fill="#2E2F30"
                        stroke="#2E2F30"
                        strokeWidth="5"
                        initial={{ pathLength: 0, fillOpacity: 0 }}
                        animate={{ pathLength: 1, fillOpacity: 1 }}
                        transition={{
                            pathLength: { duration: 1.5, ease: "easeInOut" },
                            fillOpacity: { delay: 1.2, duration: 0.5 }
                        }}
                    />
                    <motion.path
                        d={PATH_F_DOT}
                        transform="translate(83, 339)"
                        fill="#ff4500"
                        stroke="#ff4500"
                        strokeWidth="5"
                        initial={{ pathLength: 0, fillOpacity: 0 }}
                        animate={{ pathLength: 1, fillOpacity: 1 }}
                        transition={{
                            pathLength: { duration: 1.5, ease: "easeInOut" },
                            fillOpacity: { delay: 1.2, duration: 0.5 }
                        }}
                    />
                </svg>
            </motion.div>

            {/* Tagline */}
            <motion.div
                className="text-center mb-16 px-6"
                style={{ fontFamily: 'Space Grotesk, sans-serif' }}
            >
                <motion.h1
                    className="text-6xl font-black uppercase leading-tight tracking-tight mb-2"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 2, duration: 0.6 }}
                >
                    Don't Miss
                </motion.h1>
                <motion.h1
                    className="text-6xl font-black uppercase leading-tight tracking-tight text-[#ff4500] italic"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 2.2, duration: 0.6 }}
                >
                    Another Lead.
                </motion.h1>
            </motion.div>

            {/* CTA Button */}
            <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 2.8, duration: 0.5, type: "spring" }}
            >
                <div className="bg-[#111] text-white px-8 py-5 rounded-lg font-bold text-xl shadow-xl flex items-center space-x-3 uppercase tracking-wider relative overflow-hidden group">
                    <span className="relative z-10">14 Day Free Trial</span>
                    <Sparkles size={20} className="text-[#ff4500] relative z-10" />

                    {/* Hover/Attention effect */}
                    <div className="absolute inset-0 bg-[#ff4500] opacity-0 group-hover:opacity-10 transition-opacity"></div>
                </div>
            </motion.div>

            {/* Swipe Up Indicator */}
            <motion.div
                className="absolute bottom-12 flex flex-col items-center opacity-60"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, y: [0, -10, 0] }}
                transition={{
                    opacity: { delay: 3.5, duration: 0.5 },
                    y: { repeat: Infinity, duration: 1.5, delay: 3.5 }
                }}
            >
                <p className="font-semibold text-sm mb-2 uppercase tracking-widest">Swipe Up</p>
                <ArrowUp size={24} />
            </motion.div>

        </div>
    );
};

export default InstagramAd;
