"use client";

import { Phone, Clock } from "lucide-react";
import { motion } from "framer-motion";

interface VoicemailCardDemoProps {
  callerName: string;
  callerPhone: string;
  timestamp: string;
  duration: string;
  isNew?: boolean;
  delay?: number;
}

export default function VoicemailCardDemo({
  callerName,
  callerPhone,
  timestamp,
  duration,
  isNew = true,
  delay = 0,
}: VoicemailCardDemoProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay }}
      className="bg-white rounded-xl p-4 shadow-sm border border-gray-200 relative"
    >
      {isNew && (
        <div className="absolute top-3 right-3 w-2 h-2 bg-brand-blue rounded-full" />
      )}

      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-brand-blue/10 flex items-center justify-center flex-shrink-0">
          <Phone className="w-5 h-5 text-brand-blue" />
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="text-base font-bold text-gray-900">{callerName}</h3>
          <p className="text-sm text-gray-600">{callerPhone}</p>

          <div className="flex items-center gap-4 mt-2">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-gray-500" />
              <span className="text-xs text-gray-500">{timestamp}</span>
            </div>
            <span className="text-xs text-gray-500">{duration}</span>
          </div>
        </div>
      </div>

      {isNew && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <span className="text-xs font-semibold text-brand-blue">
            New voicemail • Tap to process
          </span>
        </div>
      )}
    </motion.div>
  );
}
