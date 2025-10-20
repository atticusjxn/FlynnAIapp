"use client";

import { Calendar, Clock, MapPin, Mic } from "lucide-react";
import { motion } from "framer-motion";

interface JobCardDemoProps {
  clientName: string;
  serviceType: string;
  description: string;
  date: string;
  time: string;
  location: string;
  status: "pending" | "in-progress" | "complete";
  source?: "voicemail" | "upload" | "manual";
  transcript?: string;
  delay?: number;
}

export default function JobCardDemo({
  clientName,
  serviceType,
  description,
  date,
  time,
  location,
  status,
  source,
  transcript,
  delay = 0,
}: JobCardDemoProps) {
  const statusColors = {
    pending: {
      bg: "bg-warning-light",
      text: "text-[#92400e]",
      border: "border-warning",
    },
    "in-progress": {
      bg: "bg-blue-50",
      text: "text-brand-blue",
      border: "border-brand-blue",
    },
    complete: {
      bg: "bg-success-light",
      text: "text-[#065f46]",
      border: "border-success",
    },
  };

  const sourceInfo = {
    voicemail: {
      label: "Voicemail lead",
      bg: "bg-[#fef3c7]",
      text: "text-[#92400e]",
    },
    upload: {
      label: "Screenshot import",
      bg: "bg-[#e0f2fe]",
      text: "text-[#0369a1]",
    },
    manual: {
      label: "Manual entry",
      bg: "bg-gray-100",
      text: "text-gray-600",
    },
  };

  const colors = statusColors[status];
  const sourceColor = source ? sourceInfo[source] : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      className="bg-white rounded-xl p-4 shadow-sm border border-gray-200"
    >
      {/* Header */}
      <div className="flex justify-between items-start mb-2">
        <div className="flex-1">
          <h3 className="text-base font-bold text-gray-900">{clientName}</h3>
          <p className="text-sm text-gray-600 font-semibold">{serviceType}</p>
        </div>
        <div
          className={`px-3 py-1 rounded-full border ${colors.bg} ${colors.text} ${colors.border}`}
        >
          <span className="text-[11px] font-semibold capitalize">
            {status === "in-progress" ? "In Progress" : status}
          </span>
        </div>
      </div>

      {/* Source badge */}
      {sourceColor && (
        <div
          className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full mb-2 ${sourceColor.bg}`}
        >
          <Mic className={`w-3.5 h-3.5 ${sourceColor.text}`} />
          <span className={`text-[11px] font-semibold ${sourceColor.text}`}>
            {sourceColor.label}
          </span>
        </div>
      )}

      {/* Description */}
      <p className="text-sm text-gray-600 mb-3 line-clamp-2">{description}</p>

      {/* Transcript snippet */}
      {transcript && (
        <p className="text-xs italic text-gray-500 mb-3 line-clamp-2">
          &quot;{transcript}&quot;
        </p>
      )}

      {/* Date/Time */}
      <div className="flex items-center gap-4 mb-2">
        <div className="flex items-center gap-1.5">
          <Calendar className="w-4 h-4 text-gray-500" />
          <span className="text-sm text-gray-600 font-medium">{date}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock className="w-4 h-4 text-gray-500" />
          <span className="text-sm text-gray-600">{time}</span>
        </div>
      </div>

      {/* Location */}
      <div className="flex items-center gap-1.5">
        <MapPin className="w-4 h-4 text-gray-500" />
        <span className="text-sm text-gray-500">{location}</span>
      </div>
    </motion.div>
  );
}
