import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PhoneFrame } from './PhoneFrame';
import { SceneReceptionist } from './SceneReceptionist';
import { SceneJobCard } from './SceneJobCard';
import { SceneQuote } from './SceneQuote';
import { SceneCalendar } from './SceneCalendar';

export const DemoContainer: React.FC = () => {
    // Scene management state
    // 0: Receptionist (Call -> Chat)
    // 1: Job Card (Creation)
    // 2: Quote (Sending)
    // 3: Calendar (Sync)
    const [currentScene, setCurrentScene] = useState(0);

    useEffect(() => {
        // Simple sequencer for now, will refine timing later
        const timer = setInterval(() => {
            setCurrentScene(prev => (prev + 1) % 4);
        }, 8000); // 8 seconds per scene for dev
        return () => clearInterval(timer);
    }, []);

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100 p-8 font-sans">
            <div className="relative">
                <PhoneFrame>
                    <AnimatePresence mode="wait">
                        {currentScene === 0 && <SceneReceptionist key="scene-receptionist" />}
                        {currentScene === 1 && <SceneJobCard key="scene-job" />}
                        {currentScene === 2 && <SceneQuote key="scene-quote" />}
                        {currentScene === 3 && <SceneCalendar key="scene-calendar" />}
                    </AnimatePresence>
                </PhoneFrame>

                {/* Floating Caption/Motion Text Overlay - Outside phone or synchronized */}
                <div className="absolute -right-64 top-1/2 -translate-y-1/2 w-48">
                    <AnimatePresence mode="wait">
                        {currentScene === 0 && (
                            <motion.div
                                key="text-0"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="text-3xl font-bold text-black"
                            >
                                Your AI Receptionist captures every opportunity.
                            </motion.div>
                        )}
                        {currentScene === 1 && (
                            <motion.div
                                key="text-1"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="text-3xl font-bold text-black"
                            >
                                Job cards created instantly.
                            </motion.div>
                        )}
                        {currentScene === 2 && (
                            <motion.div
                                key="text-2"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="text-3xl font-bold text-black"
                            >
                                Quotes sent automatically.
                            </motion.div>
                        )}
                        {currentScene === 3 && (
                            <motion.div
                                key="text-3"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="text-3xl font-bold text-black"
                            >
                                Synced to your calendar.
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
};
