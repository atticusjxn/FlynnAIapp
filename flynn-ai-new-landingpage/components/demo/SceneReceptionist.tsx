import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, Mic, User } from 'lucide-react';

const AVATAR_URL = "https://framerusercontent.com/images/3X4Q5Z1a9q2w3e4r5t6y7u8.png"; // Placeholder or use local if found

export const SceneReceptionist: React.FC = () => {
    // sub-states: 'ringing' | 'connected'
    const [callState, setCallState] = useState<'ringing' | 'connected'>('ringing');
    const [messages, setMessages] = useState<{ id: number; text: string; sender: 'ai' | 'user' }[]>([]);

    useEffect(() => {
        // Timeline
        const t1 = setTimeout(() => setCallState('connected'), 2000); // Pick up after 2s

        const t2 = setTimeout(() => {
            if (callState === 'connected' || true) { // Force for now
                setMessages(prev => [...prev, { id: 1, text: "Hi, this is Flynn, how can I help you?", sender: 'ai' }]);
            }
        }, 3000); // Greet 1s after connect

        const t3 = setTimeout(() => {
            setMessages(prev => [...prev, { id: 2, text: "I missed a call, can I book a job?", sender: 'user' }]);
        }, 5000);

        const t4 = setTimeout(() => {
            setMessages(prev => [...prev, { id: 3, text: "Absolutely. I can help with that.", sender: 'ai' }]);
        }, 7000);

        return () => {
            clearTimeout(t1);
            clearTimeout(t2);
            clearTimeout(t3);
            clearTimeout(t4);
        };
    }, []);

    return (
        <div className="h-full w-full bg-gray-50 flex flex-col relative overflow-hidden">
            <AnimatePresence mode="wait">
                {callState === 'ringing' ? (
                    <motion.div
                        key="incoming-call"
                        className="absolute inset-0 bg-gray-900/95 backdrop-blur-md flex flex-col items-center pt-20 text-white z-50"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0, scale: 1.1 }}
                        transition={{ duration: 0.5 }}
                    >
                        <div className="flex flex-col items-center space-y-4">
                            <div className="w-20 h-20 bg-gray-700 rounded-full flex items-center justify-center animate-pulse">
                                <User size={40} className="text-gray-400" />
                            </div>
                            <div className="text-center">
                                <h2 className="text-2xl font-bold">Unknown Caller</h2>
                                <p className="text-gray-400">Mobile</p>
                            </div>
                        </div>

                        <div className="mt-auto mb-16 w-full px-8 flex justify-between items-center">
                            <div className="flex flex-col items-center gap-2">
                                <div className="p-4 bg-red-500 rounded-full">
                                    <Phone size={32} className="rotate-[135deg]" />
                                </div>
                                <span className="text-sm">Decline</span>
                            </div>
                            <div className="flex flex-col items-center gap-2">
                                <motion.div
                                    className="p-4 bg-green-500 rounded-full"
                                    animate={{ scale: [1, 1.1, 1] }}
                                    transition={{ repeat: Infinity, duration: 1.5 }}
                                >
                                    <Phone size={32} />
                                </motion.div>
                                <span className="text-sm">Accept</span>
                            </div>
                        </div>
                    </motion.div>
                ) : (
                    <motion.div
                        key="active-call"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex-1 flex flex-col relative"
                    >
                        {/* Header Area imitating the app's hero card */}
                        <div className="pt-8 pb-4 flex flex-col items-center z-10 bg-white shadow-sm">
                            <motion.div
                                className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mb-2"
                                animate={{ scale: [1, 1.1, 1] }} // subtle pulsating for talking
                                transition={{ repeat: Infinity, duration: 2 }}
                            >
                                <img src="/flynn-icon.png" alt="Flynn" className="w-10 h-10 opacity-80" onError={(e) => e.currentTarget.style.display = 'none'} />
                                <div className="absolute inset-0 rounded-full border-2 border-blue-500 opacity-20 animate-ping"></div>
                            </motion.div>
                            <h3 className="font-bold text-gray-900">Flynn AI</h3>
                            <p className="text-xs text-green-600 font-medium">● 00:05</p>
                        </div>

                        {/* Chat / Transcript View */}
                        <div className="flex-1 p-4 space-y-4 overflow-y-auto bg-gray-50">
                            <AnimatePresence>
                                {messages.map((msg) => (
                                    <motion.div
                                        key={msg.id}
                                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        className={`flex ${msg.sender === 'ai' ? 'justify-start' : 'justify-end'}`}
                                    >
                                        <div
                                            className={`max-w-[80%] p-3 rounded-2xl text-sm ${msg.sender === 'ai'
                                                    ? 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm shadow-sm'
                                                    : 'bg-blue-600 text-white rounded-tr-sm shadow-md'
                                                }`}
                                        >
                                            {msg.text}
                                        </div>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>

                        {/* Bottom Controls */}
                        <div className="p-4 bg-white border-t border-gray-100 flex justify-center pb-8">
                            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center text-red-500">
                                <Phone size={28} className="rotate-[135deg]" />
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
