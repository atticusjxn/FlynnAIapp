import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Send, Check } from 'lucide-react';

export const SceneQuote: React.FC = () => {
    const [view, setView] = useState<'quote' | 'sms'>('quote');
    const [sent, setSent] = useState(false);

    useEffect(() => {
        if (view === 'quote') {
            const timer = setTimeout(() => {
                setSent(true);
                setTimeout(() => setView('sms'), 1000);
            }, 2000); // Simulate "Sending" after 2s
            return () => clearTimeout(timer);
        }
    }, [view]);

    return (
        <div className="h-full w-full bg-gray-50 flex flex-col relative overflow-hidden">
            <AnimatePresence mode="wait">
                {view === 'quote' ? (
                    <motion.div
                        key="quote-ui"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -50 }}
                        className="p-6 flex flex-col h-full"
                    >
                        <h2 className="text-xl font-bold mb-6 text-gray-900">Send Quote</h2>

                        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6 space-y-4">
                            <div>
                                <label className="text-xs font-semibold text-gray-500 uppercase">Item</label>
                                <div className="text-gray-900 font-medium">Tap Washer Replacement</div>
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-gray-500 uppercase">Price</label>
                                <div className="text-2xl font-bold text-gray-900">$180.00</div>
                            </div>
                        </div>

                        <div className="mt-auto">
                            <motion.button
                                className={`w-full py-4 rounded-xl font-bold text-white flex items-center justify-center gap-2 ${sent ? 'bg-green-600' : 'bg-black'}`}
                                animate={sent ? { scale: [1, 0.95, 1] } : {}}
                            >
                                {sent ? <Check size={20} /> : <Send size={20} />}
                                {sent ? "Sent" : "Send Quote"}
                            </motion.button>
                        </div>
                    </motion.div>
                ) : (
                    <motion.div
                        key="sms-ui"
                        initial={{ opacity: 0, x: 50 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex flex-col h-full bg-slate-100"
                    >
                        {/* SMS Header */}
                        <div className="bg-gray-100 p-4 border-b border-gray-200 flex items-center gap-2">
                            <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center text-xs font-bold text-gray-600">SJ</div>
                            <div className="text-sm font-semibold">Sarah Jenkins</div>
                        </div>

                        {/* Messages */}
                        <div className="flex-1 p-4 space-y-4">
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="self-end bg-green-500 text-white p-3 rounded-2xl rounded-tr-sm max-w-[85%] text-sm shadow-sm ml-auto"
                            >
                                Hi Sarah, here is the quote for the tap repair: link.flynn.ai/q/29s8a
                            </motion.div>

                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 1.5 }}
                                className="self-start bg-gray-200 text-gray-900 p-3 rounded-2xl rounded-tl-sm max-w-[85%] text-sm shadow-sm"
                            >
                                Thanks! Just approved it.
                            </motion.div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
