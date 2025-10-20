"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { Phone, FileText, Calendar, Mail, MessageSquare } from "lucide-react";
import PhoneMockup from "../ui/PhoneMockup";
import VoicemailCardDemo from "../demo/VoicemailCardDemo";
import JobCardDemo from "../demo/JobCardDemo";
import WaveformDemo from "../demo/WaveformDemo";

export default function ProductShowcase() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  const featureProgress = useTransform(scrollYProgress, [0, 1], [0, 4]);

  // Pre-calculate opacity transforms to avoid hooks in callbacks
  const feature0Opacity = useTransform(featureProgress, (latest) => {
    const distance = Math.abs(latest - 0);
    if (distance < 0.5) return 1;
    if (distance < 1) return 0.3;
    return 0;
  });

  const feature1Opacity = useTransform(featureProgress, (latest) => {
    const distance = Math.abs(latest - 1);
    if (distance < 0.5) return 1;
    if (distance < 1) return 0.3;
    return 0;
  });

  const feature2Opacity = useTransform(featureProgress, (latest) => {
    const distance = Math.abs(latest - 2);
    if (distance < 0.5) return 1;
    if (distance < 1) return 0.3;
    return 0;
  });

  const feature3Opacity = useTransform(featureProgress, (latest) => {
    const distance = Math.abs(latest - 3);
    if (distance < 0.5) return 1;
    if (distance < 1) return 0.3;
    return 0;
  });

  const feature4Opacity = useTransform(featureProgress, (latest) => {
    const distance = Math.abs(latest - 4);
    if (distance < 0.5) return 1;
    return 0.3;
  });

  const featureOpacities = [feature0Opacity, feature1Opacity, feature2Opacity, feature3Opacity, feature4Opacity];

  const features = [
    {
      id: 0,
      icon: Phone,
      title: "Voicemail Capture",
      description: "Missed calls forward to Flynn. Your custom greeting plays and callers leave their message—every lead captured automatically.",
      color: "var(--color-brand-blue)",
      screen: (
        <div className="w-full h-full bg-blue-50 p-6 flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <div className="text-xs font-semibold text-[var(--color-navy)]">Voicemail Recording</div>
            <div className="text-xs text-[var(--color-gray-600)]">1:23</div>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="w-20 h-20 rounded-full bg-brand-blue/10 flex items-center justify-center mb-4">
              <Phone className="w-10 h-10 text-brand-blue" />
            </div>
            <div className="text-sm font-bold text-[var(--color-navy)] mb-1">John Smith</div>
            <div className="text-xs text-[var(--color-gray-600)] mb-6">+1 (555) 123-4567</div>

            <WaveformDemo />

            <div className="mt-6 text-xs text-center text-[var(--color-gray-600)]">
              Recording captured
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 1,
      icon: FileText,
      title: "Smart Event Extraction",
      description: "AI transcribes the voicemail and automatically extracts client details, service needs, dates, times, and locations.",
      color: "var(--color-success)",
      screen: (
        <div className="w-full h-full bg-emerald-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg p-4 shadow-sm mb-3">
            <div className="text-xs font-semibold text-[var(--color-navy)] mb-3">Voicemail Transcript</div>
            <div className="space-y-3 text-xs">
              <p className="text-[var(--color-gray-700)]">
                &quot;Hi, this is John Smith calling. I have a leaking pipe under my kitchen sink that needs urgent repair. Can you come tomorrow around 2 PM? My address is 123 Main Street. Call me back at 555-123-4567. Thanks.&quot;
              </p>
            </div>
          </div>

          <div className="bg-white rounded-lg p-4 shadow-sm">
            <div className="text-xs font-semibold text-[var(--color-navy)] mb-3">Extracted Details</div>
            <div className="space-y-2 text-xs">
              <div className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-success mt-1.5 flex-shrink-0" />
                <div>
                  <span className="font-semibold">Client:</span> John Smith
                </div>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-success mt-1.5 flex-shrink-0" />
                <div>
                  <span className="font-semibold">Phone:</span> +1 (555) 123-4567
                </div>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-success mt-1.5 flex-shrink-0" />
                <div>
                  <span className="font-semibold">Service:</span> Plumbing - Leaking pipe repair
                </div>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-success mt-1.5 flex-shrink-0" />
                <div>
                  <span className="font-semibold">When:</span> Tomorrow at 2:00 PM
                </div>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-success mt-1.5 flex-shrink-0" />
                <div>
                  <span className="font-semibold">Location:</span> 123 Main Street
                </div>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-success mt-1.5 flex-shrink-0" />
                <div>
                  <span className="font-semibold">Urgency:</span> High
                </div>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 2,
      icon: Calendar,
      title: "Instant Calendar Sync",
      description: "Events automatically sync to your Google Calendar, Outlook, or Apple Calendar in real-time.",
      color: "var(--color-brand-blue)",
      screen: (
        <div className="w-full h-full bg-sky-50 p-4">
          <div className="bg-white rounded-lg p-4 shadow-sm mb-3">
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm font-bold text-[var(--color-navy)]">Tomorrow</div>
              <div className="text-xs text-[var(--color-gray-600)]">Oct 21</div>
            </div>

            <div className="space-y-3">
              <div className="flex gap-3">
                <div className="text-center min-w-[40px]">
                  <div className="text-xs text-[var(--color-gray-600)]">2:00</div>
                  <div className="text-xs text-[var(--color-gray-600)]">PM</div>
                </div>
                <div className="flex-1 bg-brand-blue/10 border-l-4 border-brand-blue rounded p-2">
                  <div className="text-sm font-bold text-[var(--color-navy)]">Plumbing Repair</div>
                  <div className="text-xs text-[var(--color-gray-600)]">John Smith</div>
                  <div className="text-xs text-[var(--color-gray-600)] mt-1">123 Main Street</div>
                  <div className="inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-full bg-[#fef3c7] text-[11px] font-semibold text-[#92400e]">
                    <span className="w-1 h-1 rounded-full bg-[#92400e]" />
                    From voicemail
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-success/10 border border-success/20 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-success/20 flex items-center justify-center">
                <Calendar className="w-3.5 h-3.5 text-success" />
              </div>
              <div className="text-xs text-success font-semibold">Synced to Google Calendar</div>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 3,
      icon: Mail,
      title: "Professional Email Summary",
      description: "Beautiful, branded emails sent to you and your client with all the details within 2 minutes.",
      color: "var(--color-warning)",
      screen: (
        <div className="w-full h-full bg-amber-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            {/* Email header */}
            <div className="bg-[var(--color-brand-blue)] p-3">
              <div className="text-xs font-semibold text-white">Appointment Confirmed</div>
            </div>

            {/* Email body */}
            <div className="p-4 text-xs space-y-3">
              <div>
                <div className="font-semibold text-[var(--color-navy)]">Hi John,</div>
                <p className="mt-2 text-[var(--color-gray-700)]">
                  Thank you for reaching out! I&apos;ve received your voicemail about the leaking pipe repair.
                </p>
              </div>

              <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                <div className="font-semibold text-[var(--color-navy)]">Appointment Details:</div>
                <div className="text-[var(--color-gray-700)]">
                  <div><span className="font-semibold">Date:</span> Tomorrow</div>
                  <div><span className="font-semibold">Time:</span> 2:00 PM</div>
                  <div><span className="font-semibold">Location:</span> 123 Main Street</div>
                  <div><span className="font-semibold">Service:</span> Plumbing repair</div>
                </div>
              </div>

              <p className="text-[var(--color-gray-700)]">
                I&apos;ll see you tomorrow at 2 PM. If you need to reschedule, please let me know.
              </p>

              <div className="text-[var(--color-gray-600)] text-[10px]">
                Sent from Flynn AI
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 4,
      icon: MessageSquare,
      title: "SMS Confirmation",
      description: "Instant text confirmation sent to your phone and your client&apos;s phone automatically.",
      color: "var(--color-brand-blue)",
      screen: (
        <div className="w-full h-full bg-violet-50 p-4 flex flex-col justify-end">
          <div className="space-y-3 mb-4">
            {/* Incoming message */}
            <div className="flex justify-start">
              <div className="bg-white rounded-2xl rounded-tl-sm p-3 shadow-sm max-w-[80%]">
                <div className="text-xs text-[var(--color-gray-700)]">
                  Hi, this is John Smith. I have a leaking pipe that needs urgent repair. Can you come tomorrow around 2 PM? 123 Main St.
                </div>
                <div className="text-[10px] text-[var(--color-gray-500)] mt-1">2:34 PM</div>
              </div>
            </div>

            {/* Outgoing confirmation */}
            <div className="flex justify-end">
              <div className="bg-brand-blue rounded-2xl rounded-tr-sm p-3 shadow-sm max-w-[80%]">
                <div className="text-xs text-white">
                  Thanks John! Confirmed for tomorrow at 2 PM. I&apos;ll see you at 123 Main Street for the plumbing repair. 👍
                </div>
                <div className="text-[10px] text-blue-200 mt-1 text-right">2:36 PM</div>
              </div>
            </div>
          </div>

          <div className="bg-brand-blue/10 rounded-lg p-2 flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-brand-blue" />
            <input
              type="text"
              placeholder="Type a message..."
              className="flex-1 bg-transparent text-xs outline-none"
              disabled
            />
          </div>
        </div>
      ),
    },
  ];

  return (
    <div ref={containerRef} className="relative h-[500vh] bg-[var(--color-gray-50)]">
      <div className="sticky top-0 h-screen flex items-center overflow-hidden">
        <div className="container">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left - Descriptions */}
            <div className="relative">
              {features.map((feature, index) => {
                const Icon = feature.icon;
                return (
                  <motion.div
                    key={feature.id}
                    style={{ opacity: featureOpacities[index] }}
                    className="absolute inset-0"
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 rounded-xl bg-[var(--color-brand-blue)]/10 flex items-center justify-center">
                        <Icon className="w-6 h-6 text-[var(--color-brand-blue)]" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-[var(--color-gray-600)]">
                          Step {index + 1} of 5
                        </div>
                      </div>
                    </div>
                    <h2 className="text-3xl md:text-4xl font-bold text-[var(--color-navy)] mb-4">
                      {feature.title}
                    </h2>
                    <p className="text-lg text-[var(--color-charcoal)]">
                      {feature.description}
                    </p>
                  </motion.div>
                );
              })}
            </div>

            {/* Right - Phone Mockup */}
            <div className="flex items-center justify-center">
              <PhoneMockup>
                {features.map((feature, index) => (
                  <motion.div
                    key={feature.id}
                    style={{ opacity: featureOpacities[index] }}
                    className="absolute inset-0"
                  >
                    {feature.screen}
                  </motion.div>
                ))}
              </PhoneMockup>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
