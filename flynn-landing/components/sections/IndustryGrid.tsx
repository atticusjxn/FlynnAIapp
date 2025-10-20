"use client";

import { motion } from "framer-motion";
import {
  Wrench,
  Home,
  Scale,
  HeartPulse,
  TrendingUp,
  Briefcase,
} from "lucide-react";
import Card from "../ui/Card";
import { staggerContainer } from "@/lib/animations";

export default function IndustryGrid() {
  const industries = [
    {
      icon: Wrench,
      name: "Plumbing & HVAC",
      description: "Capture every emergency call you miss. Turn voicemails into booked jobs automatically.",
      examples: ["Emergency repair requests", "After-hours calls", "Service quote inquiries"],
    },
    {
      icon: Home,
      name: "Real Estate",
      description: "Never miss a buyer inquiry. Turn missed calls into scheduled showings.",
      examples: ["Property viewing requests", "Buyer inquiries", "Listing questions"],
    },
    {
      icon: Scale,
      name: "Legal Services",
      description: "Capture potential clients after hours. Professional intake from voicemails.",
      examples: ["New client inquiries", "Consultation requests", "Case follow-ups"],
    },
    {
      icon: HeartPulse,
      name: "Medical Practices",
      description: "HIPAA-compliant voicemail handling. Never miss urgent patient calls.",
      examples: ["Appointment requests", "Prescription refills", "After-hours messages"],
    },
    {
      icon: TrendingUp,
      name: "Sales Teams",
      description: "Capture every inbound lead. Qualify prospects from missed calls.",
      examples: ["Inbound lead capture", "Demo requests", "Sales inquiries"],
    },
    {
      icon: Briefcase,
      name: "Consulting",
      description: "Professional client onboarding from voicemails. Never miss an opportunity.",
      examples: ["Consultation requests", "Project inquiries", "Client follow-ups"],
    },
  ];

  return (
    <section className="py-24 bg-white">
      <div className="container">
        <div className="text-center mb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-3xl md:text-4xl font-bold text-[var(--color-navy)] mb-4">
              Built for Every Industry
            </h2>
            <p className="text-lg text-[var(--color-charcoal)] max-w-2xl mx-auto">
              From tradespeople to consultants, Flynn AI adapts to your business needs.
            </p>
          </motion.div>
        </div>

        <motion.div
          className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.1 }}
          variants={staggerContainer}
        >
          {industries.map((industry, index) => {
            const Icon = industry.icon;
            return (
              <Card
                key={index}
                delay={index * 0.05}
                className="group cursor-pointer hover:border-[var(--color-brand-blue)] border-2 border-transparent transition-all duration-200"
              >
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-[var(--color-brand-blue)]/10 flex items-center justify-center flex-shrink-0 group-hover:bg-[var(--color-brand-blue)] transition-colors duration-200">
                    <Icon className="w-6 h-6 text-[var(--color-brand-blue)] group-hover:text-white transition-colors duration-200" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-[var(--color-navy)] mb-2">
                      {industry.name}
                    </h3>
                    <p className="text-sm text-[var(--color-charcoal)]">
                      {industry.description}
                    </p>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-[var(--color-gray-200)]">
                  <div className="text-xs font-medium text-[var(--color-gray-600)] mb-2">
                    Common Use Cases:
                  </div>
                  <ul className="space-y-1">
                    {industry.examples.map((example, i) => (
                      <li
                        key={i}
                        className="text-xs text-[var(--color-charcoal)] flex items-center gap-2"
                      >
                        <span className="w-1 h-1 rounded-full bg-[var(--color-brand-blue)]" />
                        {example}
                      </li>
                    ))}
                  </ul>
                </div>
              </Card>
            );
          })}
        </motion.div>

        <motion.div
          className="text-center mt-12"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <p className="text-[var(--color-gray-600)] text-sm">
            Don&apos;t see your industry? Flynn AI works with any business that takes phone calls.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
