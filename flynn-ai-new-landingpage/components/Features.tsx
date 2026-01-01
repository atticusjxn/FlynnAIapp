import React, { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Phone, MessageSquare, Mic, Calendar, FileText, Camera, Upload, Layers, ShieldCheck, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const FeatureCard = ({ icon: Icon, title, description, color }: any) => {
  return (
    <div className="bg-white border-2 border-black p-8 relative group hover:-translate-y-2 hover:shadow-[8px_8px_0px_0px_#000000] transition-all duration-300">
      <div className={`w-14 h-14 ${color} rounded-full flex items-center justify-center mb-6 border-2 border-black group-hover:scale-110 transition-transform`}>
        <Icon size={28} className="text-black" />
      </div>
      <h3 className="text-2xl font-bold font-display mb-4">{title}</h3>
      <p className="text-gray-600 leading-relaxed group-hover:text-black transition-colors">
        {description}
      </p>
    </div>
  );
};

const Features = () => {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"]
  });

  return (
    <div className="bg-[#f3f4f6] min-h-screen pt-20" ref={containerRef}>

      {/* Hero Section */}
      <section className="py-24 px-4 bg-black text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-brand-500 rounded-full blur-[120px] opacity-20 translate-x-1/2 -translate-y-1/2"></div>

        <div className="max-w-7xl mx-auto relative z-10 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <div className="inline-block bg-brand-500 text-white px-4 py-1.5 text-sm font-bold uppercase tracking-widest mb-6 border-2 border-white">
              Inbound Revenue OS
            </div>
            <h1 className="text-6xl md:text-8xl font-bold font-display tracking-tighter mb-8 leading-none">
              More Than Just <br /> <span className="text-brand-500">Call Forwarding.</span>
            </h1>
            <p className="text-xl md:text-2xl text-gray-400 max-w-3xl mx-auto leading-relaxed">
              Flynn is a complete inbound lead management platform. From missed calls to booked jobs, we handle the busy work so you can focus on the trade.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Core Modes Section */}
      <section className="py-32 px-4 max-w-7xl mx-auto">
        <div className="mb-16">
          <h2 className="text-4xl md:text-5xl font-bold font-display mb-6">Call Handling Modes</h2>
          <p className="text-xl text-gray-600 max-w-2xl">Switch between three powerful modes depending on your business needs. Flynn adapts to you.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          <div className="bg-brand-500 p-8 border-4 border-black shadow-[12px_12px_0px_0px_#000000]">
            <div className="bg-white inline-flex p-3 border-2 border-black mb-6">
              <MessageSquare size={32} />
            </div>
            <h3 className="text-3xl font-bold font-display mb-4">SMS Link Follow-Up</h3>
            <div className="inline-block bg-black text-white text-xs font-bold px-2 py-1 uppercase mb-4">Default Mode</div>
            <p className="font-medium text-black/80 mb-6 border-l-2 border-black pl-4">
              The core Flynn experience. Simple, reliable, and conversion-focused.
            </p>
            <ul className="space-y-3 font-medium">
              <li className="flex items-start gap-2"><div className="mt-1.5 w-1.5 h-1.5 bg-black rounded-full" /> Caller presses 1 for Booking Link</li>
              <li className="flex items-start gap-2"><div className="mt-1.5 w-1.5 h-1.5 bg-black rounded-full" /> Caller presses 2 for Quote Form</li>
              <li className="flex items-start gap-2"><div className="mt-1.5 w-1.5 h-1.5 bg-black rounded-full" /> Instant SMS delivery</li>
              <li className="flex items-start gap-2"><div className="mt-1.5 w-1.5 h-1.5 bg-black rounded-full" /> No AI config required</li>
            </ul>
          </div>

          <div className="bg-white p-8 border-2 border-gray-200 hover:border-black hover:shadow-[8px_8px_0px_0px_#000000] transition-all">
            <div className="bg-gray-100 inline-flex p-3 rounded-lg mb-6">
              <Mic size={32} />
            </div>
            <h3 className="text-2xl font-bold font-display mb-4">AI Receptionist</h3>
            <div className="inline-block bg-brand-100 text-brand-900 text-xs font-bold px-2 py-1 uppercase mb-4">Premium</div>
            <p className="text-gray-600 mb-6">
              Full conversational AI that sounds human. Handles complex queries and qualifies leads.
            </p>
            <ul className="space-y-3 text-gray-600">
              <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-gray-400 rounded-full" /> Customizable Voice Profiles</li>
              <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-gray-400 rounded-full" /> Gathers Job Details</li>
              <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-gray-400 rounded-full" /> AI-Drafted Follow-ups</li>
            </ul>
          </div>

          <div className="bg-white p-8 border-2 border-gray-200 hover:border-black hover:shadow-[8px_8px_0px_0px_#000000] transition-all">
            <div className="bg-gray-100 inline-flex p-3 rounded-lg mb-6">
              <Layers size={32} />
            </div>
            <h3 className="text-2xl font-bold font-display mb-4">Voicemail Capture</h3>
            <div className="inline-block bg-gray-200 text-gray-800 text-xs font-bold px-2 py-1 uppercase mb-4">Basic</div>
            <p className="text-gray-600 mb-6">
              Classic voicemail with a modern twist. All voicemails are transcribed and processed.
            </p>
            <ul className="space-y-3 text-gray-600">
              <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-gray-400 rounded-full" /> Transcription to Text</li>
              <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-gray-400 rounded-full" /> Job Card Creation</li>
              <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-gray-400 rounded-full" /> Simple fallback mode</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Feature Grid */}
      <section className="py-24 bg-white border-y-2 border-black">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-20">
            <h2 className="text-4xl font-bold font-display mb-4">Everything You Need to Win Work</h2>
            <p className="text-xl text-gray-500">Built for trades, beauty pros, and service businesses.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard
              icon={Calendar}
              title="Smart Booking Pages"
              description="Shareable links that sync with Google, Apple, and Outlook. Let clients book time without the back-and-forth."
              color="bg-blue-100"
            />
            <FeatureCard
              icon={FileText}
              title="Quote Intake Forms"
              description="Collect job details, photos, and contact info via a simple SMS link sent automatically to callers."
              color="bg-green-100"
            />
            <FeatureCard
              icon={Camera}
              title="Screenshot to Job"
              description="Upload screenshots of text conversations. Flynn's AI extracts the details and creates a job card instantly."
              color="bg-yellow-100"
            />
            <FeatureCard
              icon={Zap}
              title="iOS Shortcuts"
              description="Control Center shortcut for instant screenshot processing on your iPhone. Speed is everything."
              color="bg-purple-100"
            />
            <FeatureCard
              icon={ShieldCheck}
              title="Job Confirmations"
              description="Automatically send SMS confirmations to clients to reduce no-shows and keep everyone in the loop."
              color="bg-red-100"
            />
            <FeatureCard
              icon={Upload}
              title="Integrations (Soon)"
              description="Connect with MYOB, QuickBooks, and Xero. Seamlessly sync job data for invoicing."
              color="bg-gray-100"
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-32 bg-[#f3f4f6] text-center">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-5xl md:text-7xl font-bold font-display mb-8">Ready to Automate?</h2>
          <p className="text-xl text-gray-600 mb-12 max-w-2xl mx-auto">
            Stop missing leads and start closing more jobs with Flynn. Try the Inbound Revenue OS today.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-6">
            <button onClick={() => navigate('/trial')} className="bg-brand-500 text-white px-12 py-5 text-xl font-bold uppercase tracking-widest border-4 border-black shadow-[8px_8px_0px_0px_#000000] hover:shadow-none hover:translate-x-[4px] hover:translate-y-[4px] transition-all">
              Start Free Trial
            </button>
            <button onClick={() => navigate('/how-it-works')} className="bg-white text-black px-12 py-5 text-xl font-bold uppercase tracking-widest border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,0.1)] hover:bg-black hover:text-white transition-all">
              How It Works
            </button>
          </div>
        </div>
      </section>

    </div>
  );
};

export default Features;