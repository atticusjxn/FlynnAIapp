"use client";

import { motion } from "framer-motion";

export default function WaveformDemo() {
  const heights = [20, 35, 25, 40, 30, 45, 28, 38, 32, 42, 26, 36];

  return (
    <div className="flex items-center justify-center gap-1.5 h-24">
      {heights.map((initialHeight, i) => (
        <motion.div
          key={i}
          className="w-1.5 bg-brand-blue rounded-full"
          initial={{ height: initialHeight }}
          animate={{
            height: [initialHeight, initialHeight + 10, initialHeight - 5, initialHeight],
          }}
          transition={{
            duration: 1.2,
            repeat: Infinity,
            delay: i * 0.1,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}
