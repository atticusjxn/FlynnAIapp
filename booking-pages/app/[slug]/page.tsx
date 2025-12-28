import { notFound } from 'next/navigation';
import { supabase, BookingPage } from '@/lib/supabase';
import BookingPageClient from '@/components/BookingPageClient';

async function getBookingPage(slug: string): Promise<BookingPage | null> {
  const { data, error } = await supabase
    .from('booking_pages')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (error || !data) {
    return null;
  }

  return data as BookingPage;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const bookingPage = await getBookingPage(slug);

  if (!bookingPage) {
    return {
      title: 'Page Not Found',
    };
  }

  return {
    title: `Book an Appointment | ${bookingPage.business_name}`,
    description: `Schedule your appointment with ${bookingPage.business_name}`,
  };
}

export default async function BookingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const bookingPage = await getBookingPage(slug);

  if (!bookingPage) {
    notFound();
  }

  return <BookingPageClient bookingPage={bookingPage} />;
}
