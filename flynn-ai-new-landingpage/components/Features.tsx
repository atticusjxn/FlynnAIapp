import React from 'react';
import { motion } from 'framer-motion';
import { Phone, Calendar, Camera, DollarSign, FileText, Brain, Keyboard, Link2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import StoreButtons from './StoreButtons';

/* ------------------------------------------------------------------ *
 * Features page — same system as LandingPage.tsx (cream/ink/orange,
 * mid-century cartoon, Space Grotesk + Inter). Previously described a
 * retired product ("Inbound Revenue OS", switchable call-handling
 * modes, the iOS Shortcuts screenshot pipeline) that no longer exists
 * in the codebase. Rewritten to the current AI-receptionist product.
 * ------------------------------------------------------------------ */

const Mascot = ({ pose, className = '' }: { pose: string; className?: string }) => (
  <img src={`/mascots/${pose}.png`} alt="" aria-hidden="true"
    className={`select-none pointer-events-none ${className}`} draggable={false} />
);

const Reveal = ({ children, delay = 0, className = '' }: any) => (
  <motion.div initial={{ opacity: 0, y: 26 }} whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
    className={className}>{children}</motion.div>
);

const Card = ({ children, className = '' }: any) => (
  <div className={`bg-[#FFFBF4] border-[3px] border-[#2C2018] rounded-3xl shadow-[6px_6px_0_0_#2C2018] ${className}`}>{children}</div>
);

const SectionLabel = ({ children }: any) => (
  <span className="inline-block font-display font-bold text-[13px] tracking-[0.18em] uppercase text-[#FB5B1E] mb-4">{children}</span>
);

const features = [
  { icon: Phone, tint: '#E0A436', title: 'Answers your calls', body: "Sounds like a real person, asks the right questions, and books the job straight into your calendar when you can't pick up." },
  { icon: Calendar, tint: '#3C8A86', title: 'Booked, not just noted', body: 'No back-and-forth. The job lands in your calendar with the address, time and what they actually need.' },
  { icon: Camera, tint: '#C5532B', title: 'Photo invoices', body: 'Snap the job in the app and Flynn sends a proper invoice with the photos on it and a pay link.' },
  { icon: DollarSign, tint: '#7E8B4F', title: 'Chases it for you', body: "Flags a late invoice and sends the reminder so you're not the one sending awkward follow-ups." },
  { icon: FileText, tint: '#FB5B1E', title: 'Quotes on the spot', body: 'Talk the job through and Flynn writes it up, prices it off your rates, before you leave site.' },
  { icon: Brain, tint: '#3C8A86', title: 'Learns your business', body: 'Tell Flynn your trade, prices and hours once, out loud. Every reply after that uses them.' },
  { icon: Keyboard, tint: '#E0A436', title: 'Drafts inside any app', body: 'The Flynn keyboard drafts a reply with a payment link right inside iMessage, WhatsApp or email. Tap to insert.' },
  { icon: Link2, tint: '#C5532B', title: 'Syncs with your tools', body: 'Xero, Google Calendar and your email, connected once and kept in sync automatically.' },
];

const Features = () => {
  const navigate = useNavigate();

  return (
    <div className="bg-[#F4E6CE] text-[#2C2018] overflow-hidden pt-20">
      {/* Hero */}
      <section className="relative py-20 sm:py-28">
        <span className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-[#3C8A86] border-[3px] border-[#2C2018] opacity-80" />
        <span className="absolute top-1/3 -left-20 w-40 h-40 rounded-full bg-[#E0A436] border-[3px] border-[#2C2018] opacity-70" />
        <div className="relative max-w-5xl mx-auto px-5 sm:px-8 text-center">
          <Reveal>
            <SectionLabel>Everything Flynn does</SectionLabel>
            <h1 className="font-display font-bold leading-[0.98] text-[clamp(2.6rem,7vw,4.4rem)] tracking-tight">
              Your receptionist,<br />your admin, <span className="text-[#FB5B1E]">one app.</span>
            </h1>
            <p className="mt-6 text-lg sm:text-xl text-[#5A4A3C] max-w-2xl mx-auto leading-relaxed">
              Flynn answers when you can't, books the job, and gets you paid, then keeps chasing
              until the money lands. No forms, mostly no typing.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Feature grid */}
      <section className="relative py-10 sm:py-16">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {features.map((f, i) => (
            <Reveal key={f.title} delay={(i % 4) * 0.06}>
              <Card className="p-6 h-full">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center mb-5 border-[3px] border-[#2C2018]"
                  style={{ backgroundColor: f.tint }}
                >
                  <f.icon size={22} className="text-[#FFFBF4]" strokeWidth={2.5} />
                </div>
                <h3 className="font-display font-bold text-lg mb-2">{f.title}</h3>
                <p className="text-[#5A4A3C] text-[15px] leading-relaxed">{f.body}</p>
              </Card>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Keyboard callout */}
      <section className="py-10">
        <div className="max-w-4xl mx-auto px-5 sm:px-8">
          <Card className="p-8 sm:p-10 flex flex-col sm:flex-row items-center gap-8">
            <Mascot pose="phone" className="w-28 sm:w-36 flex-shrink-0" />
            <div>
              <h3 className="font-display font-bold text-2xl mb-2">Also included: the Flynn keyboard</h3>
              <p className="text-[#5A4A3C] leading-relaxed">
                Draft a tone-matched reply with a payment link right inside any messaging app —
                iMessage, WhatsApp, email, HiPages, Airtasker. Tap to insert. Nothing sends on its own.
              </p>
            </div>
          </Card>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 sm:py-28 text-center">
        <div className="max-w-3xl mx-auto px-5 sm:px-8">
          <Reveal>
            <h2 className="font-display font-bold text-[clamp(2rem,5vw,3.2rem)] leading-tight mb-6">
              Get it for free. <span className="text-[#FB5B1E]">Start today.</span>
            </h2>
            <div className="flex justify-center">
              <StoreButtons variant="dock" />
            </div>
            <button
              onClick={() => navigate('/')}
              className="mt-8 text-sm font-semibold text-[#5A4A3C] hover:text-[#FB5B1E] transition-colors underline decoration-[#5A4A3C]/30"
            >
              Back to home
            </button>
          </Reveal>
        </div>
      </section>
    </div>
  );
};

export default Features;
