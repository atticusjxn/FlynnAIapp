import React, { useState } from 'react';
import { motion } from 'framer-motion';
import StoreButtons from './StoreButtons';
import PhoneSignupChat from './PhoneSignupChat';

/* ------------------------------------------------------------------ *
 * Flynn landing page — iMessage agent positioning.
 * Design: mid-century cartoon, cream + orange, Space Grotesk + Inter.
 * ------------------------------------------------------------------ */

const INK = '#2C2018';

const Mascot = ({ pose, className = '' }: { pose: string; className?: string }) => (
  <img src={`/mascots/${pose}.png`} alt="" aria-hidden="true"
    className={`select-none pointer-events-none ${className}`} draggable={false} />
);

const Reveal = ({ children, delay = 0, className = '' }: any) => (
  <motion.div initial={{ opacity: 0, y: 26 }} whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
    className={className}>{children}</motion.div>
);

const Motifs = ({ variant = 0 }: { variant?: number }) => {
  const sets = [
    <>
      <span className="absolute top-[-80px] right-[-80px] w-[160px] h-[160px] rounded-full bg-[#3C8A86] border-[3px] border-[#2C2018]" />
      <span className="absolute bottom-[-104px] right-[-104px] w-[208px] h-[208px] rounded-full bg-[#E0A436] border-[3px] border-[#2C2018]" />
      <span className="absolute bottom-[-28px] left-[-28px] w-[56px] h-[56px] rounded-full bg-[#FB5B1E] border-[3px] border-[#2C2018]" />
    </>,
    <>
      <span className="absolute top-[15%] right-[-88px] w-[176px] h-[176px] rounded-full bg-[#C5532B] border-[3px] border-[#2C2018]" />
      <span className="absolute bottom-[-112px] right-[-112px] w-[224px] h-[224px] rounded-full bg-[#7E8B4F] border-[3px] border-[#2C2018]" />
    </>,
    <>
      <span className="absolute top-[35%] left-[-120px] w-[240px] h-[240px] rounded-full bg-[#3C8A86] border-[3px] border-[#2C2018]" />
      <span className="absolute bottom-[-48px] right-[-48px] w-[96px] h-[96px] rounded-full bg-[#E0A436] border-[3px] border-[#2C2018]" />
    </>,
  ];
  return <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-75">{sets[variant % sets.length]}</div>;
};

const Starburst = ({ className = '' }: { className?: string }) => (
  <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
    {Array.from({ length: 12 }).map((_, i) => {
      const a = (i * Math.PI) / 6;
      return <line key={i} x1="50" y1="50" x2={50 + 46 * Math.cos(a)} y2={50 + 46 * Math.sin(a)}
        stroke="#C5532B" strokeWidth="6" strokeLinecap="round" />;
    })}
  </svg>
);

const AppleCalIcon = ({ className = 'w-12 h-12' }: { className?: string }) => (
  <svg viewBox="0 0 48 48" className={className} aria-label="Apple Calendar">
    <rect x="5" y="5" width="38" height="38" rx="9" fill="#fff" stroke="#E2E2E5" strokeWidth="1" />
    <text x="24" y="17" textAnchor="middle" fontFamily="Inter, sans-serif" fontWeight="700" fontSize="7.5" fill="#FF3B30" letterSpacing="0.5">WED</text>
    <text x="24" y="39" textAnchor="middle" fontFamily="Inter, sans-serif" fontWeight="600" fontSize="22" fill="#1D1D1F">12</text>
  </svg>
);

const GoogleCalIcon = ({ className = 'w-12 h-12' }: { className?: string }) => (
  <svg viewBox="0 0 48 48" className={className} aria-label="Google Calendar">
    <rect x="10" y="10" width="28" height="28" fill="#fff" />
    <path d="M38 14 V10 H34 Z" fill="#EA4335" />
    <path d="M10 14 V10 H14 V14 Z" fill="#1967D2" />
    <path d="M34 38 H38 V34 Z" fill="#188038" />
    <path d="M10 34 V38 H14 V34 Z" fill="#FBBC04" />
    <rect x="10" y="10" width="28" height="4" fill="#4285F4" />
    <rect x="10" y="10" width="4" height="28" fill="#1967D2" />
    <rect x="34" y="10" width="4" height="28" fill="#EA4335" />
    <rect x="10" y="34" width="28" height="4" fill="#34A853" />
    <rect x="14" y="14" width="20" height="20" fill="#fff" />
    <text x="24" y="31" textAnchor="middle" fontFamily="Space Grotesk, sans-serif" fontWeight="700" fontSize="14" fill="#4285F4">31</text>
  </svg>
);

const SectionLabel = ({ children }: any) => (
  <span className="inline-block font-display font-bold text-[13px] tracking-[0.18em] uppercase text-[#FB5B1E] mb-4">{children}</span>
);

const Card = ({ children, className = '' }: any) => (
  <div className={`bg-[#FFFBF4] border-[3px] border-[#2C2018] rounded-3xl shadow-[6px_6px_0_0_#2C2018] ${className}`}>{children}</div>
);

/* ===================== STEPS ===================== */
const steps = [
  { n: '1', pose: 'wave', title: 'Text your number above', body: "Enter your mobile and Flynn texts you straight away. Save the contact card that arrives — that's Flynn in your phone." },
  { n: '2', pose: 'write', title: 'Text what you need', body: "Draft a quote, send an invoice, chase a late payment, book a job. Just text it in plain English. No app to navigate." },
  { n: '3', pose: 'thumbsup', title: "Flynn handles it, you confirm", body: "Flynn does the work and checks in before anything moves. It also comes to you — flagging an overdue invoice or a rained-out job before you'd notice. Always in your control." },
];

/* ===================== FEATURES ===================== */
const features = [
  { pose: 'write', tint: '#3C8A86', title: 'Invoices with the photos on them', body: 'Text Flynn the job and a couple of before/after pics. It sends a proper invoice with the photos right on it, ready to forward.' },
  { pose: 'phone', tint: '#E0A436', title: 'Orders parts at the best price', body: 'Ask Flynn to order materials and it compares prices across suppliers first, so you get the same gear for less — then places the order once you say go.' },
  { pose: 'thinking', tint: '#C5532B', title: 'Catches what you\'d miss', body: 'Flynn is proactive. It chases your late payers and flags a job about to get rained out before you do, so problems get sorted before they cost you.' },
];

/* ===================== FAQ ===================== */
const faqs = [
  { q: 'How does Flynn work?', a: "Get your Flynn number from the app and save it as a contact on your phone. Then just text it what you need — order parts, draft a quote, send an invoice, book a job. Flynn handles it and confirms with you before anything moves." },
  { q: 'What can I ask Flynn to do?', a: "Send invoices with the job photos on them, chase late payers, compare supplier prices and order your parts, reschedule a job that's about to be rained out, draft quotes and replies in your voice, book jobs in your calendar, and file receipts to your accounting. And it's proactive — it flags the overdue invoice or the rained-out job before you do. If you'd normally stop and open a computer for it, Flynn handles it from a text." },
  { q: 'How do my clients pay me?', a: "Flynn sends your client an invoice with a pay link and the job photos on it, then chases it for you until it's paid — so you're not the one sending awkward follow-ups. Pay-by-bank is rolling out, so they'll soon be able to pay straight from their bank too." },
  { q: 'Does Flynn send things on its own?', a: "Never. Flynn drafts and asks before anything moves. Order parts? It shows you the cart total first. Send an invoice? It confirms before hitting send. You're always in the loop." },
  { q: 'Do I need to set anything up?', a: "Just a few minutes to tell Flynn your business basics: your services, prices, and which suppliers you use. After that, every text gets smarter." },
  { q: 'What does it cost?', a: 'Free to start. Pro is unlimited actions, invoices with photos, auto-chasing late payments, quote drafting, supplier ordering and accounting sync, with a 14-day free trial.' },
  { q: 'Is my data safe?', a: "Flynn only knows what you tell it. No scanning your contacts, no reading your messages. You control what it has access to." },
];

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Card className="overflow-hidden">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between gap-4 text-left px-5 sm:px-6 py-5">
        <span className="font-display font-bold text-lg sm:text-xl text-[#2C2018]">{q}</span>
        <span className={`text-2xl text-[#FB5B1E] transition-transform ${open ? 'rotate-45' : ''}`}>+</span>
      </button>
      {open && <p className="px-5 sm:px-6 pb-6 -mt-1 text-[#5A4A3C] leading-relaxed">{a}</p>}
    </Card>
  );
}

export default function LandingPage() {
  return (
    <div className="bg-[#F4E6CE] text-[#2C2018] overflow-hidden">

      {/* ===================== HERO ===================== */}
      <section className="relative">
        <Motifs variant={0} />
        <div className="relative max-w-7xl mx-auto px-5 sm:px-8 pt-10 pb-20 lg:py-24 grid lg:grid-cols-2 gap-12 items-center">
          <Reveal>
            <h1 className="font-display font-bold leading-[0.98] text-[clamp(2.6rem,7vw,4.6rem)] tracking-tight">
              Never miss<br />another job.<br /><span className="text-[#FB5B1E]">Flynn answers.</span>
            </h1>
            <p className="mt-6 text-lg sm:text-xl text-[#5A4A3C] max-w-xl leading-relaxed">
              When you're on the tools, Flynn picks up — a receptionist that sounds like a real person, books the job, and texts the client back in seconds. Then it does the rest: the invoice with the photos on it, the pay link, and the chasing until the money lands.
            </p>
            <p className="mt-5 text-sm font-medium text-[#8C7B6A]">Sounds like a real person · Free to start · AU &amp; NZ</p>
            <div className="mt-7">
              <a href="https://apps.apple.com/au/app/flynnai/id6752254950" target="_blank" rel="noopener noreferrer"
                className="flynn-glass flynn-glass--primary flynn-pill inline-flex items-center gap-2.5 px-8 py-4 font-display font-bold text-lg">
                Get Flynn free
              </a>
            </div>
          </Reveal>

          <Reveal delay={0.1} className="relative flex flex-col items-center lg:items-end gap-4">
            <Starburst className="absolute -left-2 top-10 w-16 h-16 hidden sm:block" />
            <PhoneSignupChat />
            <Mascot pose="wave" className="absolute -top-6 -right-2 w-28 sm:w-36 drop-shadow-xl hidden lg:block" />
          </Reveal>
        </div>
      </section>

      {/* ===================== TRUST STRIP ===================== */}
      <section className="bg-[#2C2018] text-[#F4E6CE]">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 py-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-center">
          <span className="font-display font-bold text-base sm:text-lg text-[#FB5B1E]">Tradies</span><span className="opacity-40">·</span>
          <span className="font-display font-bold text-base sm:text-lg">Builders</span><span className="opacity-40">·</span>
          <span className="font-display font-bold text-base sm:text-lg">Sparkies</span><span className="opacity-40">·</span>
          <span className="font-display font-bold text-base sm:text-lg">Plumbers</span><span className="opacity-40">·</span>
          <span className="font-display font-bold text-base sm:text-lg">Landscapers</span>
        </div>
      </section>

      {/* ===================== APP STORE CTA (secondary) ===================== */}
      <section className="py-10 border-b-[3px] border-[#2C2018]">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 flex flex-col items-center justify-center gap-4">
          <span className="text-sm font-medium text-[#8C7B6A]">Prefer the app?</span>
          <StoreButtons />
        </div>
      </section>

      {/* ===================== HOW IT WORKS ===================== */}
      <section id="how" className="relative py-20 sm:py-28">
        <div className="max-w-7xl mx-auto px-5 sm:px-8">
          <Reveal className="text-center max-w-2xl mx-auto mb-16">
            <SectionLabel>How it works</SectionLabel>
            <h2 className="font-display font-bold text-[clamp(2rem,5vw,3.2rem)] leading-tight">One contact. All the <span className="text-[#FB5B1E]">admin</span> sorted.</h2>
          </Reveal>
          <div className="grid md:grid-cols-3 gap-6">
            {steps.map((s, i) => (
              <Reveal key={s.n} delay={i * 0.08}>
                <Card className="h-full p-7 relative">
                  <Mascot pose={s.pose} className="w-20 h-20 mb-4" />
                  <span className="absolute top-6 right-7 font-display font-bold text-5xl text-[#F4E6CE]" style={{ WebkitTextStroke: `2px ${INK}` }}>{s.n}</span>
                  <h3 className="font-display font-bold text-2xl mb-2">{s.title}</h3>
                  <p className="text-[#5A4A3C] leading-relaxed">{s.body}</p>
                </Card>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ===================== FEATURES ===================== */}
      <section id="features" className="relative py-20 sm:py-28 bg-[#FFFBF4] border-y-[3px] border-[#2C2018]">
        <div className="max-w-7xl mx-auto px-5 sm:px-8">
          <Reveal className="max-w-2xl mb-16">
            <SectionLabel>What Flynn can do</SectionLabel>
            <h2 className="font-display font-bold text-[clamp(2rem,5vw,3.2rem)] leading-tight">Does your admin by text — and catches what you'd miss</h2>
          </Reveal>
          <div className="grid md:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <Reveal key={f.title} delay={i * 0.08}>
                <div className="h-full rounded-3xl p-7 border-[3px] border-[#2C2018]" style={{ background: f.tint + '22' }}>
                  <div className="w-16 h-16 rounded-2xl grid place-items-center border-[3px] border-[#2C2018] mb-5" style={{ background: f.tint }}>
                    <Mascot pose={f.pose} className="w-12 h-12" />
                  </div>
                  <h3 className="font-display font-bold text-2xl mb-2">{f.title}</h3>
                  <p className="text-[#5A4A3C] leading-relaxed">{f.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ===================== PROACTIVE ===================== */}
      <section id="proactive" className="relative py-20 sm:py-28">
        <Motifs variant={1} />
        <div className="relative max-w-7xl mx-auto px-5 sm:px-8 grid lg:grid-cols-2 gap-12 items-center">
          <Reveal>
            <SectionLabel>Proactive</SectionLabel>
            <h2 className="font-display font-bold text-[clamp(2rem,5vw,3.4rem)] leading-tight">It catches what you'd miss. <span className="text-[#FB5B1E]">Before you do.</span></h2>
            <p className="mt-6 text-lg text-[#5A4A3C] leading-relaxed max-w-lg">
              Flynn's got your real calendar, your jobs and your clients loaded, so it doesn't wait to be asked. It sees the rain coming Thursday and offers to move the outdoor job before you've lost the day.
            </p>
            <ul className="mt-7 space-y-4">
              <li className="flex items-start gap-3">
                <span className="mt-0.5 text-xl">🌧️</span>
                <span className="text-[#2C2018]">Rain forecast on an outdoor job? Flynn flags it, offers to <span className="font-semibold text-[#FB5B1E]">reschedule, and texts the client</span> for you.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-0.5 text-xl">📅</span>
                <span className="text-[#2C2018]">It knows what's already on, so it <span className="font-semibold">books jobs and replies to clients</span> around your real day.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-0.5 text-xl">🔔</span>
                <span className="text-[#2C2018]">Overdue invoice, a job to confirm, parts running low — <span className="font-semibold">Flynn brings it to you first</span>.</span>
              </li>
            </ul>
            <div className="mt-9 flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-3 bg-[#FFFBF4] border-[3px] border-[#2C2018] rounded-2xl px-4 py-3 shadow-[4px_4px_0_0_#2C2018]">
                <AppleCalIcon className="w-9 h-9" />
                <GoogleCalIcon className="w-9 h-9" />
              </div>
              <span className="font-display font-semibold text-[#5A4A3C]">Works with Apple&nbsp;Calendar &amp; Google&nbsp;Calendar</span>
            </div>
          </Reveal>

          <Reveal delay={0.1} className="flex justify-center">
            <div className="w-full max-w-sm space-y-3">
              {/* Flynn reaches out first — the proactive beat */}
              <div className="max-w-[90%] bg-[#FFFBF4] border-[3px] border-[#2C2018] rounded-2xl rounded-bl-md px-4 py-3 shadow-[4px_4px_0_0_#2C2018]">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-[#FB5B1E] flex items-center gap-1.5 mb-1">⚡ Heads up</span>
                rain's forecast all day thursday and the henderson paint job's outside. want me to push it to saturday?
              </div>
              {/* user replies */}
              <div className="ml-auto max-w-[40%] bg-[#007AFF] text-white border-[3px] border-[#2C2018] rounded-2xl rounded-br-md px-4 py-3 shadow-[4px_4px_0_0_#2C2018]">
                yeah do it
              </div>
              {/* Flynn confirms + tells the client */}
              <div className="max-w-[90%] bg-[#FFFBF4] border-[3px] border-[#2C2018] rounded-2xl rounded-bl-md px-4 py-3 shadow-[4px_4px_0_0_#2C2018]">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-[#FB5B1E] flex items-center gap-1.5 mb-1">✓ moved to sat 9am</span>
                done. i've rebooked henderson saturday 9am and texted them to let them know.
              </div>
              {/* rescheduled event card */}
              <div className="bg-[#2C2018] text-[#F4E6CE] rounded-2xl p-4 flex items-center gap-3">
                <div className="bg-[#FFFBF4] rounded-xl p-1.5 flex items-center gap-1">
                  <AppleCalIcon className="w-8 h-8" />
                </div>
                <div className="flex-1">
                  <p className="font-display font-bold text-[15px] flex items-center gap-2"><span className="text-[#7CD992]">✓</span> Moved off the rain</p>
                  <p className="text-sm text-[#F4E6CE]/70">Henderson paint job · Thu → Sat 14 Jun · 9:00 AM</p>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ===================== GET PAID ===================== */}
      <section id="getpaid" className="relative py-20 sm:py-28 bg-[#FFFBF4] border-y-[3px] border-[#2C2018]">
        <div className="relative max-w-7xl mx-auto px-5 sm:px-8 grid lg:grid-cols-2 gap-12 items-center">
          <Reveal>
            <SectionLabel>Get paid</SectionLabel>
            <h2 className="font-display font-bold text-[clamp(2rem,5vw,3.4rem)] leading-tight">Send the invoice. <span className="text-[#FB5B1E]">Flynn chases it till it's paid.</span></h2>
            <p className="mt-6 text-lg text-[#5A4A3C] leading-relaxed max-w-lg">
              Text Flynn the job and a few photos. It sends your client an invoice with the before-and-afters right on it and a pay link — then follows up on the ones that go quiet, so the money you're owed actually turns up without the awkward texts.
            </p>
            <ul className="mt-7 space-y-4">
              <li className="flex items-start gap-3">
                <span className="mt-0.5 text-xl">📸</span>
                <span className="text-[#2C2018]">The <span className="font-semibold">photos from the job</span> go right on the invoice — proof your client's happy to share.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-0.5 text-xl">🔔</span>
                <span className="text-[#2C2018]">Flynn <span className="font-semibold text-[#FB5B1E]">chases the late ones</span> for you — no more awkward "just following up" texts.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-0.5 text-xl">✅</span>
                <span className="text-[#2C2018]">Tell Flynn it's paid and it <span className="font-semibold">marks it off and stops chasing</span>.</span>
              </li>
            </ul>
          </Reveal>

          <Reveal delay={0.1} className="flex justify-center">
            <div className="w-full max-w-sm space-y-3">
              {/* user texts Flynn the job + photos */}
              <div className="ml-auto max-w-[88%] bg-[#007AFF] text-white border-[3px] border-[#2C2018] rounded-2xl rounded-br-md px-4 py-3 shadow-[4px_4px_0_0_#2C2018]">
                invoice henderson for today, $640, here's the before and afters
              </div>
              <div className="ml-auto flex gap-2 justify-end">
                <div className="relative w-[92px] h-[92px] rounded-xl border-[3px] border-[#2C2018] shadow-[3px_3px_0_0_#2C2018] overflow-hidden">
                  <img src="/before.jpg" alt="Before — overgrown side passage" className="w-full h-full object-cover" loading="lazy" />
                  <span className="absolute bottom-1 left-1 text-[9px] font-semibold text-white bg-black/45 rounded px-1.5 py-0.5">Before</span>
                </div>
                <div className="relative w-[92px] h-[92px] rounded-xl border-[3px] border-[#2C2018] shadow-[3px_3px_0_0_#2C2018] overflow-hidden">
                  <img src="/after.jpg" alt="After — cleared and raked" className="w-full h-full object-cover" loading="lazy" />
                  <span className="absolute bottom-1 left-1 text-[9px] font-semibold text-white bg-black/45 rounded px-1.5 py-0.5">After</span>
                </div>
              </div>
              {/* Flynn emails the invoice */}
              <div className="max-w-[88%] bg-[#FFFBF4] border-[3px] border-[#2C2018] rounded-2xl rounded-bl-md px-4 py-3 shadow-[4px_4px_0_0_#2C2018]">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-[#FB5B1E] flex items-center gap-1.5 mb-1">✓ invoice emailed to henderson</span>
                emailed henderson the invoice for $640 with the before/afters on it. here's the link too:
                <span className="block mt-1 font-medium text-[#007AFF] underline decoration-[#007AFF]/30">flynnai.app/i/h7x2k9</span>
              </div>
              {/* proactive chase card */}
              <div className="bg-[#2C2018] text-[#F4E6CE] rounded-2xl p-4 flex items-center gap-3 shadow-[4px_4px_0_0_#000]">
                <div className="w-10 h-10 rounded-full bg-[#E0A436] grid place-items-center text-white text-lg font-bold shrink-0">🔔</div>
                <div className="flex-1">
                  <p className="font-display font-bold text-[15px]">Henderson's $640 invoice is 3 days old</p>
                  <p className="text-sm text-[#F4E6CE]/70">Following up for you — want me to chase?</p>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ===================== SHOWCASE — what can I text Flynn? ===================== */}
      <section className="relative py-20 sm:py-28">
        <Motifs variant={2} />
        <div className="relative max-w-7xl mx-auto px-5 sm:px-8 grid lg:grid-cols-2 gap-12 items-center">
          <Reveal className="order-2 lg:order-1 flex justify-center">
            <div className="w-full max-w-sm space-y-3 relative">
              <Mascot pose="peek" className="absolute -bottom-14 -left-16 w-20 sm:w-24 drop-shadow-xl pointer-events-none" />
              {[
                "invoice henderson for today, $640 + the before/afters",
                "chase the McKenzie invoice, it's a week overdue",
                "draft a quote for Sarah, full kitchen repaint",
                "order 20 copper fittings from Reece asap",
                "book Henderson job Thursday 2pm",
              ].map((msg, i) => (
                <div key={i} className="ml-auto max-w-[92%] bg-[#007AFF] text-white border-[3px] border-[#2C2018] rounded-2xl rounded-br-md px-4 py-3 shadow-[4px_4px_0_0_#2C2018] text-[15px]">
                  {msg}
                </div>
              ))}
            </div>
          </Reveal>
          <Reveal delay={0.1} className="order-1 lg:order-2">
            <SectionLabel>One contact. All the admin.</SectionLabel>
            <h2 className="font-display font-bold text-[clamp(2rem,5vw,3.4rem)] leading-tight">If you'd normally open a laptop for it,<br /><span className="text-[#FB5B1E]">text Flynn instead.</span></h2>
            <ul className="mt-6 space-y-3">
              {[
                'Send invoices with the job photos on them',
                'Chase late payers before you\'d even notice',
                'Order parts at the best price across your suppliers',
                'Spot a rained-out job and reschedule it',
                'Write quotes and replies in your voice',
                'Book jobs · file receipts to Xero',
              ].map(t => (
                <li key={t} className="flex items-start gap-3 text-[#2C2018] font-medium">
                  <span className="mt-1 w-5 h-5 rounded-full bg-[#FB5B1E] text-white grid place-items-center text-xs shrink-0">✓</span>{t}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      {/* ===================== KEYBOARD MENTION ===================== */}
      <section className="py-10 bg-[#FFFBF4] border-y-[2px] border-[#2C2018]/20">
        <div className="max-w-3xl mx-auto px-5 text-center">
          <p className="text-[#5A4A3C] text-base sm:text-lg leading-relaxed">
            <span className="font-semibold text-[#2C2018]">Also included:</span> The Flynn keyboard extension drafts replies right inside any messaging app — iMessage, WhatsApp, email. Tap to insert. Nothing sends on its own.
          </p>
        </div>
      </section>

      {/* ===================== PRICING ===================== */}
      <section id="pricing" className="relative py-20 sm:py-28 bg-[#2C2018] text-[#F4E6CE]">
        <div className="max-w-5xl mx-auto px-5 sm:px-8">
          <Reveal className="text-center max-w-2xl mx-auto mb-14">
            <span className="inline-block font-display font-bold text-[13px] tracking-[0.18em] uppercase text-[#FB5B1E] mb-4">Pricing</span>
            <h2 className="font-display font-bold text-[clamp(2rem,5vw,3.2rem)] leading-tight">Start free. Go unlimited when it's saving you time.</h2>
          </Reveal>
          <div className="grid md:grid-cols-2 gap-6">
            <Reveal>
              <div className="h-full rounded-3xl bg-[#F4E6CE] text-[#2C2018] border-[3px] border-[#2C2018] p-8">
                <h3 className="font-display font-bold text-2xl">Free</h3>
                <p className="font-display font-bold text-5xl mt-2">$0</p>
                <p className="text-[#5A4A3C] mt-1 mb-6">to get the feel of it</p>
                <ul className="space-y-3">
                  {['A few actions every day', 'Reply drafts in your voice', 'One connected calendar'].map(t => (
                    <li key={t} className="flex gap-3"><span className="text-[#FB5B1E] font-bold">✓</span>{t}</li>
                  ))}
                </ul>
              </div>
            </Reveal>
            <Reveal delay={0.1}>
              <div className="relative h-full rounded-3xl bg-[#FB5B1E] text-white border-[3px] border-[#2C2018] p-8 shadow-[8px_8px_0_0_#000]">
                <span className="absolute -top-3 right-6 bg-[#E0A436] text-[#2C2018] text-xs font-bold uppercase tracking-wide px-3 py-1 rounded-full border-2 border-[#2C2018]">14-day free trial</span>
                <h3 className="font-display font-bold text-2xl">Pro</h3>
                <p className="font-display font-bold text-5xl mt-2">Unlimited</p>
                <p className="text-white/80 mt-1 mb-6">for when it's part of your day</p>
                <ul className="space-y-3">
                  {['Unlimited actions', 'Invoices with photos', 'Auto-chase unpaid invoices', 'Quote drafting in your voice', 'Supplier ordering + accounting sync', 'Full voice tuning + your business brain'].map(t => (
                    <li key={t} className="flex gap-3"><span className="font-bold">✓</span>{t}</li>
                  ))}
                </ul>
                <a href="https://apps.apple.com/au/app/flynnai/id6752254950" target="_blank" rel="noopener noreferrer"
                  className="flynn-glass flynn-glass--light flynn-pill mt-8 flex items-center justify-center px-6 py-3.5 font-display font-bold text-[#2C2018]">
                  Start the free trial
                </a>
              </div>
            </Reveal>
          </div>
          <div className="flex justify-center mt-12"><StoreButtons /></div>
        </div>
      </section>

      {/* ===================== FAQ ===================== */}
      <section id="faq" className="relative py-20 sm:py-28">
        <div className="max-w-3xl mx-auto px-5 sm:px-8">
          <Reveal className="text-center mb-12 relative">
            <Mascot pose="thinking" className="w-24 mx-auto mb-2" />
            <h2 className="font-display font-bold text-[clamp(2rem,5vw,3rem)] leading-tight">Questions, answered</h2>
          </Reveal>
          <div className="space-y-4">
            {faqs.map((f, i) => <Reveal key={f.q} delay={i * 0.05}><FAQItem {...f} /></Reveal>)}
          </div>
        </div>
      </section>

      {/* ===================== FINAL CTA ===================== */}
      <section className="relative py-24 sm:py-32 text-center">
        <Motifs variant={1} />
        <div className="relative max-w-3xl mx-auto px-5 sm:px-8">
          <Reveal>
            <Mascot pose="thumbsup" className="w-32 mx-auto mb-6 drop-shadow-xl" />
            <h2 className="font-display font-bold text-[clamp(2.4rem,6vw,4rem)] leading-[1.02]">
              Your business runs from your phone.<br /><span className="text-[#FB5B1E]">Flynn makes it work for you.</span>
            </h2>
            <p className="mt-5 text-lg sm:text-xl text-[#5A4A3C] max-w-xl mx-auto">
              Quote it, invoice it, chase it — all from a text.
            </p>
            <div className="mt-9 flex justify-center"><StoreButtons variant="hero" /></div>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
