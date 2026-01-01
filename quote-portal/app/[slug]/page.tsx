import { supabase } from '@/lib/supabase';
import QuotePortalClient from './components/QuotePortalClient';
import { notFound } from 'next/navigation';

export const revalidate = 60; // Revalidate every 60 seconds

interface PageProps {
  params: Promise<{ slug: string }>;
}

async function getQuoteForm(slug: string) {
  const { data, error } = await supabase
    .from('business_quote_forms')
    .select('*')
    .eq('slug', slug)
    .eq('is_published', true)
    .single();

  if (error || !data) {
    return null;
  }

  return data;
}

async function getPriceGuide(formId: string) {
  const { data, error } = await supabase
    .from('price_guides')
    .select('*')
    .eq('form_id', formId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return data || null;
}

export default async function QuoteFormPage({ params }: PageProps) {
  const { slug } = await params;
  const quoteForm = await getQuoteForm(slug);

  if (!quoteForm) {
    notFound();
  }

  const priceGuide = await getPriceGuide(quoteForm.id);

  return (
    <QuotePortalClient
      quoteForm={quoteForm}
      priceGuide={priceGuide}
    />
  );
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const quoteForm = await getQuoteForm(slug);

  if (!quoteForm) {
    return {
      title: 'Quote Form Not Found',
    };
  }

  return {
    title: `${quoteForm.title} | Get a Quote`,
    description: quoteForm.description || `Request a quote for ${quoteForm.title}`,
  };
}
