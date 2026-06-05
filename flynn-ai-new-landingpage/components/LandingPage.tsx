import React, { useState } from 'react';
import { motion } from 'framer-motion';
import StoreButtons from './StoreButtons';

/* ------------------------------------------------------------------ *
 * Flynn landing page — mid-century cartoon, cream + orange, matches
 * the app. Reuses the screenshot concepts (real iMessage + the Flynn
 * keyboard) recreated as live, responsive HTML/CSS.
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

/* ----- decorative mid-century motifs ----- */
/* Shapes are positioned so their centres sit outside (or at) the section edge,
   meaning at most a quarter/half-arc is visible — never overlapping text content. */
const Motifs = ({ variant = 0 }: { variant?: number }) => {
  const sets = [
    // variant 0 — hero (text left, phone right) + final CTA
    // Shapes hug top-left and bottom-right corners, away from content columns.
    <>
      <span className="absolute top-[-80px] left-[-80px] w-[160px] h-[160px] rounded-full bg-[#3C8A86] border-[3px] border-[#2C2018]" />
      <span className="absolute bottom-[-104px] right-[-104px] w-[208px] h-[208px] rounded-full bg-[#E0A436] border-[3px] border-[#2C2018]" />
      <span className="absolute bottom-[-28px] left-[-28px] w-[56px] h-[56px] rounded-full bg-[#FB5B1E] border-[3px] border-[#2C2018]" />
    </>,
    // variant 1 — calendar (text left, widget right) + final CTA (centred)
    // Terra on the RIGHT side where there's no text; olive in bottom-right corner.
    <>
      <span className="absolute top-[15%] right-[-88px] w-[176px] h-[176px] rounded-full bg-[#C5532B] border-[3px] border-[#2C2018]" />
      <span className="absolute bottom-[-112px] right-[-112px] w-[224px] h-[224px] rounded-full bg-[#7E8B4F] border-[3px] border-[#2C2018]" />
    </>,
    // variant 2 — showcase (phone left, text right on desktop)
    // Teal on the LEFT side, behind the phone visual; mustard in bottom-right corner.
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

/* ----- real calendar brand logos ----- */
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

/* ----- phone: real iMessage thread + the Flynn keyboard ----- */
const PhoneHero = () => (
  <div className="relative w-[330px] sm:w-[360px] rounded-[46px] bg-[#1A1714] p-[11px] shadow-[0_30px_70px_-20px_rgba(44,32,24,0.55)]">
    <div className="rounded-[36px] overflow-hidden bg-white">
      {/* status bar */}
      <div className="flex items-center justify-between px-6 pt-3 pb-1 text-[#141416]">
        <span className="font-display font-semibold text-[15px]">9:41</span>
        <span className="flex items-center gap-1.5">
          <span className="flex items-end gap-0.5 h-3">{[3, 5, 7, 9].map(h => <i key={h} style={{ height: h }} className="w-1 bg-[#141416] rounded-sm block" />)}</span>
          <span className="w-6 h-3 rounded-[3px] border-2 border-[#141416] relative"><i className="absolute inset-[2px] right-1 bg-[#141416] rounded-[1px]" /></span>
        </span>
      </div>
      {/* nav */}
      <div className="flex items-center px-4 py-2 border-b border-gray-200">
        <span className="text-[#007AFF] text-2xl leading-none">‹</span>
        <div className="flex-1 flex flex-col items-center -ml-3">
          <span className="w-10 h-10 rounded-full bg-gray-400 text-white grid place-items-center font-semibold text-sm">S</span>
          <span className="text-[13px] font-medium text-[#141416] mt-0.5">Sam</span>
        </div>
        <span className="w-6 h-6 rounded-full border-2 border-[#007AFF] text-[#007AFF] grid place-items-center text-xs font-bold">i</span>
      </div>
      {/* thread */}
      <div className="px-3 pt-3 pb-2">
        <p className="text-center text-[11px] text-gray-400 mb-2">Today 9:41 AM</p>
        <div className="max-w-[80%] bg-[#E9E9EB] text-[#141416] text-[14px] leading-snug rounded-2xl rounded-bl-md px-3.5 py-2.5">
          Hi! Do you do quotes? How much to repaint a 3-bed, and when could you start?
        </div>
      </div>
      {/* compose */}
      <div className="flex items-center gap-2 px-3 pb-2">
        <div className="flex-1 h-9 rounded-full border border-gray-300 px-3 grid items-center text-[13px] text-gray-400">iMessage</div>
        <span className="w-8 h-8 rounded-full bg-gray-300 grid place-items-center text-white">↑</span>
      </div>
      {/* Flynn keyboard */}
      <div className="bg-[#F2F2F7] px-3.5 pt-2.5 pb-3.5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[12px] font-medium text-gray-500">Flynn · Coastal Painting</span>
          <span className="flex items-center gap-2 text-[12px] font-medium text-[#007AFF]">New <span className="text-gray-400">🌐</span></span>
        </div>
        <button className="w-full rounded-2xl bg-[#FB5B1E] text-white font-semibold py-3 text-[15px] shadow-[0_4px_0_0_#C5532B]">✍️ Draft a reply</button>
        <p className="text-center text-[11px] text-gray-400 my-2">Tap a reply to insert it.</p>
        <div className="space-y-2">
          {[
            "Yeah for sure! A 3-bed's usually $3.5–4.5k. Could swing by Thurs to quote — what time suits?",
            "Happy to help 🙌 Ballpark's about $4k depending on prep. Free Saturday morning?",
            "Definitely do quotes! When's good for a quick look this week?",
          ].map((t, i) => (
            <div key={i} className="bg-[#E2E2E8] text-[#1c1c1e] text-[13px] leading-snug rounded-xl px-3 py-2.5">{t}</div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

const SectionLabel = ({ children }: any) => (
  <span className="inline-block font-display font-bold text-[13px] tracking-[0.18em] uppercase text-[#FB5B1E] mb-4">{children}</span>
);

const Card = ({ children, className = '' }: any) => (
  <div className={`bg-[#FFFBF4] border-[3px] border-[#2C2018] rounded-3xl shadow-[6px_6px_0_0_#2C2018] ${className}`}>{children}</div>
);

/* ===================== STEPS ===================== */
const steps = [
  { n: '1', pose: 'point', title: 'Capture the message', body: "Tap to grab a screenshot of the conversation — Flynn reads it in a second. Or just copy it like normal." },
  { n: '2', pose: 'phone', title: 'Tap the Flynn keyboard', body: 'Switch to Flynn right inside Messages. It reads what you copied and drafts a few replies.' },
  { n: '3', pose: 'thumbsup', title: 'Send one that’s already you', body: 'Tap the reply that sounds like you. Agreed a time? Flynn drops it in your calendar.' },
];

/* ===================== FEATURES ===================== */
const features = [
  { pose: ‘write’, tint: ‘#3C8A86’, title: ‘Sounds exactly like you’, body: ‘Flynn learns from your real replies — your slang, your casing, your sign-offs. Every draft reads like you actually wrote it.’ },
  { pose: ‘phone’, tint: ‘#E0A436’, title: ‘Knows when you’re free’, body: ‘Connected to your Apple or Google Calendar — Flynn drafts around your real availability, not a guess. Agree on a time and it’s booked automatically.’ },
  { pose: 'thinking', tint: '#C5532B', title: 'Knows your business', body: 'Your services, prices, hours and area live in Flynn’s brain, so quotes and answers are right every time.' },
];

/* ===================== FAQ ===================== */
const faqs = [
  { q: 'How does Flynn work?', a: 'Flynn is a keyboard you add to your phone. Copy any message, switch to the Flynn keyboard inside Messages, and tap “Draft a reply.” It writes a few replies in your voice — you pick one and send. You’re always in control; nothing sends automatically.' },
  { q: 'Is it only for tradies?', a: 'Not at all. Flynn works for anyone who texts to get things booked — freelancers, salons, real estate, side hustles, or just locking in a time with mates. If you reply to messages, Flynn helps.' },
  { q: 'Does it read my private messages?', a: 'No. Flynn only ever sees the message you explicitly copy and the reply you’re drafting. It doesn’t read your conversations or contacts.' },
  { q: 'How does it sound like me?', a: 'During setup you give Flynn a few replies you’d actually send. It matches that tone — and learns from the drafts you accept over time.' },
  { q: 'What does it cost?', a: 'Free to start with a few drafts a day. Pro is unlimited drafts, calendar booking and full voice tuning, with a 14-day free trial.' },
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
              Reply in your <span className="text-[#FB5B1E]">voice.</span><br />Lock in the <span className="text-[#FB5B1E]">time.</span>
            </h1>
            <p className="mt-6 text-lg sm:text-xl text-[#5A4A3C] max-w-xl leading-relaxed">
              Flynn drafts your texts so they sound exactly like you — then books the moment everyone agrees. Right inside Messages. For clients, side gigs, or just the group chat.
            </p>
            <div className="mt-2"><StoreButtons /></div>
            <p className="mt-5 text-sm font-medium text-[#8C7B6A]">Free to start · No card needed · You approve every reply</p>
            <p className="mt-2 text-sm font-medium text-[#8C7B6A]">Also on Mac</p>
          </Reveal>

          <Reveal delay={0.1} className="relative flex justify-center lg:justify-end">
            <Starburst className="absolute -left-2 top-10 w-16 h-16 hidden sm:block" />
            <PhoneHero />
            <Mascot pose="wave" className="absolute -top-6 -right-2 w-28 sm:w-36 drop-shadow-xl" />
          </Reveal>
        </div>
      </section>

      {/* ===================== TRUST STRIP ===================== */}
      <section className="bg-[#2C2018] text-[#F4E6CE]">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 py-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-center">
          <span className="font-display font-bold text-base sm:text-lg">Tradies</span><span className="opacity-40">·</span>
          <span className="font-display font-bold text-base sm:text-lg">Freelancers</span><span className="opacity-40">·</span>
          <span className="font-display font-bold text-base sm:text-lg">Salons</span><span className="opacity-40">·</span>
          <span className="font-display font-bold text-base sm:text-lg">Real estate</span><span className="opacity-40">·</span>
          <span className="font-display font-bold text-base sm:text-lg">Side hustles</span><span className="opacity-40">·</span>
          <span className="font-display font-bold text-base sm:text-lg text-[#FB5B1E]">Anyone who texts</span>
        </div>
      </section>

      {/* ===================== HOW IT WORKS ===================== */}
      <section id="how" className="relative py-20 sm:py-28">
        <div className="max-w-7xl mx-auto px-5 sm:px-8">
          <Reveal className="text-center max-w-2xl mx-auto mb-16">
            <SectionLabel>Three taps, done</SectionLabel>
            <h2 className="font-display font-bold text-[clamp(2rem,5vw,3.2rem)] leading-tight">From “I’ll reply later” to <span className="text-[#FB5B1E]">sent</span> — in seconds</h2>
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
            <SectionLabel>Why people love it</SectionLabel>
            <h2 className="font-display font-bold text-[clamp(2rem,5vw,3.2rem)] leading-tight">It actually sounds like you — and it remembers the details</h2>
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

      {/* ===================== CALENDAR ===================== */}
      <section id="calendar" className="relative py-20 sm:py-28">
        <Motifs variant={1} />
        <div className="relative max-w-7xl mx-auto px-5 sm:px-8 grid lg:grid-cols-2 gap-12 items-center">
          <Reveal>
            <SectionLabel>Calendar</SectionLabel>
            <h2 className="font-display font-bold text-[clamp(2rem,5vw,3.4rem)] leading-tight">It knows when <span className="text-[#FB5B1E]">you’re free</span></h2>
            <p className="mt-6 text-lg text-[#5A4A3C] leading-relaxed max-w-lg">
              Connect your calendar and Flynn drafts around your <span className="font-semibold text-[#2C2018]">real availability</span> — then writes the agreed time straight back in. No flicking between apps.
            </p>
            <ul className="mt-7 space-y-4">
              <li className="flex items-start gap-3">
                <span className="mt-0.5 text-xl">💬</span>
                <span className="text-[#2C2018]"><span className="font-semibold">“You free Thursday at 2?”</span> — Flynn checks your calendar and replies <span className="font-semibold text-[#FB5B1E]">“Yeah, Thursday at 2 works!”</span></span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-0.5 text-xl">📅</span>
                <span className="text-[#2C2018]">Agree on a time and it’s <span className="font-semibold">booked into your calendar</span> automatically — no double-entry.</span>
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
              {/* customer asks about availability */}
              <div className="max-w-[85%] bg-[#FFFBF4] border-[3px] border-[#2C2018] rounded-2xl rounded-bl-md px-4 py-3 text-[#2C2018] shadow-[4px_4px_0_0_#2C2018]">
                Any chance you’re free Thursday arvo? Say 2pm?
              </div>
              {/* flynn draft, with availability check */}
              <div className="ml-auto max-w-[88%] bg-[#FB5B1E] text-white border-[3px] border-[#2C2018] rounded-2xl rounded-br-md px-4 py-3 shadow-[4px_4px_0_0_#2C2018]">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-white/80 flex items-center gap-1.5 mb-1">✓ checked your calendar · Thu 2pm is open</span>
                Yeah Thursday at 2 works! Lock it in 👍
              </div>
              {/* booked event card */}
              <div className="bg-[#2C2018] text-[#F4E6CE] rounded-2xl p-4 flex items-center gap-3">
                <div className="bg-[#FFFBF4] rounded-xl p-1.5 flex items-center gap-1">
                  <AppleCalIcon className="w-8 h-8" />
                </div>
                <div className="flex-1">
                  <p className="font-display font-bold text-[15px] flex items-center gap-2"><span className="text-[#7CD992]">✓</span> Added to your calendar</p>
                  <p className="text-sm text-[#F4E6CE]/70">Quote — Thu 12 Jun · 2:00 PM</p>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ===================== SHOWCASE ===================== */}
      <section className="relative py-20 sm:py-28">
        <Motifs variant={2} />
        <div className="relative max-w-7xl mx-auto px-5 sm:px-8 grid lg:grid-cols-2 gap-12 items-center">
          <Reveal className="order-2 lg:order-1 flex justify-center">
            <div className="relative">
              <PhoneHero />
              <Mascot pose="peek" className="absolute -bottom-6 -left-8 w-28 sm:w-32 drop-shadow-xl" />
            </div>
          </Reveal>
          <Reveal delay={0.1} className="order-1 lg:order-2">
            <SectionLabel>The whole thing</SectionLabel>
            <h2 className="font-display font-bold text-[clamp(2rem,5vw,3.4rem)] leading-tight">Open Messages.<br />Tap Flynn. <span className="text-[#FB5B1E]">Done.</span></h2>
            <p className="mt-6 text-lg text-[#5A4A3C] leading-relaxed max-w-lg">
              No new app to live in, no copy-pasting into a chatbot. Flynn is right there on your keyboard — on your phone or your Mac.
            </p>
            <ul className="mt-6 space-y-3">
              {['Works in Messages, WhatsApp — on iPhone, Android and Mac', 'You read and tap — nothing sends on its own', 'Gets sharper every time you pick a reply'].map(t => (
                <li key={t} className="flex items-start gap-3 text-[#2C2018] font-medium">
                  <span className="mt-1 w-5 h-5 rounded-full bg-[#FB5B1E] text-white grid place-items-center text-xs shrink-0">✓</span>{t}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      {/* ===================== PRICING ===================== */}
      <section id="pricing" className="relative py-20 sm:py-28 bg-[#2C2018] text-[#F4E6CE]">
        <div className="max-w-5xl mx-auto px-5 sm:px-8">
          <Reveal className="text-center max-w-2xl mx-auto mb-14">
            <span className="inline-block font-display font-bold text-[13px] tracking-[0.18em] uppercase text-[#FB5B1E] mb-4">Pricing</span>
            <h2 className="font-display font-bold text-[clamp(2rem,5vw,3.2rem)] leading-tight">Start free. Go unlimited when it’s saving you time.</h2>
          </Reveal>
          <div className="grid md:grid-cols-2 gap-6">
            <Reveal>
              <div className="h-full rounded-3xl bg-[#F4E6CE] text-[#2C2018] border-[3px] border-[#2C2018] p-8">
                <h3 className="font-display font-bold text-2xl">Free</h3>
                <p className="font-display font-bold text-5xl mt-2">$0</p>
                <p className="text-[#5A4A3C] mt-1 mb-6">to get the feel of it</p>
                <ul className="space-y-3">
                  {['A few drafts every day', 'Replies in your voice', 'One connected calendar'].map(t => (
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
                <p className="text-white/80 mt-1 mb-6">for when it’s part of your day</p>
                <ul className="space-y-3">
                  {['Unlimited drafts', 'Calendar booking from your replies', 'Full voice tuning + learning', 'Your business brain (prices, hours, area)'].map(t => (
                    <li key={t} className="flex gap-3"><span className="font-bold">✓</span>{t}</li>
                  ))}
                </ul>
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
              Never leave a text on <span className="text-[#FB5B1E]">read</span> again
            </h2>
            <p className="mt-5 text-lg sm:text-xl text-[#5A4A3C] max-w-xl mx-auto">
              Add Flynn to your keyboard and reply in seconds — in your voice.
            </p>
            <div className="mt-8 flex justify-center"><StoreButtons /></div>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
