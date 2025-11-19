import React, { useState, useEffect } from 'react';
import { PhoneForwarded, Clock, MessageSquare, Bell } from 'lucide-react';
import { motion } from 'framer-motion';

// Typewriter Component for Human-Like Card
const Typewriter: React.FC<{ text: string; delay?: number }> = ({ text, delay = 0 }) => {
  const [display, setDisplay] = useState('');
  const [start, setStart] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => setStart(true), delay);
    return () => clearTimeout(timeout);
  }, [delay]);

  useEffect(() => {
    if (!start) return;
    let i = 0;
    const timer = setInterval(() => {
      if (i < text.length) {
        setDisplay(text.substring(0, i + 1));
        i++;
      } else {
        clearInterval(timer);
      }
    }, 40);
    return () => clearInterval(timer);
  }, [text, start]);

  return <span>{display}</span>;
};

const cardBase = "bg-white border-2 border-black p-6 md:p-8 transition-all duration-300 relative overflow-hidden flex flex-col justify-between h-full hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,0.1)] hover:-translate-y-1";

const Features: React.FC = () => {
  // State to trigger animations when scrolled into view
  const [viewTrigger, setViewTrigger] = useState(false);
  const [notificationTrigger, setNotificationTrigger] = useState(false);

  return (
    <section id="features" className="py-32 bg-surface-50 relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-noise opacity-[0.03] pointer-events-none"></div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="mb-20">
          <motion.h2 
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            className="text-6xl md:text-8xl font-bold text-black font-display tracking-tighter"
          >
            COMPLETE <br/> <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-500 to-brand-600 stroke-black stroke-2">CONTROL.</span>
          </motion.h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 auto-rows-[minmax(320px,auto)]">
          
          {/* Card 1: Smart Forwarding (Large 2x2) */}
          <motion.div 
            className={`${cardBase} md:col-span-2 md:row-span-2 bg-surface-100`}
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
             <div className="relative z-10 h-full flex flex-col">
                <div className="w-16 h-16 bg-brand-500 text-white flex items-center justify-center mb-8 shadow-[4px_4px_0px_0px_#000000]">
                    <PhoneForwarded size={32} />
                </div>
                <h3 className="text-4xl font-display font-bold text-black mb-4 leading-tight">Smart Forwarding</h3>
                <p className="text-gray-600 leading-relaxed text-lg font-medium max-w-sm">
                    Flynn detects when you're busy and picks up instantly. It's not just voicemail; it's an intelligent agent that filters spam and prioritizes leads.
                </p>
                
                {/* Visual for Forwarding */}
                 <div className="mt-auto pt-10 flex justify-center items-center opacity-60 grayscale hover:grayscale-0 transition-all duration-500">
                    <div className="flex items-center gap-6">
                        <div className="w-20 h-32 border-4 border-black rounded-2xl flex flex-col items-center justify-center bg-white relative">
                             <div className="absolute top-2 w-8 h-1 bg-black rounded-full"></div>
                             <PhoneForwarded className="text-gray-300" />
                        </div>
                        <motion.div 
                            animate={{ x: [0, 10, 0], opacity: [0.3, 1, 0.3] }}
                            transition={{ repeat: Infinity, duration: 1.5 }}
                            className="flex gap-1.5"
                        >
                           <div className="w-2.5 h-2.5 bg-brand-500 rounded-full"></div>
                           <div className="w-2.5 h-2.5 bg-brand-500 rounded-full"></div>
                           <div className="w-2.5 h-2.5 bg-brand-500 rounded-full"></div>
                        </motion.div>
                        <div className="w-20 h-32 bg-black rounded-2xl flex items-center justify-center shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)]">
                           <div className="w-10 h-10 border-2 border-white rounded-full animate-ping absolute"></div>
                           <div className="w-8 h-8 bg-brand-500 rounded-full relative z-10"></div>
                        </div>
                    </div>
                 </div>
             </div>
          </motion.div>

          {/* Card 2: Human-Like (Wide 2x1) - Lively Transcript */}
          <motion.div 
            className={`${cardBase} md:col-span-2`}
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            onViewportEnter={() => setViewTrigger(true)}
            transition={{ delay: 0.1 }}
          >
             <div className="absolute -top-4 -right-4 p-6 opacity-5 rotate-12">
                 <MessageSquare size={150} />
             </div>
             
             <div className="flex flex-col h-full relative z-10">
                 <h3 className="text-2xl font-display font-bold text-black mb-2">Human-Like</h3>
                 <p className="text-gray-500 text-sm font-medium mb-6">Pauses, filler words, and natural intonation.</p>
                 
                 {/* Chat Transcript Animation */}
                 <div className="bg-surface-50 border border-gray-200 rounded-xl p-5 flex-1 flex flex-col justify-center space-y-4 shadow-inner relative overflow-hidden">
                    {/* Background lines */}
                    <div className="absolute inset-0 bg-[linear-gradient(transparent_19px,#e5e7eb_20px)] bg-[length:100%_20px] opacity-30"></div>

                    <motion.div 
                        initial={{ opacity: 0, x: -10 }}
                        animate={viewTrigger ? { opacity: 1, x: 0 } : {}}
                        transition={{ delay: 0.5 }}
                        className="bg-white border border-gray-200 self-start rounded-2xl rounded-tl-none px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm max-w-[80%] relative z-10"
                    >
                        Can you come by Tuesday?
                    </motion.div>
                    
                    <motion.div 
                        initial={{ opacity: 0, x: 10 }}
                        animate={viewTrigger ? { opacity: 1, x: 0 } : {}}
                        transition={{ delay: 1.5 }}
                        className="bg-brand-500 text-white self-end rounded-2xl rounded-tr-none px-4 py-2.5 text-sm font-medium shadow-[2px_2px_0px_0px_rgba(0,0,0,0.2)] max-w-[80%] relative z-10"
                    >
                        {viewTrigger ? <Typewriter text="For sure, we can do that. Morning or afternoon?" delay={1600} /> : ""}
                    </motion.div>
                 </div>
             </div>
          </motion.div>

          {/* Card 3: Summaries (Standard) - Animated Push Notification */}
          <motion.div 
            className={`${cardBase}`}
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            onViewportEnter={() => setNotificationTrigger(true)}
          >
             <div className="flex flex-col h-full">
                 <div className="mb-4">
                     <div className="w-10 h-10 bg-black text-white flex items-center justify-center mb-4 shadow-[3px_3px_0px_0px_#ff4500]">
                        <Bell size={20} />
                    </div>
                     <h3 className="text-2xl font-display font-bold text-black">Summaries</h3>
                     <p className="text-gray-500 text-xs font-medium mt-2">Instant SMS notification with extracted details.</p>
                 </div>
                 
                 {/* Notification Animation */}
                 <div className="flex-1 relative bg-gray-200 rounded-lg overflow-hidden border border-gray-300 mt-2 min-h-[140px]">
                     {/* Phone Wallpaper simulation */}
                     <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/diagmonds-light.png')] opacity-50"></div>
                     
                     {/* Push Notification */}
                     <motion.div
                        initial={{ y: -100, opacity: 0 }}
                        animate={notificationTrigger ? { y: 12, opacity: 1 } : { y: -100, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 150, damping: 18, delay: 0.5 }}
                        className="mx-3 bg-white/95 backdrop-blur-md p-3 rounded-xl shadow-lg border border-gray-100 z-10 relative"
                     >
                        <div className="flex items-center justify-between mb-1.5">
                             <div className="flex items-center gap-1.5">
                                 <div className="w-5 h-5 bg-black rounded-md flex items-center justify-center">
                                     <span className="text-[8px] text-white font-bold font-display">AI</span>
                                 </div>
                                 <span className="text-[10px] font-bold text-gray-800 uppercase tracking-wide">FLYNN AI</span>
                             </div>
                             <span className="text-[9px] text-gray-400">now</span>
                        </div>
                        <p className="text-[11px] font-bold text-black leading-tight">New Lead: John (Plumbing)</p>
                        <p className="text-[10px] text-gray-600 leading-tight mt-1">Leak in kitchen. Urgent. 123 Main St.</p>
                     </motion.div>
                 </div>
             </div>
          </motion.div>

          {/* Card 4: 24/7 Active (Standard) */}
           <motion.div 
            className={`${cardBase}`}
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
          >
             <div className="flex flex-col h-full justify-between">
                 <div>
                    <div className="w-10 h-10 bg-white border-2 border-black text-black flex items-center justify-center mb-4">
                        <Clock size={20} />
                    </div>
                    <h3 className="text-2xl font-display font-bold text-black mb-2">24/7 Active</h3>
                    <p className="text-gray-600 text-sm font-medium">Nights, weekends, holidays. Flynn never sleeps and never charges overtime.</p>
                 </div>
                 <div className="mt-6 flex justify-center items-center flex-1">
                     <div className="relative w-28 h-28">
                         <div className="absolute inset-0 border-4 border-gray-100 rounded-full"></div>
                         <motion.div 
                            className="absolute inset-0 border-4 border-brand-500 border-t-transparent rounded-full"
                            animate={{ rotate: 360 }}
                            transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
                         ></motion.div>
                         <div className="absolute inset-0 flex flex-col items-center justify-center">
                             <span className="font-display font-bold text-xl">365</span>
                             <span className="text-[10px] uppercase font-bold text-gray-400 tracking-widest">Days</span>
                         </div>
                     </div>
                 </div>
             </div>
          </motion.div>

        </div>
      </div>
    </section>
  );
};

export default Features;