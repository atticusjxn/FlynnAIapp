import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Book an Appointment | Flynn AI',
  description: 'Schedule your appointment easily with our online booking system',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
