"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { X, Check } from "lucide-react";

export default function ProblemSolution() {
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });

  const leftOpacity = useTransform(scrollYProgress, [0.2, 0.5], [1, 0.3]);
  const rightOpacity = useTransform(scrollYProgress, [0.2, 0.5], [0.3, 1]);

  return (
    <section ref={sectionRef} className="py-24 bg-[var(--color-gray-50)]">
      <div className="container">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-[var(--color-navy)] mb-4">
            Stop Losing Business to Missed Calls
          </h2>
          <p className="text-lg text-[var(--color-charcoal)] max-w-2xl mx-auto">
            Every missed call is a lost opportunity. Flynn AI ensures you never miss a lead again.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {/* BEFORE - Problem */}
          <motion.div
            style={{ opacity: leftOpacity }}
            className="relative"
          >
            <div className="bg-white rounded-2xl p-8 shadow-md border-2 border-[var(--color-error)]/20">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-full bg-[var(--color-error)]/10 flex items-center justify-center">
                  <X className="w-6 h-6 text-[var(--color-error)]" />
                </div>
                <h3 className="text-xl font-bold text-[var(--color-navy)]">Without Flynn AI</h3>
              </div>

              <ul className="space-y-4">
                {[
                  "Missed calls go to basic voicemail—never checked",
                  "No transcripts, must listen to every message",
                  "Manually write down client details and requests",
                  "Forget to follow up with leads from voicemails",
                  "Lose track of who called and what they needed",
                  "Miss opportunities while you&apos;re busy on jobs",
                ].map((item, index) => (
                  <li key={index} className="flex items-start gap-3 text-[var(--color-charcoal)]">
                    <X className="w-5 h-5 text-[var(--color-error)] flex-shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-6 p-4 bg-[var(--color-error)]/5 rounded-lg">
                <p className="text-sm text-[var(--color-error)] font-medium">
                  Result: Lost revenue, frustrated clients, disorganized schedule
                </p>
              </div>
            </div>
          </motion.div>

          {/* AFTER - Solution */}
          <motion.div
            style={{ opacity: rightOpacity }}
            className="relative"
          >
            <div className="bg-white rounded-2xl p-8 shadow-md border-2 border-[var(--color-success)]/20">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-full bg-[var(--color-success)]/10 flex items-center justify-center">
                  <Check className="w-6 h-6 text-[var(--color-success)]" />
                </div>
                <h3 className="text-xl font-bold text-[var(--color-navy)]">With Flynn AI</h3>
              </div>

              <ul className="space-y-4">
                {[
                  "Every voicemail transcribed automatically",
                  "AI extracts names, dates, service needs, locations",
                  "Calendar events created from missed calls",
                  "Professional follow-up emails ready to send",
                  "SMS notifications keep you in the loop",
                  "Never miss a lead, even when you&apos;re busy",
                ].map((item, index) => (
                  <li key={index} className="flex items-start gap-3 text-[var(--color-charcoal)]">
                    <Check className="w-5 h-5 text-[var(--color-success)] flex-shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-6 p-4 bg-[var(--color-success)]/5 rounded-lg">
                <p className="text-sm text-[var(--color-success)] font-medium">
                  Result: More booked jobs, organized schedule, professional image
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
