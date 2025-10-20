"use client";

import { motion } from "framer-motion";
import { Check, Sparkles, Building2 } from "lucide-react";
import Button from "../ui/Button";
import Card from "../ui/Card";

export default function Pricing() {
  const plans = [
    {
      name: "Pro",
      price: 99,
      period: "/month",
      badge: "MOST POPULAR",
      icon: Sparkles,
      features: [
        "Up to 1000 minutes AI receptionist calls/month",
        "~500 booked jobs capacity",
        "Automatic context understanding",
        "Text confirmations to clients",
        "Calendar integrations (Google, Outlook, Apple)",
        "Accounting integrations (MYOB, QuickBooks, Xero)",
        "Custom greetings and messages",
        "Email summaries within 2 minutes",
        "SMS notifications",
        "Priority support",
      ],
    },
    {
      name: "Enterprise",
      price: null,
      period: "Custom",
      icon: Building2,
      features: [
        "Handle 30+ calls simultaneously",
        "1000+ booked jobs per month",
        "Unlimited AI receptionist minutes",
        "Dedicated account manager",
        "Custom integration support",
        "Advanced analytics & reporting",
        "Multi-location support",
        "Custom workflow automation",
        "24/7 priority support",
        "SLA guarantees",
      ],
    },
  ];

  return (
    <section className="py-24 bg-[var(--color-gray-50)]">
      <div className="container">
        <div className="text-center mb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-success-light text-success text-sm font-semibold mb-4">
              <Sparkles className="w-4 h-4" />
              7-Day Free Trial - Full Pro Features Included
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-[var(--color-navy)] mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-lg text-[var(--color-charcoal)] max-w-2xl mx-auto">
              Start with a free trial. No credit card required. Cancel anytime.
            </p>
          </motion.div>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {plans.map((plan, index) => {
            const Icon = plan.icon;
            const isPro = plan.name === "Pro";
            return (
              <Card
                key={index}
                delay={index * 0.1}
                className={isPro ? "border-2 border-brand-blue relative" : ""}
              >
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-brand-blue text-white text-xs font-bold">
                    {plan.badge}
                  </div>
                )}

                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-brand-blue/10 flex items-center justify-center">
                    <Icon className="w-6 h-6 text-brand-blue" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-[var(--color-navy)]">{plan.name}</h3>
                    <p className="text-sm text-[var(--color-charcoal)]">
                      {isPro ? "Perfect for small to medium businesses" : "For high-volume businesses"}
                    </p>
                  </div>
                </div>

                <div className="mb-6">
                  <div className="text-5xl font-bold text-[var(--color-navy)]">
                    {plan.price ? `$${plan.price}` : "Custom"}
                  </div>
                  <div className="text-[var(--color-charcoal)]">{plan.period}</div>
                </div>

                <Button
                  variant={isPro ? "primary" : "secondary"}
                  className="w-full mb-6"
                >
                  {plan.price ? "Start Free Trial" : "Contact Sales"}
                </Button>

                <ul className="space-y-3">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-[var(--color-charcoal)]">{feature}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            );
          })}
        </div>

        <div className="mt-12 flex flex-wrap items-center justify-center gap-6 text-sm text-[var(--color-charcoal)]">
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
            <span>Money-back guarantee</span>
          </div>
        </div>

        <motion.div
          className="text-center mt-8"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <p className="text-[var(--color-gray-600)] text-sm">
            Need a custom plan? Contact our sales team
          </p>
        </motion.div>
      </div>
    </section>
  );
}
