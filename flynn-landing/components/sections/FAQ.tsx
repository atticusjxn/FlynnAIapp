"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { ChevronDown } from "lucide-react";

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      question: "How does call forwarding work?",
      answer: "Simply set up conditional call forwarding on your phone (takes 10 seconds). When you can&apos;t answer, calls forward to Flynn AI. Your callers hear your custom greeting, leave details, and our AI processes everything automatically. You maintain complete control and can disable forwarding anytime.",
    },
    {
      question: "Is my call data secure and private?",
      answer: "Absolutely. All voicemails are encrypted in transit and at rest. We&apos;re SOC 2 compliant and follow GDPR/CCPA regulations. Your data is never shared with third parties, and you can export or delete everything at any time.",
    },
    {
      question: "What happens if the AI gets something wrong?",
      answer: "You review and approve everything before it&apos;s sent. Flynn AI drafts responses and creates job cards, but you have final say. Our accuracy rate is 95%+, and any edits you make help train the system to work better for your business.",
    },
    {
      question: "Can I use my existing phone number?",
      answer: "Yes! Flynn works with your current business number. You simply set up call forwarding for unanswered calls. Alternatively, we can provision a dedicated Flynn number if you prefer.",
    },
    {
      question: "Do my callers know they&apos;re being recorded?",
      answer: "Your greeting (which you customize) includes disclosure that the call may be recorded for quality purposes. This is standard practice and legally compliant in all jurisdictions we operate in.",
    },
    {
      question: "What industries do you support?",
      answer: "Flynn AI works with any business that takes phone calls. We&apos;re especially popular with tradespeople, real estate agents, legal professionals, medical practices, sales teams, and consultants. The AI adapts to your industry-specific terminology.",
    },
    {
      question: "How accurate is the AI extraction?",
      answer: "Flynn AI achieves 95%+ accuracy for name, phone number, and service type extraction. Date/time accuracy is 90%+. You always review the extracted data before approving, so nothing gets sent without your verification.",
    },
    {
      question: "Can I cancel anytime?",
      answer: "Yes. No contracts, no cancellation fees. Cancel anytime from your settings. Your data remains accessible for 30 days after cancellation, and you can export everything before then.",
    },
    {
      question: "What&apos;s included in the 7-day free trial?",
      answer: "Full access to all Pro features: 1000 minutes of AI receptionist calls, automatic transcription, job card creation, calendar sync, email summaries, SMS notifications, and all integrations. No credit card required to start.",
    },
    {
      question: "How long does processing take?",
      answer: "Most voicemails are transcribed and processed within 2 minutes. You&apos;ll receive a transcript, calendar event, email summary, and SMS notification—all ready for your review.",
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
              Frequently Asked Questions
            </h2>
            <p className="text-lg text-[var(--color-charcoal)] max-w-2xl mx-auto">
              Everything you need to know about Flynn AI. Still have questions? Contact our team.
            </p>
          </motion.div>
        </div>

        <div className="max-w-3xl mx-auto space-y-4">
          {faqs.map((faq, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
              className="bg-white rounded-xl border border-gray-200 overflow-hidden"
            >
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="w-full flex items-center justify-between p-6 text-left hover:bg-gray-50 transition-colors"
              >
                <span className="text-lg font-bold text-[var(--color-navy)] pr-4">
                  {faq.question}
                </span>
                <ChevronDown
                  className={`w-5 h-5 text-[var(--color-charcoal)] transition-transform flex-shrink-0 ${
                    openIndex === index ? "rotate-180" : ""
                  }`}
                />
              </button>
              {openIndex === index && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="px-6 pb-6"
                >
                  <p className="text-[var(--color-charcoal)] leading-relaxed">
                    {faq.answer}
                  </p>
                </motion.div>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
