import React, { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Swipeable tour of the actual app screens.
 *
 * Built on CSS scroll-snap rather than a drag library: on a phone — which is
 * where a tradie reads this — native momentum scrolling beats anything
 * JS-driven, and it keeps working if the JS is slow to hydrate. The arrows,
 * dots and keyboard handling are layered on top of that same scroller, so
 * every control drives one source of truth.
 *
 * Screens are real captures from the shipping build, not mockups.
 */

type Shot = {
  src: string;
  title: string;
  body: string;
  /** Colour of the motif circle behind this slide's phone. */
  tint: string;
};

const shots: Shot[] = [
  {
    src: '/app/home.webp',
    title: "What's waiting for you",
    tint: '#E0A436',
    body: "The money you're owed up top, then every call Flynn took while you were on the tools, each with the next step attached.",
  },
  {
    src: '/app/money.webp',
    title: 'Every invoice in one place',
    tint: '#3C8A86',
    body: "Sent, overdue, part-paid, done. Flynn chases the late ones so you're not the one sending awkward follow-ups.",
  },
  {
    src: '/app/invoice.webp',
    title: 'Get paid without the chasing',
    tint: '#C5532B',
    body: 'Text it to the client, share a PDF, and mark it paid the moment the money lands. The amount still owing is right there.',
  },
  {
    src: '/app/brain.webp',
    title: 'It knows your prices',
    tint: '#7E8B4F',
    body: 'Tell Flynn your trade, your rates and your hours once, out loud. Every quote and reply after that uses them.',
  },
  {
    src: '/app/bookings.webp',
    title: 'Booked straight off the call',
    tint: '#FB5B1E',
    body: 'Jobs land in your calendar with the address, the time and what they actually need, before you get back to the ute.',
  },
  {
    src: '/app/clients.webp',
    title: 'Every customer, remembered',
    tint: '#3C8A86',
    body: "Who they are, what you did last time and how to reach them. No more scrolling back through texts.",
  },
  {
    src: '/app/quote.webp',
    title: 'Quotes out the same day',
    tint: '#E0A436',
    body: 'Talk the job through and Flynn writes it up, prices it off your rates, and sends it before you leave site.',
  },
];

/** Phone chassis around a screenshot, matching the ink outline used site-wide. */
const PhoneFrame = ({ src, alt, eager }: { src: string; alt: string; eager: boolean }) => (
  <div className="relative rounded-[2.2rem] border-[3px] border-[#2C2018] bg-[#2C2018] p-[6px] shadow-[8px_8px_0_0_#2C2018]">
    {/* Dynamic Island */}
    <span
      aria-hidden="true"
      className="absolute left-1/2 top-[14px] z-10 h-[18px] w-[74px] -translate-x-1/2 rounded-full bg-[#2C2018]"
    />
    <img
      src={src}
      alt={alt}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      draggable={false}
      className="block w-full rounded-[1.85rem] select-none"
    />
  </div>
);

const AppShowcase = () => {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [active, setActive] = useState(0);

  // Track the slide nearest the centre of the scroller so the dots and caption
  // stay honest mid-swipe, not just when a snap settles.
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const mid = scroller.scrollLeft + scroller.clientWidth / 2;
        let nearest = 0;
        let best = Infinity;
        slideRefs.current.forEach((el, i) => {
          if (!el) return;
          const centre = el.offsetLeft + el.offsetWidth / 2;
          const d = Math.abs(centre - mid);
          if (d < best) { best = d; nearest = i; }
        });
        setActive(nearest);
      });
    };

    scroller.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => {
      scroller.removeEventListener('scroll', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  const goTo = useCallback((i: number) => {
    const clamped = Math.max(0, Math.min(shots.length - 1, i));
    const el = slideRefs.current[clamped];
    const scroller = scrollerRef.current;
    if (!el || !scroller) return;
    scroller.scrollTo({
      left: el.offsetLeft - (scroller.clientWidth - el.offsetWidth) / 2,
      behavior: 'smooth',
    });
  }, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); goTo(active + 1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(active - 1); }
  };

  return (
    <section className="relative overflow-hidden border-t-[3px] border-[#2C2018] bg-[#2C2018] py-16 sm:py-24 text-[#F4E6CE]">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="max-w-2xl">
          <span className="mb-4 inline-block font-display text-[13px] font-bold uppercase tracking-[0.18em] text-[#E0A436]">
            Have a look
          </span>
          <h2 className="font-display text-[clamp(2rem,5vw,3.2rem)] font-bold leading-tight">
            This is the <span className="text-[#FB5B1E]">whole app</span>.
          </h2>
          <p className="mt-4 max-w-xl text-lg leading-relaxed text-[#D6C9B6]">
            No mockups. These are the actual screens, with the jobs, invoices and clients
            of a plumber who runs his week out of it. Swipe through.
          </p>
        </div>
      </div>

      {/* Scroller. Padded by half a viewport so the first and last slides can
          still centre themselves. */}
      <div
        ref={scrollerRef}
        role="region"
        aria-roledescription="carousel"
        aria-label="Screens from the Flynn app"
        tabIndex={0}
        onKeyDown={onKeyDown}
        className="mt-12 flex snap-x snap-mandatory gap-6 overflow-x-auto scroll-smooth px-[max(1.25rem,calc(50vw-8.5rem))] pb-6 pt-2 sm:gap-10 sm:px-[max(2rem,calc(50vw-10.5rem))] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden focus:outline-none focus-visible:ring-4 focus-visible:ring-[#FB5B1E]/60"
      >
        {shots.map((shot, i) => {
          const isActive = i === active;
          return (
            <div
              key={shot.src}
              ref={(el) => { slideRefs.current[i] = el; }}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${shots.length}: ${shot.title}`}
              className="w-[17rem] shrink-0 snap-center sm:w-[21rem]"
            >
              <div
                className={`relative transition-all duration-500 ease-out ${
                  isActive ? 'scale-100 opacity-100' : 'scale-[0.9] opacity-55'
                }`}
              >
                {/* Motif circle, cropped behind the phone — same device as the
                    App Store slides so the two sets feel like one campaign. */}
                <span
                  aria-hidden="true"
                  className="absolute -right-10 -top-10 -z-10 h-32 w-32 rounded-full border-[3px] transition-opacity duration-500"
                  style={{ backgroundColor: shot.tint, borderColor: '#F4E6CE', opacity: isActive ? 0.9 : 0 }}
                />
                <PhoneFrame src={shot.src} alt={`Flynn app — ${shot.title}`} eager={i < 2} />
              </div>

              <div className={`mt-6 transition-opacity duration-500 ${isActive ? 'opacity-100' : 'opacity-0'}`}>
                <h3 className="font-display text-xl font-bold text-[#F4E6CE] sm:text-2xl">{shot.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-[#D6C9B6]">{shot.body}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Controls */}
      <div className="mx-auto mt-2 flex max-w-7xl items-center justify-center gap-6 px-5 sm:px-8">
        <button
          type="button"
          onClick={() => goTo(active - 1)}
          disabled={active === 0}
          aria-label="Previous screen"
          className="grid h-12 w-12 place-items-center rounded-full border-[3px] border-[#F4E6CE] text-2xl leading-none text-[#F4E6CE] transition-all hover:bg-[#F4E6CE] hover:text-[#2C2018] disabled:pointer-events-none disabled:opacity-30"
        >
          <span aria-hidden="true">‹</span>
        </button>

        <div className="flex items-center gap-2.5">
          {shots.map((shot, i) => (
            <button
              key={shot.src}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`Go to ${shot.title}`}
              aria-current={i === active}
              className={`h-2.5 rounded-full transition-all duration-300 ${
                i === active ? 'w-8 bg-[#FB5B1E]' : 'w-2.5 bg-[#F4E6CE]/35 hover:bg-[#F4E6CE]/70'
              }`}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={() => goTo(active + 1)}
          disabled={active === shots.length - 1}
          aria-label="Next screen"
          className="grid h-12 w-12 place-items-center rounded-full border-[3px] border-[#F4E6CE] text-2xl leading-none text-[#F4E6CE] transition-all hover:bg-[#F4E6CE] hover:text-[#2C2018] disabled:pointer-events-none disabled:opacity-30"
        >
          <span aria-hidden="true">›</span>
        </button>
      </div>
    </section>
  );
};

export default AppShowcase;
