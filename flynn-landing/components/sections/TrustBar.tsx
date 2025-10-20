"use client";

import { motion } from "framer-motion";

export default function TrustBar() {
  const metrics = [
    { value: "1000", suffix: "min", label: "Minutes per Month" },
    { value: "500+", suffix: "", label: "Jobs Booked" },
    { value: "99.9%", suffix: "", label: "Uptime" },
    { value: "< 2", suffix: "min", label: "Min Processing" },
  ];

  return (
    <section className="py-12 bg-white border-y border-gray-200">
      <div className="container">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {metrics.map((metric, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
              className="text-center"
            >
              <div className="text-3xl md:text-4xl font-bold text-brand-blue mb-2">
                {metric.value}
                <span className="text-2xl">{metric.suffix}</span>
              </div>
              <div className="text-sm text-gray-600">{metric.label}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
