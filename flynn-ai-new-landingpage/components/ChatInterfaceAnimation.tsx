
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Message {
    id: number;
    text: string;
    sender: 'flynn' | 'user';
    delay?: number;
}

const ChatInterfaceAnimation: React.FC = () => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [isTyping, setIsTyping] = useState(false);

    const conversation: Message[] = [
        { id: 1, text: "Hi! Thanks for calling Flynn Landscaping. How can I help?", sender: 'flynn', delay: 1000 },
        { id: 2, text: "Do you have any availability for a quote?", sender: 'user', delay: 2500 },
        { id: 3, text: "Yes! We can schedule a quote for you. What services are you looking for?", sender: 'flynn', delay: 4000 },
        { id: 4, text: "I need some landscaping work done in my backyard.", sender: 'user', delay: 6000 },
        { id: 5, text: "Got it. I'll have someone call you back to arrange a time.", sender: 'flynn', delay: 8000 },
    ];

    useEffect(() => {
        let timeouts: NodeJS.Timeout[] = [];
        let mounted = true;

        const runConversation = () => {
            if (!mounted) return;
            setMessages([]);

            conversation.forEach((msg) => {
                // Show typing indicator before Flynn speaks (except first maybe, or all)
                // For this simple demo, let's just show bubbles appearing

                // If we want typing indicators for Flynn:
                if (msg.sender === 'flynn') {
                    const typingStart = msg.delay! - 800;
                    if (typingStart > 0) {
                        const t1 = setTimeout(() => {
                            if (mounted) setIsTyping(true);
                        }, typingStart);
                        timeouts.push(t1);
                    }
                }

                const t2 = setTimeout(() => {
                    if (!mounted) return;
                    setIsTyping(false);
                    setMessages((prev) => [...prev, msg]);
                }, msg.delay);
                timeouts.push(t2);
            });

            // Loop the animation
            const totalDuration = conversation[conversation.length - 1].delay! + 4000;
            const t3 = setTimeout(() => {
                runConversation();
            }, totalDuration);
            timeouts.push(t3);
        };

        runConversation();

        return () => {
            mounted = false;
            timeouts.forEach(clearTimeout);
        };
    }, []);

    return (
        <div className="w-full h-full bg-gray-50 flex flex-col items-center justify-center p-4 relative overflow-hidden">
            {/* Dynamic background elements */}
            <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-gray-200/50 to-transparent pointer-events-none"></div>

            <div className="w-full max-w-sm flex flex-col space-y-4">
                <AnimatePresence mode="popLayout">
                    {messages.map((msg) => (
                        <motion.div
                            key={msg.id}
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }} // Optional exit anim if we cleared them differently
                            transition={{ duration: 0.3 }}
                            className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                            <div
                                className={`max-w-[85%] px-5 py-3 rounded-2xl text-sm font-medium shadow-sm ${msg.sender === 'user'
                                        ? 'bg-black text-white rounded-tr-none'
                                        : 'bg-white text-gray-800 border-2 border-gray-100 rounded-tl-none'
                                    }`}
                            >
                                {msg.text}
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>

                {isTyping && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="flex justify-start"
                    >
                        <div className="bg-gray-200 px-4 py-3 rounded-2xl rounded-tl-none flex space-x-1 items-center">
                            <motion.div
                                className="w-2 h-2 bg-gray-400 rounded-full"
                                animate={{ y: [0, -5, 0] }}
                                transition={{ duration: 0.6, repeat: Infinity, delay: 0 }}
                            />
                            <motion.div
                                className="w-2 h-2 bg-gray-400 rounded-full"
                                animate={{ y: [0, -5, 0] }}
                                transition={{ duration: 0.6, repeat: Infinity, delay: 0.2 }}
                            />
                            <motion.div
                                className="w-2 h-2 bg-gray-400 rounded-full"
                                animate={{ y: [0, -5, 0] }}
                                transition={{ duration: 0.6, repeat: Infinity, delay: 0.4 }}
                            />
                        </div>
                    </motion.div>
                )}
            </div>

            {/* Overlay to fade out bottom */}
            {/* <div className="absolute bottom-0 left-0 w-full h-12 bg-gradient-to-t from-gray-50 to-transparent"></div> */}
        </div>
    );
};

export default ChatInterfaceAnimation;
