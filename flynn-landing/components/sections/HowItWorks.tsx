"use client";

import { motion } from "framer-motion";
import { Phone, Hash, CheckCircle } from "lucide-react";
import Card from "../ui/Card";

export default function HowItWorks() {
  const steps = [
    {
      number: "01",
      icon: Phone,
      title: "Forward Missed Calls",
      description: "Set up conditional call forwarding to route unanswered calls to Flynn. Your callers hear your custom greeting and leave a voicemail. Takes 10 seconds.",
    },
    {
      number: "02",
      icon: Hash,
      title: "AI Processes Voicemail",
      description: "Flynn transcribes the voicemail, extracts client details (name, phone, service type, date, time, location) and creates a draft job card automatically.",
    },
    {
      number: "03",
      icon: CheckCircle,
      title: "Get Organized Fast",
      description: "Within 2 minutes, receive the transcript, calendar event, professional email summary, and SMS notification—all ready for your review and approval.",
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
              How It Works
            </h2>
            <p className="text-lg text-[var(--color-charcoal)] max-w-2xl mx-auto">
              Get started in minutes. No complex integrations or technical setup required.
            </p>
          </motion.div>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <Card key={index} delay={index * 0.1}>
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-blue text-white text-2xl font-bold mb-4">
                    {step.number}
                  </div>
                  <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-brand-blue/10 flex items-center justify-center">
                    <Icon className="w-6 h-6 text-brand-blue" />
                  </div>
                  <h3 className="text-xl font-bold text-[var(--color-navy)] mb-3">
                    {step.title}
                  </h3>
                  <p className="text-[var(--color-charcoal)]">
                    {step.description}
                  </p>
                </div>
              </Card>
            );
          })}
        </div>

        <motion.div
          className="text-center mt-12"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <p className="text-[var(--color-charcoal)]">
            Ready to transform your business calls?
          </p>
        </motion.div>
      </div>
    </section>
  );
}
