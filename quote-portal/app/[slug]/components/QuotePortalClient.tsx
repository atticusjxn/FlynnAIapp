'use client';

import { useState } from 'react';
import { BusinessQuoteForm, PriceGuide, PriceEstimate, UploadedFile } from '@/lib/supabase';
import IntroScreen from './IntroScreen';
import QuestionScreen from './QuestionScreen';
import MediaUploadScreen from './MediaUploadScreen';
import ContactDetailsScreen from './ContactDetailsScreen';
import ReviewScreen from './ReviewScreen';
import ConfirmationScreen from './ConfirmationScreen';
import ProgressBar from './ProgressBar';

interface QuotePortalClientProps {
  quoteForm: BusinessQuoteForm;
  priceGuide: PriceGuide | null;
}

type QuoteStep = 'intro' | 'questions' | 'media' | 'contact' | 'review' | 'confirmation';

export default function QuotePortalClient({ quoteForm, priceGuide }: QuotePortalClientProps) {
  const [step, setStep] = useState<QuoteStep>('intro');
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [contactDetails, setContactDetails] = useState<{
    name: string;
    phone: string;
    email?: string;
    address?: string;
  } | null>(null);
  const [estimate, setEstimate] = useState<PriceEstimate | null>(null);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const primaryColor = quoteForm.primary_color || '#2563EB';
  const sortedQuestions = [...quoteForm.questions].sort((a, b) => a.order - b.order);

  // Calculate progress percentage
  const getProgress = (): number => {
    const steps: QuoteStep[] = ['intro', 'questions', 'media', 'contact', 'review'];
    const currentIndex = steps.indexOf(step);
    return Math.round(((currentIndex + 1) / steps.length) * 100);
  };

  // Check if question should be shown based on conditional logic
  const shouldShowQuestion = (question: any): boolean => {
    if (!question.showIf) return true;

    const { questionId, operator, value } = question.showIf;
    const answer = answers[questionId];

    if (answer === null || answer === undefined) return false;

    switch (operator) {
      case 'equals':
        return answer === value;
      case 'contains':
        if (Array.isArray(answer)) {
          return answer.includes(value);
        }
        return String(answer).toLowerCase().includes(String(value).toLowerCase());
      case 'greater_than':
        return Number(answer) > Number(value);
      case 'less_than':
        return Number(answer) < Number(value);
      default:
        return true;
    }
  };

  // Get visible questions (after conditional logic)
  const visibleQuestions = sortedQuestions.filter(shouldShowQuestion);

  const handleStartQuote = () => {
    setStep('questions');
  };

  const handleAnswersComplete = (newAnswers: Record<string, any>) => {
    setAnswers(newAnswers);

    // Calculate price estimate if price guide exists
    if (priceGuide && priceGuide.show_to_customer) {
      const calculatedEstimate = calculateEstimate(newAnswers, priceGuide);
      setEstimate(calculatedEstimate);
    }

    // Move to media upload if allowed, otherwise go to contact details
    if (quoteForm.allow_media_upload) {
      setStep('media');
    } else {
      setStep('contact');
    }
  };

  const handleMediaComplete = (files: UploadedFile[]) => {
    setUploadedFiles(files);
    setStep('contact');
  };

  const handleSkipMedia = () => {
    setStep('contact');
  };

  const handleContactComplete = (details: {
    name: string;
    phone: string;
    email?: string;
    address?: string;
  }) => {
    setContactDetails(details);
    setStep('review');
  };

  const handleSubmit = async () => {
    if (!contactDetails) return;

    setIsSubmitting(true);

    try {
      // Submit quote request
      const response = await fetch('/api/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          form_id: quoteForm.id,
          org_id: quoteForm.org_id,
          customer_name: contactDetails.name,
          customer_phone: contactDetails.phone,
          customer_email: contactDetails.email,
          customer_address: contactDetails.address,
          answers,
          form_version: quoteForm.version,
          uploaded_files: uploadedFiles.filter((f) => f.status === 'completed').map((f) => f.id),
          estimate: estimate
            ? {
                min: estimate.min,
                max: estimate.max,
                shown_to_customer: estimate.showToCustomer,
                rules_applied: estimate.appliedRules,
              }
            : null,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit quote request');
      }

      const result = await response.json();
      setSubmissionId(result.submission_id);
      setStep('confirmation');
    } catch (error) {
      console.error('Error submitting quote:', error);
      alert('Failed to submit your quote request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    if (step === 'questions') {
      setStep('intro');
    } else if (step === 'media') {
      setStep('questions');
    } else if (step === 'contact') {
      if (quoteForm.allow_media_upload) {
        setStep('media');
      } else {
        setStep('questions');
      }
    } else if (step === 'review') {
      setStep('contact');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <style jsx global>{`
        :root {
          --primary-color: ${primaryColor};
        }
      `}</style>

      {/* Progress Bar */}
      {step !== 'intro' && step !== 'confirmation' && (
        <ProgressBar progress={getProgress()} primaryColor={primaryColor} />
      )}

      {/* Main Content */}
      <div className="max-w-2xl mx-auto px-4 py-6 sm:py-8">
        {step === 'intro' && (
          <IntroScreen
            quoteForm={quoteForm}
            onStart={handleStartQuote}
            primaryColor={primaryColor}
          />
        )}

        {step === 'questions' && (
          <QuestionScreen
            questions={visibleQuestions}
            initialAnswers={answers}
            onComplete={handleAnswersComplete}
            onBack={handleBack}
            primaryColor={primaryColor}
          />
        )}

        {step === 'media' && (
          <MediaUploadScreen
            maxPhotos={quoteForm.max_photos}
            maxVideos={quoteForm.max_videos}
            initialFiles={uploadedFiles}
            onComplete={handleMediaComplete}
            onSkip={handleSkipMedia}
            onBack={handleBack}
            primaryColor={primaryColor}
          />
        )}

        {step === 'contact' && (
          <ContactDetailsScreen
            requirePhone={quoteForm.require_phone}
            requireEmail={quoteForm.require_email}
            initialDetails={contactDetails}
            onComplete={handleContactComplete}
            onBack={handleBack}
            primaryColor={primaryColor}
          />
        )}

        {step === 'review' && contactDetails && (
          <ReviewScreen
            quoteForm={quoteForm}
            questions={visibleQuestions}
            answers={answers}
            contactDetails={contactDetails}
            uploadedFiles={uploadedFiles}
            estimate={estimate}
            onSubmit={handleSubmit}
            onBack={handleBack}
            isSubmitting={isSubmitting}
            primaryColor={primaryColor}
          />
        )}

        {step === 'confirmation' && (
          <ConfirmationScreen
            quoteForm={quoteForm}
            estimate={estimate}
            primaryColor={primaryColor}
          />
        )}
      </div>

      {/* Footer */}
      {step !== 'confirmation' && (
        <footer className="mt-12 pb-8 text-center text-sm text-gray-500">
          <p>
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
        </footer>
      )}
    </div>
  );
}

// Price estimation calculation (matches backend logic)
function calculateEstimate(
  answers: Record<string, any>,
  priceGuide: PriceGuide
): PriceEstimate {
  let min = priceGuide.base_price || 0;
  let max = priceGuide.base_price || 0;

  if (priceGuide.base_callout_fee) {
    min += priceGuide.base_callout_fee;
    max += priceGuide.base_callout_fee;
  }

  const appliedRules: Array<{
    ruleName: string;
    adjustment: number | { min: number; max: number };
    note?: string;
  }> = [];

  const sortedRules = [...priceGuide.rules]
    .filter((rule) => rule.enabled)
    .sort((a, b) => a.order - b.order);

  for (const rule of sortedRules) {
    const answer = answers[rule.condition.questionId];

    if (evaluateCondition(answer, rule.condition)) {
      const result = applyRuleAction(min, max, rule);
      min = result.newMin;
      max = result.newMax;

      appliedRules.push({
        ruleName: rule.name,
        adjustment: rule.action.value,
        note: rule.action.note,
      });
    }
  }

  if (priceGuide.min_price !== null) {
    min = Math.max(min, priceGuide.min_price);
    max = Math.max(max, priceGuide.min_price);
  }

  if (priceGuide.max_price !== null) {
    min = Math.min(min, priceGuide.max_price);
    max = Math.min(max, priceGuide.max_price);
  }

  if (min > max) {
    max = min;
  }

  return {
    min,
    max,
    appliedRules,
    mode: priceGuide.estimate_mode,
    disclaimer: priceGuide.disclaimer,
    showToCustomer: priceGuide.show_to_customer,
  };
}

function evaluateCondition(answer: any, condition: any): boolean {
  const { operator, value } = condition;

  if (answer === null || answer === undefined) {
    return false;
  }

  switch (operator) {
    case 'equals':
      if (typeof answer === 'boolean') {
        return answer === value;
      }
      return String(answer) === String(value);

    case 'contains':
      if (Array.isArray(answer)) {
        return answer.includes(value);
      }
      return String(answer).toLowerCase().includes(String(value).toLowerCase());

    case 'greater_than':
      return Number(answer) > Number(value);

    case 'less_than':
      return Number(answer) < Number(value);

    case 'between':
      if (Array.isArray(value) && value.length === 2) {
        const numAnswer = Number(answer);
        return numAnswer >= Number(value[0]) && numAnswer <= Number(value[1]);
      }
      return false;

    default:
      return false;
  }
}

function applyRuleAction(
  currentMin: number,
  currentMax: number,
  rule: any
): { newMin: number; newMax: number } {
  const { action } = rule;

  switch (action.type) {
    case 'add':
      return {
        newMin: currentMin + Number(action.value),
        newMax: currentMax + Number(action.value),
      };

    case 'multiply':
      return {
        newMin: currentMin * Number(action.value),
        newMax: currentMax * Number(action.value),
      };

    case 'set_band':
      if (typeof action.value === 'object' && 'min' in action.value && 'max' in action.value) {
        return {
          newMin: action.value.min,
          newMax: action.value.max,
        };
      }
      return {
        newMin: Number(action.value),
        newMax: Number(action.value),
      };

    default:
      return { newMin: currentMin, newMax: currentMax };
  }
}
