import { BusinessQuoteForm, PriceEstimate } from '@/lib/supabase';

interface ConfirmationScreenProps {
  quoteForm: BusinessQuoteForm;
  estimate: PriceEstimate | null;
  primaryColor: string;
}

export default function ConfirmationScreen({
  quoteForm,
  estimate,
  primaryColor,
}: ConfirmationScreenProps) {
  return (
    <div className="flynn-card max-w-xl mx-auto text-center">
      {/* Success Icon */}
      <div className="mb-6">
        <div
          className="w-20 h-20 mx-auto rounded-full flex items-center justify-center"
          style={{ backgroundColor: `${primaryColor}20` }}
        >
          <span className="text-4xl">✓</span>
        </div>
      </div>

      {/* Title */}
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4">
        Quote Request Received!
      </h1>

      {/* Message */}
      <p className="text-base sm:text-lg text-gray-600 mb-6">
        Thanks for submitting your quote request. {quoteForm.title.split(' ')[0]} will review your
        details and get back to you shortly with a detailed quote.
      </p>

      {/* Estimate Display */}
      {estimate && estimate.showToCustomer && (
        <div className="mb-6 p-4 border-2 rounded-lg" style={{ borderColor: primaryColor }}>
          <p className="text-sm font-semibold text-gray-700 mb-1">Estimated Price</p>
          <p className="text-3xl font-bold mb-2" style={{ color: primaryColor }}>
            {estimate.mode === 'range'
              ? `$${Math.round(estimate.min).toLocaleString()} – $${Math.round(
                  estimate.max
                ).toLocaleString()}`
              : `From $${Math.round(estimate.min).toLocaleString()}`}
          </p>
          <p className="text-xs text-gray-500">{estimate.disclaimer}</p>
        </div>
      )}

      {/* Next Steps */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-left">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">What happens next?</h3>
        <ul className="space-y-2 text-sm text-gray-700">
          <li className="flex items-start">
            <span className="mr-2">1.</span>
            <span>We&apos;ll review your request and any photos you uploaded</span>
          </li>
          <li className="flex items-start">
            <span className="mr-2">2.</span>
            <span>You&apos;ll receive a detailed quote via SMS or email</span>
          </li>
          <li className="flex items-start">
            <span className="mr-2">3.</span>
            <span>We&apos;ll follow up to answer any questions and schedule the work</span>
          </li>
        </ul>
      </div>

      {/* Response Time */}
      <p className="text-sm text-gray-600 mb-6">
        📱 <strong>Expected response time:</strong> Within 24 hours (usually much faster!)
      </p>

      {/* Footer */}
      <div className="pt-6 border-t border-gray-200">
        <p className="text-xs text-gray-500">
          Powered by{' '}
          <a
            href="https://flynnai.app"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold hover:underline"
            style={{ color: primaryColor }}
          >
            Flynn AI
          </a>
        </p>
      </div>
    </div>
  );
}
