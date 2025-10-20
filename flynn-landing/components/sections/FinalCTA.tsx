"use client";

import { motion } from "framer-motion";
import { ArrowRight, Check } from "lucide-react";
import Button from "../ui/Button";

export default function FinalCTA() {
  const benefits = [
    "7-Day Free Trial",
    "No Credit Card Required",
    "Setup in 60 Seconds",
    "Cancel Anytime",
  ];

  return (
    <section className="py-24 bg-brand-blue relative overflow-hidden">
      <div className="container relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center max-w-3xl mx-auto"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            Ready to Never Miss Another Appointment?
          </h2>
          <p className="text-lg text-blue-100 mb-8">
            Join thousands of professionals who trust Flynn AI to turn every business call into organized calendar events.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
            <Button variant="secondary" size="large">
              Start Your Free Trial
              <ArrowRight className="w-5 h-5" />
            </Button>
            <Button variant="secondary" size="large">
              Watch Demo
            </Button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {benefits.map((benefit, index) => (
              <div key={index} className="flex items-center justify-center gap-2 text-white">
                <Check className="w-4 h-4 text-success" />
                <span className="text-sm font-medium">{benefit}</span>
              </div>
            ))}
          </div>

          <div className="mt-8 pt-8 border-t border-blue-700">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-white">
              <div>
                <div className="text-2xl font-bold">15K+</div>
                <div className="text-sm text-blue-200">Professionals</div>
              </div>
              <div>
                <div className="text-2xl font-bold">99.9%</div>
                <div className="text-sm text-blue-200">Uptime</div>
              </div>
              <div>
                <div className="text-2xl font-bold">&lt; 2 min</div>
                <div className="text-sm text-blue-200">Processing</div>
              </div>
              <div>
                <div className="text-2xl font-bold">500+</div>
                <div className="text-sm text-blue-200">Jobs/Month</div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
