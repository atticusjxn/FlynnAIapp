"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { ArrowRight, Play, Check, Calendar, Mail } from "lucide-react";
import Button from "../ui/Button";
import PhoneMockup, { FloatingElement } from "../ui/PhoneMockup";
import { fadeInUp, staggerContainer } from "@/lib/animations";
import JobCardDemo from "../demo/JobCardDemo";

export default function Hero() {
  const heroRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });

  // Parallax effects
  const phoneY = useTransform(scrollYProgress, [0, 1], [0, -50]);

  return (
    <section
      ref={heroRef}
      className="relative min-h-screen flex items-center justify-center overflow-hidden bg-[var(--color-gray-50)] pt-20 pb-32"
    >
      <div className="container">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Column - Content */}
          <motion.div
            className="text-center lg:text-left z-10"
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
          >
            <motion.div variants={fadeInUp} className="inline-block mb-4">
              <span className="inline-flex items-center px-4 py-2 rounded-full bg-[var(--color-brand-blue)]/10 text-[var(--color-brand-blue)] text-sm font-medium">
                7-Day Free Trial - Full Pro Features
              </span>
            </motion.div>

            <motion.h1
              variants={fadeInUp}
              className="text-4xl md:text-5xl lg:text-6xl font-bold text-[var(--color-navy)] mb-6 leading-tight"
            >
              Turn Missed Calls Into{" "}
              <span className="text-[var(--color-brand-blue)]">Booked Jobs</span>
            </motion.h1>

            <motion.p
              variants={fadeInUp}
              className="text-lg md:text-xl text-[var(--color-charcoal)] mb-8 leading-relaxed"
            >
              AI voicemail receptionist that never misses a lead. Forward your missed calls to Flynn,
              get instant transcripts, organized calendar events, and professional follow-ups—all within
              2 minutes.
            </motion.p>

            <motion.div
              variants={fadeInUp}
              className="flex flex-col sm:flex-row gap-4 mb-8"
            >
              <Button variant="primary" size="large">
                Start Free Trial
                <ArrowRight className="w-5 h-5" />
              </Button>
              <Button variant="secondary" size="large">
                <Play className="w-5 h-5" />
                Watch Demo
              </Button>
            </motion.div>

            <motion.div
              variants={fadeInUp}
              className="flex flex-wrap items-center gap-6 text-sm text-[var(--color-charcoal)]"
            >
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-success" />
                <span>No credit card required</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-success" />
                <span>Cancel anytime</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-success" />
                <span>Setup in 60 seconds</span>
              </div>
            </motion.div>
          </motion.div>

          {/* Right Column - Phone Mockup with Dashboard */}
          <div className="relative h-[700px] lg:h-[800px] flex items-center justify-center">
            <motion.div style={{ y: phoneY }} className="relative">
              <PhoneMockup>
                {/* Dashboard Content */}
                <div className="w-full h-full bg-[var(--color-gray-100)] p-4 overflow-y-auto">
                  {/* Header */}
                  <div className="bg-white rounded-lg p-3 shadow-sm mb-3">
                    <div className="flex items-center justify-between">
                      <div className="w-8 h-8 rounded-full bg-[var(--color-brand-blue)]" />
                      <div className="text-xs font-semibold text-[var(--color-navy)]">Flynn AI</div>
                      <div className="w-6 h-6 rounded-full bg-gray-200" />
                    </div>
                    <h2 className="text-lg font-bold text-[var(--color-navy)] mt-3">Dashboard</h2>
                    <p className="text-xs text-[var(--color-gray-600)]">Today&apos;s Activity</p>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div className="bg-white rounded-lg p-2.5 shadow-sm">
                      <div className="text-xs text-[var(--color-gray-600)]">New Leads</div>
                      <div className="text-xl font-bold text-[var(--color-brand-blue)]">3</div>
                    </div>
                    <div className="bg-white rounded-lg p-2.5 shadow-sm">
                      <div className="text-xs text-[var(--color-gray-600)]">Upcoming</div>
                      <div className="text-xl font-bold text-[var(--color-success)]">5</div>
                    </div>
                  </div>

                  {/* Job Card */}
                  <div className="space-y-2.5">
                    <JobCardDemo
                      clientName="John Smith"
                      serviceType="Plumbing job"
                      description="Leaking pipe under kitchen sink needs urgent repair"
                      date="Tomorrow"
                      time="2:00 PM"
                      location="123 Main St"
                      status="pending"
                      source="voicemail"
                      transcript="Hi, I have a leaking pipe under my kitchen sink..."
                    />
                  </div>
                </div>
              </PhoneMockup>

              {/* Floating Notification Cards */}
              <FloatingElement direction="left" delay={0.3} className="top-20 -left-12 lg:-left-20">
                <div className="bg-white rounded-xl p-3 shadow-lg border border-gray-200 w-56">
                  <div className="flex items-start gap-2">
                    <div className="w-8 h-8 rounded-full bg-success/10 flex items-center justify-center flex-shrink-0">
                      <Check className="w-4 h-4 text-success" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-gray-900">Voicemail Transcribed</div>
                      <div className="text-xs text-gray-600">John Smith • Plumbing job</div>
                    </div>
                  </div>
                </div>
              </FloatingElement>

              <FloatingElement direction="right" delay={0.5} className="top-64 -right-8 lg:-right-16">
                <div className="bg-white rounded-xl p-3 shadow-lg border border-gray-200 w-52">
                  <div className="flex items-start gap-2">
                    <div className="w-8 h-8 rounded-full bg-brand-blue/10 flex items-center justify-center flex-shrink-0">
                      <Calendar className="w-4 h-4 text-brand-blue" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-gray-900">Event Created</div>
                      <div className="text-xs text-gray-600">Tomorrow at 2:00 PM</div>
                    </div>
                  </div>
                </div>
              </FloatingElement>

              <FloatingElement direction="bottom" delay={0.7} className="bottom-32 -right-4 lg:-right-12">
                <div className="bg-white rounded-xl p-3 shadow-lg border border-gray-200 w-48">
                  <div className="flex items-start gap-2">
                    <div className="w-8 h-8 rounded-full bg-warning/10 flex items-center justify-center flex-shrink-0">
                      <Mail className="w-4 h-4 text-warning" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-gray-900">Email Sent</div>
                      <div className="text-xs text-gray-600">Confirmation to client</div>
                    </div>
                  </div>
                </div>
              </FloatingElement>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
