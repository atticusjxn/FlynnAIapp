import React, { useRef, useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Features from './components/Features';
import DemoChat from './components/DemoChat';
import Pricing from './components/Pricing';

import Footer from './components/Footer';
import StoreButtons from './components/StoreButtons';
import { ArrowRight, Star, PlayCircle, RefreshCcw, Loader } from 'lucide-react';
import { motion, useScroll, useTransform, useSpring } from 'framer-motion';
import { generateClientImage } from './services/geminiService';

const ClientGenerator = () => {
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [profession, setProfession] = useState('Plumber');

  const handleGenerate = async () => {
    setLoading(true);
    const professions = ['Electrician', 'Florist', 'Carpenter', 'Baker', 'Mechanic', 'Landscaper', 'Barber', 'Chef'];
    const randomProf = professions[Math.floor(Math.random() * professions.length)];
    setProfession(randomProf);

    const imgUrl = await generateClientImage(randomProf);
    if (imgUrl) setImage(imgUrl);
    setLoading(false);
  };

  // Generate one on mount if possible, but let's rely on user interaction to save resources initially
  // or trigger one automatically once to show off.
  useEffect(() => {
    // Initial generation for effect
    handleGenerate();
  }, []);

  return (
    <div className="relative w-full max-w-md aspect-[4/5] bg-white border-[6px] border-black shadow-[12px_12px_0px_0px_#000000] overflow-hidden group">
      {loading ? (
        <div className="absolute inset-0 flex items-center justify-center bg-surface-100">
          <div className="flex flex-col items-center gap-4">
            <Loader className="animate-spin text-brand-500 w-10 h-10" />
            <span className="font-display font-bold uppercase tracking-widest text-sm">Visualizing {profession}...</span>
          </div>
        </div>
      ) : image ? (
        <img src={image} alt="Generated Client" className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700" />
      ) : (
        <div className="w-full h-full bg-gray-200 flex items-center justify-center">
          <span className="text-gray-400">AI Generation Ready</span>
        </div>
      )}

      <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent">
        <div className="flex justify-between items-end">
          <div>
            <p className="text-white/60 text-xs font-mono uppercase mb-1">Generated with Gemini 2.5 Flash Image</p>
            <p className="text-white font-display font-bold text-xl">The Happy {profession}</p>
          </div>
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="bg-brand-500 text-white p-3 rounded-full hover:scale-110 transition-transform disabled:opacity-50"
          >
            <RefreshCcw size={20} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>
    </div>
  );
}

function App() {
  const { scrollY } = useScroll();
  const y1 = useTransform(scrollY, [0, 1000], [0, 200]);
  const rotate = useTransform(scrollY, [0, 1000], [0, 10]);
  const springConfig = { stiffness: 100, damping: 30, restDelta: 0.001 };
  const scale = useSpring(useTransform(scrollY, [0, 300], [1, 1.1]), springConfig);

  return (
    <div className="min-h-screen bg-[#f3f4f6] font-sans selection:bg-brand-500 selection:text-white overflow-hidden">
      <Navbar />

      {/* Surreal Hero Section */}
      <main className="relative pt-32 pb-32 lg:pt-48 overflow-hidden">

        {/* Background Shapes */}
        <motion.div style={{ y: y1, rotate }} className="absolute top-0 right-0 w-[800px] h-[800px] bg-white border-2 border-gray-200 rounded-full -z-10 opacity-50 translate-x-1/2 -translate-y-1/4"></motion.div>
        <div className="absolute top-1/3 left-0 w-[400px] h-[400px] bg-brand-500/5 rounded-full blur-3xl -z-10"></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center relative z-10">

            {/* Hero Content */}
            <div className="relative">
              <motion.div
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              >
                <div className="inline-block bg-black text-white px-4 py-1.5 text-sm font-bold uppercase tracking-widest mb-8 transform -rotate-2">
                  AI Receptionist v2.0
                </div>

                <h1 className="text-7xl lg:text-[7rem] leading-[0.9] font-bold text-black font-display mb-8 tracking-tighter">
                  DON'T <br />
                  MISS <br />
                  <span className="text-brand-500 italic pl-4">THE CALL.</span>
                </h1>

                <p className="text-xl text-gray-600 mb-10 max-w-md font-medium leading-relaxed border-l-4 border-brand-500 pl-6">
                  Flynn is the hyper-intelligent receptionist that lives in your pocket. It books jobs while you work.
                </p>

                <StoreButtons />
              </motion.div>

            </div>

            {/* Hero Visual / Demo */}
            <motion.div
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 1, delay: 0.2 }}
              className="relative flex justify-center lg:justify-end"
            >
              {/* Decorative Elements */}
              <div className="absolute -top-20 right-20 text-[12rem] font-display font-bold text-gray-100 -z-10 select-none">AI</div>

              {/* 3D Demo Chat Component */}
              <DemoChat />

            </motion.div>

          </div>
        </div>
      </main >

      {/* Generated Imagery Section */}
      < section className="py-24 bg-black text-white overflow-hidden relative" >
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <motion.h2
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                className="text-5xl md:text-6xl font-display font-bold mb-8 leading-tight"
              >
                The New Face of <br />
                <span className="text-brand-500">Business.</span>
              </motion.h2>
              <p className="text-gray-400 text-lg mb-8 max-w-md">
                From florists to electricians, Flynn empowers every business owner. See our community of happy professionals.
              </p>
              <div className="flex gap-4">
                <div className="w-full h-[1px] bg-white/20 my-auto"></div>
                <span className="whitespace-nowrap font-mono text-xs text-brand-500 uppercase">Live Generation</span>
              </div>
            </div>

            <div className="flex justify-center lg:justify-end">
              <ClientGenerator />
            </div>
          </div>
        </div>
      </section >

      <Features />

      {/* How it works - Brutalist Steps */}
      <section id="how-it-works" className="py-32 bg-white border-t-2 border-black">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-20">
            <h2 className="text-5xl font-bold text-black font-display uppercase">Workflow</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-0 border-l-2 border-black">
            {[
              { step: "01", title: "Forward", desc: "Set up call forwarding on your mobile. Takes 30 seconds." },
              { step: "02", title: "Screen", desc: "Flynn answers, filters spam, and captures job details." },
              { step: "03", title: "Profit", desc: "Receive a clean job card. Quote and book instantly." }
            ].map((item, idx) => (
              <div key={idx} className="group border-r-2 border-b-2 border-black p-10 hover:bg-brand-500 hover:text-white transition-colors duration-300 relative">
                <span className="absolute top-6 right-6 font-display font-bold text-6xl opacity-10 group-hover:opacity-20">{item.step}</span>
                <h3 className="text-3xl font-bold mb-4 font-display">{item.title}</h3>
                <p className="text-gray-500 group-hover:text-white/90 font-medium max-w-xs">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Pricing />

      {/* CTA Section */}
      <section className="py-32 bg-brand-500 relative overflow-hidden">
        {/* Giant Text Background */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[15vw] font-bold text-black opacity-5 whitespace-nowrap font-display select-none">
          FLYNN AI
        </div>

        <div className="max-w-4xl mx-auto px-4 relative z-10 text-center">
          <h2 className="text-5xl md:text-7xl font-bold text-white font-display mb-8 tracking-tight">
            Take your life back.
          </h2>
          <p className="text-xl text-black/60 mb-12 max-w-xl mx-auto font-medium">
            Join the revolution. No more missed calls. No more voicemail tag.
          </p>
          <button className="bg-black text-white hover:bg-white hover:text-black px-12 py-6 text-xl font-bold uppercase tracking-widest border-4 border-black shadow-[8px_8px_0px_0px_rgba(255,255,255,0.3)] transition-all hover:shadow-none hover:translate-x-[4px] hover:translate-y-[4px]">
            Start 14-Day Trial
          </button>
        </div>
      </section>

      <Footer />
    </div >
  );
}

export default App;