import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Flynn AI - Turn Missed Calls Into Booked Jobs",
  description: "AI voicemail receptionist that never misses a lead. Forward your missed calls to Flynn, get instant transcripts, organized calendar events, and professional follow-ups within 2 minutes.",
  keywords: ["AI voicemail receptionist", "missed call handling", "voicemail transcription", "calendar automation", "AI receptionist", "lead capture"],
  authors: [{ name: "Flynn AI" }],
  openGraph: {
    title: "Flynn AI - Turn Missed Calls Into Booked Jobs",
    description: "AI voicemail receptionist that never misses a lead. Get instant transcripts, calendar events, and follow-ups within 2 minutes.",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Flynn AI - Turn Missed Calls Into Booked Jobs",
    description: "AI voicemail receptionist that never misses a lead. Setup in 10 seconds.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
