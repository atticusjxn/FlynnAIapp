import { BusinessQuoteForm, QuestionConfig, UploadedFile, PriceEstimate } from '@/lib/supabase';

interface ReviewScreenProps {
  quoteForm: BusinessQuoteForm;
  questions: QuestionConfig[];
  answers: Record<string, any>;
  contactDetails: { name: string; phone: string; email?: string; address?: string };
  uploadedFiles: UploadedFile[];
  estimate: PriceEstimate | null;
  onSubmit: () => void;
  onBack: () => void;
  isSubmitting: boolean;
  primaryColor: string;
}

export default function ReviewScreen({
  quoteForm,
  questions,
  answers,
  contactDetails,
  uploadedFiles,
  estimate,
  onSubmit,
  onBack,
  isSubmitting,
  primaryColor,
}: ReviewScreenProps) {
  const formatAnswer = (question: QuestionConfig, answer: any): string => {
    if (answer === null || answer === undefined) return 'Not answered';

    switch (question.type) {
      case 'yes_no':
        return answer ? 'Yes' : 'No';

      case 'single_choice':
        const option = question.options?.find((opt) => opt.value === answer);
        return option?.label || answer;

      case 'multi_select':
        const selected = question.options?.filter((opt) =>
          Array.isArray(answer) && answer.includes(opt.value)
        );
        return selected?.map((opt) => opt.label).join(', ') || answer;

      case 'number':
        return `${answer}${question.unit ? ' ' + question.unit : ''}`;

      default:
        return String(answer);
    }
  };

  const formatEstimate = (est: PriceEstimate): string => {
    const symbol = '$';

    if (est.mode === 'range') {
      if (est.min === est.max) {
        return `${symbol}${Math.round(est.min).toLocaleString()}`;
      }
      return `${symbol}${Math.round(est.min).toLocaleString()} – ${symbol}${Math.round(
        est.max
      ).toLocaleString()}`;
    } else if (est.mode === 'starting_from') {
      return `From ${symbol}${Math.round(est.min).toLocaleString()}`;
    }

    return '';
  };

  return (
    <div className="flynn-card">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Review Your Quote Request</h2>

      {/* Contact Details */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Contact Information</h3>
        <div className="space-y-2 text-sm">
          <p>
            <span className="font-semibold">Name:</span> {contactDetails.name}
          </p>
          <p>
            <span className="font-semibold">Phone:</span> {contactDetails.phone}
          </p>
          {contactDetails.email && (
            <p>
              <span className="font-semibold">Email:</span> {contactDetails.email}
            </p>
          )}
          {contactDetails.address && (
            <p>
              <span className="font-semibold">Address:</span> {contactDetails.address}
            </p>
          )}
        </div>
      </div>

      {/* Answers */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Your Answers</h3>
        <div className="space-y-3">
          {questions.map((q) => (
            <div key={q.id} className="text-sm">
              <p className="font-semibold text-gray-900">{q.question}</p>
              <p className="text-gray-600">{formatAnswer(q, answers[q.id])}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Uploaded Files */}
      {uploadedFiles.length > 0 && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            Uploaded Files ({uploadedFiles.length})
          </h3>
          <div className="grid grid-cols-4 gap-2">
            {uploadedFiles.map((file) => (
              <div key={file.id} className="aspect-square rounded-lg overflow-hidden bg-gray-200">
                {file.type === 'photo' ? (
                  <img src={file.preview} alt="Upload" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-2xl">
                    🎥
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Price Estimate */}
      {estimate && estimate.showToCustomer && (
        <div className="mb-6 p-4 border-2 rounded-lg" style={{ borderColor: primaryColor }}>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold" style={{ color: primaryColor }}>
              Estimated Price
            </h3>
            <p className="text-2xl font-bold" style={{ color: primaryColor }}>
              {formatEstimate(estimate)}
            </p>
          </div>
          <p className="text-xs text-gray-600">{estimate.disclaimer}</p>
        </div>
      )}

      {/* Submit */}
      <div className="flex items-center space-x-3">
        <button
          type="button"
          onClick={onBack}
          disabled={isSubmitting}
          className="flynn-button-secondary"
        >
          Back
        </button>
        <button
          onClick={onSubmit}
          disabled={isSubmitting}
          className="flynn-button-primary flex-1"
          style={{ backgroundColor: primaryColor }}
        >
          {isSubmitting ? 'Submitting...' : 'Submit Quote Request'}
        </button>
      </div>
    </div>
  );
}
