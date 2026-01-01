import { BusinessQuoteForm } from '@/lib/supabase';
import Image from 'next/image';

interface IntroScreenProps {
  quoteForm: BusinessQuoteForm;
  onStart: () => void;
  primaryColor: string;
}

export default function IntroScreen({ quoteForm, onStart, primaryColor }: IntroScreenProps) {
  return (
    <div className="flynn-card max-w-xl mx-auto text-center">
      {/* Logo */}
      {quoteForm.logo_url && (
        <div className="mb-6 flex justify-center">
          <div className="relative w-20 h-20 rounded-full overflow-hidden bg-gray-100">
            <Image
              src={quoteForm.logo_url}
              alt={quoteForm.title}
              fill
              className="object-cover"
            />
          </div>
        </div>
      )}

      {/* Title */}
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4">
        {quoteForm.title}
      </h1>

      {/* Description */}
      {quoteForm.description && (
        <p className="text-base sm:text-lg text-gray-600 mb-6">
          {quoteForm.description}
        </p>
      )}

      {/* Trust Signal */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8">
        <p className="text-sm text-gray-700">
          📱 This goes straight to {quoteForm.title.split(' ')[0]}.
          We&apos;ll respond quickly with your quote.
        </p>
      </div>

      {/* What to Expect */}
      <div className="text-left mb-8 space-y-3">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">What to expect:</h2>

        <div className="flex items-start space-x-3">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-white font-semibold"
            style={{ backgroundColor: primaryColor }}
          >
            1
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Answer a few questions</p>
            <p className="text-sm text-gray-600">Help us understand your needs</p>
          </div>
        </div>

        {quoteForm.allow_media_upload && (
          <div className="flex items-start space-x-3">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-white font-semibold"
              style={{ backgroundColor: primaryColor }}
            >
              2
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Upload photos (optional)</p>
              <p className="text-sm text-gray-600">Show us what you need done</p>
            </div>
          </div>
        )}

        <div className="flex items-start space-x-3">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-white font-semibold"
            style={{ backgroundColor: primaryColor }}
          >
            {quoteForm.allow_media_upload ? '3' : '2'}
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Get your quote</p>
            <p className="text-sm text-gray-600">We&apos;ll respond with pricing and next steps</p>
          </div>
        </div>
      </div>

      {/* CTA Button */}
      <button
        onClick={onStart}
        className="flynn-button-primary w-full"
        style={{ backgroundColor: primaryColor }}
      >
        Get Started
      </button>

      {/* Estimated Time */}
      <p className="text-xs text-gray-500 mt-4">
        Takes about 2-3 minutes to complete
      </p>

      {/* Disclaimer */}
      {quoteForm.disclaimer && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <p className="text-xs text-gray-500">{quoteForm.disclaimer}</p>
        </div>
      )}
    </div>
  );
}
