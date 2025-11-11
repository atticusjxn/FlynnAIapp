"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { Phone, FileText, Calendar, Mail, MessageSquare, Bell } from "lucide-react";
import PhoneMockup from "../ui/PhoneMockup";
import WaveformDemo from "../demo/WaveformDemo";
import Image from "next/image";

export default function ProductShowcase() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  const featureProgress = useTransform(scrollYProgress, [0, 1], [0, 4]);

  // Pre-calculate opacity and z-index transforms to avoid hooks in callbacks
  const feature0Opacity = useTransform(featureProgress, (latest) => {
    const distance = Math.abs(latest - 0);
    return distance < 0.5 ? 1 : 0;
  });

  const feature1Opacity = useTransform(featureProgress, (latest) => {
    const distance = Math.abs(latest - 1);
    return distance < 0.5 ? 1 : 0;
  });

  const feature2Opacity = useTransform(featureProgress, (latest) => {
    const distance = Math.abs(latest - 2);
    return distance < 0.5 ? 1 : 0;
  });

  const feature3Opacity = useTransform(featureProgress, (latest) => {
    const distance = Math.abs(latest - 3);
    return distance < 0.5 ? 1 : 0;
  });

  const feature4Opacity = useTransform(featureProgress, (latest) => {
    const distance = Math.abs(latest - 4);
    return distance < 0.5 ? 1 : 0;
  });

  const featureOpacities = [feature0Opacity, feature1Opacity, feature2Opacity, feature3Opacity, feature4Opacity];

  const feature0Visibility = useTransform(feature0Opacity, (value) => (value > 0 ? "visible" : "hidden"));
  const feature1Visibility = useTransform(feature1Opacity, (value) => (value > 0 ? "visible" : "hidden"));
  const feature2Visibility = useTransform(feature2Opacity, (value) => (value > 0 ? "visible" : "hidden"));
  const feature3Visibility = useTransform(feature3Opacity, (value) => (value > 0 ? "visible" : "hidden"));
  const feature4Visibility = useTransform(feature4Opacity, (value) => (value > 0 ? "visible" : "hidden"));

  const featureVisibilities = [feature0Visibility, feature1Visibility, feature2Visibility, feature3Visibility, feature4Visibility];

  // Calculate z-index for proper stacking (active feature on top)
  const feature0ZIndex = useTransform(featureProgress, (latest) => {
    const distance = Math.abs(latest - 0);
    return distance < 0.5 ? 10 : 0;
  });

  const feature1ZIndex = useTransform(featureProgress, (latest) => {
    const distance = Math.abs(latest - 1);
    return distance < 0.5 ? 10 : 0;
  });

  const feature2ZIndex = useTransform(featureProgress, (latest) => {
    const distance = Math.abs(latest - 2);
    return distance < 0.5 ? 10 : 0;
  });

  const feature3ZIndex = useTransform(featureProgress, (latest) => {
    const distance = Math.abs(latest - 3);
    return distance < 0.5 ? 10 : 0;
  });

  const feature4ZIndex = useTransform(featureProgress, (latest) => {
    const distance = Math.abs(latest - 4);
    return distance < 0.5 ? 10 : 0;
  });

  const featureZIndices = [feature0ZIndex, feature1ZIndex, feature2ZIndex, feature3ZIndex, feature4ZIndex];

  // Create animation transforms for each feature
  // Feature 0
  const feature0Scale = useTransform(scrollYProgress, [0, 0.05, 0.2, 0.25], [0.9, 1, 1, 0.9]);
  const feature0SlideY = useTransform(scrollYProgress, [0, 0.05, 0.2, 0.25], [20, 0, 0, -20]);

  // Feature 1
  const feature1Scale = useTransform(scrollYProgress, [0.25, 0.3, 0.45, 0.5], [0.9, 1, 1, 0.9]);
  const feature1SlideY = useTransform(scrollYProgress, [0.25, 0.3, 0.45, 0.5], [20, 0, 0, -20]);

  // Feature 2
  const feature2Scale = useTransform(scrollYProgress, [0.5, 0.55, 0.7, 0.75], [0.9, 1, 1, 0.9]);
  const feature2SlideY = useTransform(scrollYProgress, [0.5, 0.55, 0.7, 0.75], [20, 0, 0, -20]);

  // Feature 3
  const feature3Scale = useTransform(scrollYProgress, [0.75, 0.8, 0.95, 1], [0.9, 1, 1, 0.9]);
  const feature3SlideY = useTransform(scrollYProgress, [0.75, 0.8, 0.95, 1], [20, 0, 0, -20]);

  // Feature 4
  const feature4Scale = useTransform(scrollYProgress, [0.9, 0.95, 1, 1], [0.9, 1, 1, 1]);
  const feature4SlideY = useTransform(scrollYProgress, [0.9, 0.95, 1, 1], [20, 0, 0, 0]);

  // Opacity transforms derived from slideY
  const feature0OpacityFromSlide = useTransform(feature0SlideY, [20, 0], [0, 1]);
  const feature1OpacityFromSlide = useTransform(feature1SlideY, [20, 0], [0, 1]);
  const feature2OpacityFromSlide = useTransform(feature2SlideY, [20, 0], [0, 1]);
  const feature3OpacityFromSlide = useTransform(feature3SlideY, [20, 0], [0, 1]);
  const feature4OpacityFromSlide = useTransform(feature4SlideY, [20, 0], [0, 1]);

  const feature0Animations = { scale: feature0Scale, slideY: feature0SlideY, opacity: feature0OpacityFromSlide };
  const feature1Animations = { scale: feature1Scale, slideY: feature1SlideY, opacity: feature1OpacityFromSlide };
  const feature2Animations = { scale: feature2Scale, slideY: feature2SlideY, opacity: feature2OpacityFromSlide };
  const feature3Animations = { scale: feature3Scale, slideY: feature3SlideY, opacity: feature3OpacityFromSlide };
  const feature4Animations = { scale: feature4Scale, slideY: feature4SlideY, opacity: feature4OpacityFromSlide };

  const features = [
    {
      id: 0,
      icon: Phone,
      title: "Voicemail Capture",
      description: "Missed calls forward to Flynn. Your custom greeting plays and callers leave their message—every lead captured automatically.",
      color: "var(--color-brand-blue)",
      screen: (
        <div className="w-full h-full bg-blue-50 p-6 flex flex-col">
          <motion.div
            className="flex items-center justify-between mb-8"
            style={{
              y: feature0Animations.slideY,
              opacity: feature0Animations.opacity
            }}
          >
            <div className="text-xs font-semibold text-[var(--color-navy)]">Voicemail Recording</div>
            <div className="text-xs text-[var(--color-gray-600)]">1:23</div>
          </motion.div>

          <div className="flex-1 flex flex-col items-center justify-center">
            <motion.div
              className="w-20 h-20 rounded-full bg-brand-blue/10 flex items-center justify-center mb-4"
              style={{ scale: feature0Animations.scale }}
            >
              <Phone className="w-10 h-10 text-brand-blue" />
            </motion.div>
            <motion.div
              className="text-sm font-bold text-[var(--color-navy)] mb-1"
              style={{
                y: feature0Animations.slideY,
                opacity: feature0Animations.opacity
              }}
            >
              John Smith
            </motion.div>
            <motion.div
              className="text-xs text-[var(--color-gray-600)] mb-6"
              style={{
                y: feature0Animations.slideY,
                opacity: feature0Animations.opacity
              }}
            >
              +1 (555) 123-4567
            </motion.div>

            <motion.div
              style={{ scale: feature0Animations.scale }}
            >
              <WaveformDemo />
            </motion.div>

            <motion.div
              className="mt-6 text-xs text-center text-[var(--color-gray-600)]"
              style={{
                y: feature0Animations.slideY,
                opacity: feature0Animations.opacity
              }}
            >
              Recording captured
            </motion.div>
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
          <motion.div
            className="bg-white rounded-lg p-4 shadow-sm mb-3"
            style={{
              y: feature1Animations.slideY,
              opacity: feature1Animations.opacity
            }}
          >
            <div className="text-xs font-semibold text-[var(--color-navy)] mb-3">Voicemail Transcript</div>
            <div className="space-y-3 text-xs">
              <p className="text-[var(--color-gray-700)]">
                &quot;Hi, this is John Smith calling. I have a leaking pipe under my kitchen sink that needs urgent repair. Can you come tomorrow around 2 PM? My address is 123 Main Street. Call me back at 555-123-4567. Thanks.&quot;
              </p>
            </div>
          </motion.div>

          <motion.div
            className="bg-white rounded-lg p-4 shadow-sm"
            style={{
              scale: feature1Animations.scale,
              y: feature1Animations.slideY,
              opacity: feature1Animations.opacity
            }}
          >
            <div className="text-xs font-semibold text-[var(--color-navy)] mb-3">Extracted Details</div>
            <div className="space-y-2 text-xs">
              <div className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-success mt-1.5 flex-shrink-0" />
                <div><span className="font-semibold">Client:</span> John Smith</div>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-success mt-1.5 flex-shrink-0" />
                <div><span className="font-semibold">Phone:</span> +1 (555) 123-4567</div>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-success mt-1.5 flex-shrink-0" />
                <div><span className="font-semibold">Service:</span> Plumbing - Leaking pipe repair</div>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-success mt-1.5 flex-shrink-0" />
                <div><span className="font-semibold">When:</span> Tomorrow at 2:00 PM</div>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-success mt-1.5 flex-shrink-0" />
                <div><span className="font-semibold">Location:</span> 123 Main Street</div>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-success mt-1.5 flex-shrink-0" />
                <div><span className="font-semibold">Urgency:</span> High</div>
              </div>
            </div>
          </motion.div>
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
          <motion.div
            className="bg-white rounded-lg p-4 shadow-sm mb-3"
            style={{
              scale: feature2Animations.scale,
              y: feature2Animations.slideY,
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm font-bold text-[var(--color-navy)]">Tomorrow</div>
              <div className="text-xs text-[var(--color-gray-600)]">Oct 21</div>
            </div>

            <div className="space-y-3">
              <motion.div
                className="flex gap-3"
                style={{
                  opacity: feature2Animations.opacity
                }}
              >
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
              </motion.div>
            </div>
          </motion.div>

          <div className="space-y-2">
            <motion.div
              className="bg-success/10 border border-success/20 rounded-lg p-3"
              style={{
                y: feature2Animations.slideY,
                opacity: feature2Animations.opacity
              }}
            >
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center flex-shrink-0">
                  <Image
                    src="/assets/GoogleCalendar.png"
                    alt="Google Calendar"
                    width={32}
                    height={32}
                    className="rounded-sm"
                  />
                </div>
                <div className="text-xs text-success font-semibold">Synced to Google Calendar</div>
              </div>
            </motion.div>

            <motion.div
              className="bg-blue-50 border border-blue-200 rounded-lg p-3"
              style={{
                y: feature2Animations.slideY,
                opacity: feature2Animations.opacity
              }}
            >
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-brand-blue/20 flex items-center justify-center">
                  <Bell className="w-3.5 h-3.5 text-brand-blue" />
                </div>
                <div className="text-xs text-brand-blue font-semibold">Reminder set for 1:45 PM</div>
              </div>
            </motion.div>
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
          <motion.div
            className="bg-white rounded-lg shadow-sm overflow-hidden"
            style={{
              scale: feature3Animations.scale,
              y: feature3Animations.slideY,
            }}
          >
            {/* Email header */}
            <motion.div
              className="bg-[var(--color-brand-blue)] p-3"
              style={{
                opacity: feature3Animations.opacity
              }}
            >
              <div className="text-xs font-semibold text-white">Appointment Confirmed</div>
            </motion.div>

            {/* Email body */}
            <div className="p-4 text-xs space-y-3">
              <motion.div
                style={{
                  y: feature3Animations.slideY,
                  opacity: feature3Animations.opacity
                }}
              >
                <div className="font-semibold text-[var(--color-navy)]">Hi John,</div>
                <p className="mt-2 text-[var(--color-gray-700)]">
                  Thank you for reaching out! I&apos;ve received your voicemail about the leaking pipe repair.
                </p>
              </motion.div>

              <motion.div
                className="bg-gray-50 rounded-lg p-3 space-y-2"
                style={{
                  y: feature3Animations.slideY,
                  opacity: feature3Animations.opacity
                }}
              >
                <div className="font-semibold text-[var(--color-navy)]">Appointment Details:</div>
                <div className="text-[var(--color-gray-700)]">
                  <div><span className="font-semibold">Date:</span> Tomorrow</div>
                  <div><span className="font-semibold">Time:</span> 2:00 PM</div>
                  <div><span className="font-semibold">Location:</span> 123 Main Street</div>
                  <div><span className="font-semibold">Service:</span> Plumbing repair</div>
                </div>
              </motion.div>

              <motion.p
                className="text-[var(--color-gray-700)]"
                style={{
                  y: feature3Animations.slideY,
                  opacity: feature3Animations.opacity
                }}
              >
                I&apos;ll see you tomorrow at 2 PM. If you need to reschedule, please let me know.
              </motion.p>

              <motion.div
                className="text-[var(--color-gray-600)] text-[10px]"
                style={{
                  y: feature3Animations.slideY,
                  opacity: feature3Animations.opacity
                }}
              >
                Sent from Flynn AI
              </motion.div>
            </div>
          </motion.div>
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
            <motion.div
              className="flex justify-start"
              style={{
                y: feature4Animations.slideY,
                opacity: feature4Animations.opacity
              }}
            >
              <div className="bg-white rounded-2xl rounded-tl-sm p-3 shadow-sm max-w-[80%]">
                <div className="text-xs text-[var(--color-gray-700)]">
                  Hi, this is John Smith. I have a leaking pipe that needs urgent repair. Can you come tomorrow around 2 PM? 123 Main St.
                </div>
                <div className="text-[10px] text-[var(--color-gray-500)] mt-1">2:34 PM</div>
              </div>
            </motion.div>

            {/* Outgoing confirmation */}
            <motion.div
              className="flex justify-end"
              style={{
                y: feature4Animations.slideY,
                opacity: feature4Animations.opacity
              }}
            >
              <div className="bg-brand-blue rounded-2xl rounded-tr-sm p-3 shadow-sm max-w-[80%]">
                <div className="text-xs text-white">
                  Thanks John! Confirmed for tomorrow at 2 PM. I&apos;ll see you at 123 Main Street for the plumbing repair. 👍
                </div>
                <div className="text-[10px] text-blue-200 mt-1 text-right">2:36 PM</div>
              </div>
            </motion.div>
          </div>

          <motion.div
            className="bg-brand-blue/10 rounded-lg p-2 flex items-center gap-2"
            style={{
              y: feature4Animations.slideY,
              opacity: feature4Animations.opacity
            }}
          >
            <MessageSquare className="w-4 h-4 text-brand-blue" />
            <input
              type="text"
              placeholder="Type a message..."
              className="flex-1 bg-transparent text-xs outline-none"
              disabled
            />
          </motion.div>
        </div>
      ),
    },
  ];

  return (
    <div ref={containerRef} className="relative h-[500vh] bg-[var(--color-gray-50)]">
      <div className="sticky top-0 h-screen flex items-center overflow-hidden">
        <div className="container">
          <div className="grid gap-12 items-center lg:grid-cols-2">
            {/* Left - Descriptions */}
            <div className="relative min-h-[360px] sm:min-h-[420px] lg:min-h-0">
              {features.map((feature, index) => {
                const Icon = feature.icon;
                return (
                  <motion.div
                    key={feature.id}
                    style={{
                      opacity: featureOpacities[index],
                      zIndex: featureZIndices[index],
                      visibility: featureVisibilities[index]
                    }}
                    className="absolute inset-0 pointer-events-none bg-[var(--color-gray-50)]"
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
            <div className="flex items-center justify-center mt-12 lg:mt-0">
              <PhoneMockup>
                {features.map((feature, index) => (
                  <motion.div
                    key={feature.id}
                    style={{
                      opacity: featureOpacities[index],
                      zIndex: featureZIndices[index],
                      visibility: featureVisibilities[index]
                    }}
                    className="absolute inset-0 pointer-events-none"
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
