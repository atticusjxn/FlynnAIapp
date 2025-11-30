import React, { useState, useEffect, useRef } from 'react';
import { Send, User, Battery, Signal, Wifi, Sparkles, Phone, ChevronRight, ChevronLeft, Wrench, Flower, Home } from 'lucide-react';
import { motion, useMotionValue, useTransform, useSpring, AnimatePresence } from 'framer-motion';

// --- Types for our Scripted Scenarios ---
type Message = {
  role: 'user' | 'model';
  text: string;
};

type Scenario = {
  id: string;
  companyName: string;
  companyColor: string;
  icon: React.ElementType;
  messages: Message[];
  leadCard: {
    name: string;
    time: string;
    summary: string;
    tag: string; // e.g. URGENT, HIGH VALUE
    tagColor: string;
  };
};

const SCENARIOS: Scenario[] = [
  {
    id: 'plumber',
    companyName: 'Premier Plumbing',
    companyColor: '#ef4444', // Red-500
    icon: Wrench,
    messages: [
      { role: 'user', text: "Hi, I have a pipe bursting in my basement!" },
      { role: 'model', text: "I can help with that immediately. What is your address?" },
      { role: 'user', text: "123 Main St. Please hurry." },
      { role: 'model', text: "Got it. I'm marking this as urgent and dispatching someone now." }
    ],
    leadCard: {
      name: "Mike T.",
      time: "Just now",
      summary: "Burst pipe in basement. 123 Main St.",
      tag: "URGENT",
      tagColor: "bg-red-500"
    }
  },
  {
    id: 'florist',
    companyName: 'Rose Petal Florist',
    companyColor: '#ec4899', // Pink-500
    icon: Flower,
    messages: [
      { role: 'user', text: "I need 20 bouquets for a wedding this Saturday." },
      { role: 'model', text: "That sounds lovely! What color scheme are you looking for?" },
      { role: 'user', text: "White and Sage Green. Can you do it?" },
      { role: 'model', text: "Absolutely. I've noted the colors and date. I'll send a quote shortly." }
    ],
    leadCard: {
      name: "Sarah J.",
      time: "2 mins ago",
      summary: "Wedding Order: 20x Bouquets (White/Sage). Due Sat.",
      tag: "HIGH VALUE",
      tagColor: "bg-pink-500"
    }
  },
  {
    id: 'realestate',
    companyName: 'Luxe Realty',
    companyColor: '#000000', // Black
    icon: Home,
    messages: [
      { role: 'user', text: "I saw the listing on Oak St. Is it available to view?" },
      { role: 'model', text: "Yes, it is. Are you free this afternoon around 4 PM?" },
      { role: 'user', text: "4 PM works perfectly." },
      { role: 'model', text: "Great. I've booked you in for 4 PM at Oak St. See you there." }
    ],
    leadCard: {
      name: "David B.",
      time: "5 mins ago",
      summary: "Viewing confirmed: Oak St Listing @ 4:00 PM.",
      tag: "BOOKING",
      tagColor: "bg-black"
    }
  }
];

const DemoChat: React.FC = () => {
  const [currentScenarioIndex, setCurrentScenarioIndex] = useState(0);
  const [displayedMessages, setDisplayedMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [showLeadCard, setShowLeadCard] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const currentScenario = SCENARIOS[currentScenarioIndex];

  // --- Animation Sequencer ---
  useEffect(() => {
    let timeoutIds: ReturnType<typeof setTimeout>[] = [];

    // Reset state for new scenario
    setDisplayedMessages([]);
    setShowLeadCard(false);
    setIsTyping(false);

    let cummulativeTime = 500; // Start delay

    // Loop through messages to schedule them
    currentScenario.messages.forEach((msg, index) => {
      // Time for user to "type" or AI to "think"
      const typingDuration = 1000;
      const readingTime = 1500;

      // 1. Start Typing Animation (if it's AI) or just delay for user
      timeoutIds.push(setTimeout(() => {
        if (msg.role === 'model') setIsTyping(true);
      }, cummulativeTime));

      // 2. Show Message
      cummulativeTime += typingDuration;
      timeoutIds.push(setTimeout(() => {
        setIsTyping(false);
        setDisplayedMessages(prev => [...prev, msg]);
      }, cummulativeTime));

      // 3. Add reading time before next message
      cummulativeTime += readingTime;
    });

    // 4. Show Lead Card after conversation
    timeoutIds.push(setTimeout(() => {
      setShowLeadCard(true);
    }, cummulativeTime - 500)); // Pop up slightly before full finish feels snappier

    // 5. Transition to next scenario
    const endOfSceneTime = cummulativeTime + 4000; // Hold for 4 seconds
    timeoutIds.push(setTimeout(() => {
      nextScenario();
    }, endOfSceneTime));

    return () => {
      timeoutIds.forEach(clearTimeout);
    };
  }, [currentScenarioIndex]);

  const nextScenario = () => {
    setCurrentScenarioIndex(prev => (prev + 1) % SCENARIOS.length);
  };

  const prevScenario = () => {
    setCurrentScenarioIndex(prev => (prev - 1 + SCENARIOS.length) % SCENARIOS.length);
  };

  // Auto-scroll logic using scrollTop instead of scrollIntoView
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [displayedMessages, isTyping]);


  // --- 3D Physics Logic ---
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const mouseX = useSpring(x, { stiffness: 300, damping: 30 });
  const mouseY = useSpring(y, { stiffness: 300, damping: 30 });
  const rotateX = useTransform(mouseY, [-0.5, 0.5], ["10deg", "-10deg"]);
  const rotateY = useTransform(mouseX, [-0.5, 0.5], ["-10deg", "10deg"]);
  const contentX = useTransform(mouseX, [-0.5, 0.5], ["-8px", "8px"]);
  const contentY = useTransform(mouseY, [-0.5, 0.5], ["-8px", "8px"]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const xPct = (e.clientX - rect.left) / rect.width - 0.5;
    const yPct = (e.clientY - rect.top) / rect.height - 0.5;
    x.set(xPct);
    y.set(yPct);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <div className="flex flex-col items-center gap-8">
      <div
        className="relative w-full h-[700px] flex items-center justify-center perspective-container"
        style={{ perspective: '1200px' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <motion.div
          style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
          className="relative w-[340px] h-[680px] bg-surface-50 rounded-[3.5rem] shadow-[25px_25px_50px_-12px_rgba(0,0,0,0.25)] border-[8px] border-black flex flex-col overflow-hidden z-10"
        >
          {/* Reflections */}
          <div className="absolute inset-0 rounded-[3rem] bg-gradient-to-tr from-white/40 to-transparent pointer-events-none z-50 opacity-40"></div>

          {/* --- 3D Pop-out Lead Card --- */}
          <AnimatePresence mode='wait'>
            {showLeadCard && (
              <motion.div
                key={currentScenario.id}
                style={{ transform: "translateZ(80px)", x: contentX, y: contentY }}
                initial={{ opacity: 0, scale: 0.8, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.2 } }}
                transition={{ type: "spring", stiffness: 200, damping: 15 }}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white border-2 border-black p-4 w-64 shadow-[10px_10px_0px_0px_rgba(0,0,0,0.15)] z-[60] rounded-xl hidden md:block"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className={`text-[10px] font-bold uppercase tracking-wider text-white px-2 py-0.5 rounded-full ${currentScenario.leadCard.tagColor}`}>
                    {currentScenario.leadCard.tag}
                  </span>
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-ping"></div>
                </div>
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center border border-black flex-shrink-0">
                    <User size={18} />
                  </div>
                  <div>
                    <p className="font-bold text-base leading-tight">{currentScenario.leadCard.name}</p>
                    <p className="text-[10px] text-gray-500 font-medium mt-0.5">{currentScenario.leadCard.time}</p>
                  </div>
                </div>
                <div className="bg-surface-50 p-2 rounded-lg border border-gray-200">
                  <p className="text-xs text-gray-700 font-medium leading-relaxed">
                    "{currentScenario.leadCard.summary}"
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* --- PHONE INTERFACE --- */}

          {/* Status Bar */}
          <div className="h-14 bg-surface-50 absolute top-0 w-full z-20 flex justify-between items-center px-8 pt-4">
            <span className="text-xs font-bold text-black">9:41</span>
            {/* Dynamic Island */}
            <div className="h-8 w-28 bg-black rounded-full flex items-center justify-center gap-1.5 px-2 shadow-sm transition-all duration-300" style={{ width: isTyping ? '140px' : '112px' }}>
              {isTyping ? (
                <>
                  <span className="text-[8px] text-white font-bold animate-pulse">AI PROCESSING</span>
                  <Sparkles size={10} className="text-brand-500 animate-spin" />
                </>
              ) : (
                <div className="flex gap-1">
                  <div className="w-1 h-1 rounded-full bg-gray-600"></div>
                  <div className="w-1 h-1 rounded-full bg-gray-600"></div>
                </div>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-black">
              <Signal size={14} strokeWidth={3} />
              <Wifi size={14} strokeWidth={3} />
              <Battery size={16} strokeWidth={3} />
            </div>
          </div>

          {/* App Header (Dynamic per Industry) */}
          <motion.div
            key={currentScenario.id}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.3 }}
            className="bg-surface-50/90 backdrop-blur-md mt-14 px-6 pb-4 border-b border-black/5 flex items-center justify-between z-10 relative"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,0.1)]" style={{ backgroundColor: currentScenario.companyColor }}>
                <currentScenario.icon size={20} className="text-white" />
              </div>
              <div>
                <h3 className="text-black font-display font-bold text-md leading-none">{currentScenario.companyName}</h3>
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Flynn Active</span>
              </div>
            </div>
            <div className="bg-white p-2 rounded-full border border-black/10 shadow-sm">
              <Phone size={16} className="text-black" fill="black" />
            </div>
          </motion.div>

          {/* Chat Area */}
          <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 space-y-6 bg-surface-50 relative scrollbar-hide">
            {/* Dot Pattern */}
            <div className="absolute inset-0 bg-[radial-gradient(#000000_1px,transparent_1px)] [background-size:16px_16px] opacity-[0.03] pointer-events-none"></div>

            <div className="text-center py-4 relative z-10">
              <span className="text-[10px] bg-black/5 px-3 py-1 rounded-full text-black/40 font-bold uppercase tracking-widest">Today</span>
            </div>

            <AnimatePresence mode='popLayout'>
              {displayedMessages.map((msg, idx) => (
                <motion.div
                  key={`${currentScenario.id}-${idx}`} // Unique key ensures full re-render on switch
                  layout
                  initial={{ opacity: 0, x: msg.role === 'user' ? 20 : -20, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, x: 0, scale: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} relative z-10`}
                >
                  <div
                    className={`max-w-[85%] p-3.5 text-sm font-medium leading-snug shadow-sm border-2 ${msg.role === 'user'
                        ? 'bg-black text-white rounded-2xl rounded-tr-none border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,0.15)]'
                        : 'bg-white text-black rounded-2xl rounded-tl-none border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,0.1)]'
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
                className="flex justify-start relative z-10"
              >
                <div className="bg-white p-4 rounded-2xl rounded-tl-none border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,0.1)] flex gap-1.5">
                  <span className="w-1.5 h-1.5 bg-black rounded-full animate-bounce"></span>
                  <span className="w-1.5 h-1.5 bg-black rounded-full animate-bounce delay-75"></span>
                  <span className="w-1.5 h-1.5 bg-black rounded-full animate-bounce delay-150"></span>
                </div>
              </motion.div>
            )}
            <div className="h-2" />
          </div>

          {/* Input Area */}
          <div className="p-4 bg-surface-50 z-20 border-t border-black/5 relative">
            <div className="flex items-center gap-2 bg-white border-2 border-black rounded-full px-2 py-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)]">
              <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                <span className="text-lg">✨</span>
              </div>
              <div className="flex-1 text-sm text-gray-300 font-medium italic pl-2">
                Flynn is active...
              </div>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center bg-gray-100 text-gray-400`}>
                <Send size={18} strokeWidth={2.5} />
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Manual Controls */}
      <div className="flex items-center gap-6">
        <button
          onClick={prevScenario}
          className="w-12 h-12 rounded-full border-2 border-black bg-white flex items-center justify-center hover:bg-black hover:text-white transition-all hover:-translate-y-1 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-y-1"
        >
          <ChevronLeft size={24} />
        </button>

        <div className="flex gap-2">
          {SCENARIOS.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setCurrentScenarioIndex(i)}
              className={`w-3 h-3 rounded-full border border-black transition-all ${currentScenarioIndex === i ? 'bg-brand-500 w-8' : 'bg-white hover:bg-gray-200'}`}
            />
          ))}
        </div>

        <button
          onClick={nextScenario}
          className="w-12 h-12 rounded-full border-2 border-black bg-white flex items-center justify-center hover:bg-black hover:text-white transition-all hover:-translate-y-1 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-y-1"
        >
          <ChevronRight size={24} />
        </button>
      </div>
    </div>
  );
};

export default DemoChat;