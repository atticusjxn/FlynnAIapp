"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";

interface PhoneMockupProps {
  children: ReactNode;
  className?: string;
}

export default function PhoneMockup({ children, className = "" }: PhoneMockupProps) {
  return (
    <div className={`relative ${className}`}>
      {/* iPhone Frame */}
      <div className="relative w-[220px] h-[450px] sm:w-[260px] sm:h-[520px] lg:w-[280px] lg:h-[570px] bg-gray-900 rounded-[3rem] p-2.5 sm:p-3 shadow-2xl border-8 border-gray-900">
        {/* Notch */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 sm:w-28 lg:w-32 h-6 lg:h-7 bg-gray-900 rounded-b-3xl z-10" />

        {/* Screen */}
        <div className="w-full h-full bg-gray-50 rounded-[2.5rem] overflow-hidden relative">
          {children}
        </div>
      </div>
    </div>
  );
}

interface FloatingElementProps {
  children: ReactNode;
  direction: "left" | "right" | "top" | "bottom";
  delay?: number;
  className?: string;
}

export function FloatingElement({
  children,
  direction,
  delay = 0,
  className = "",
}: FloatingElementProps) {
  const initialX = direction === "left" ? 50 : direction === "right" ? -50 : 0;
  const initialY = direction === "top" ? 50 : direction === "bottom" ? -50 : 0;

  return (
    <motion.div
      className={`absolute ${className}`}
      initial={{ opacity: 0, x: initialX, y: initialY, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
      transition={{
        duration: 0.5,
        delay,
        ease: [0.33, 1, 0.68, 1] as [number, number, number, number],
      }}
    >
      {children}
    </motion.div>
  );
}
