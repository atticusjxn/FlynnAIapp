'use client';

import { useState, useEffect } from 'react';
import { QuestionConfig } from '@/lib/supabase';

interface QuestionScreenProps {
  questions: QuestionConfig[];
  initialAnswers: Record<string, any>;
  onComplete: (answers: Record<string, any>) => void;
  onBack: () => void;
  primaryColor: string;
}

export default function QuestionScreen({
  questions,
  initialAnswers,
  onComplete,
  onBack,
  primaryColor,
}: QuestionScreenProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>(initialAnswers);
  const [error, setError] = useState<string>('');

  const currentQuestion = questions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === questions.length - 1;
  const canGoNext = !currentQuestion.required || answers[currentQuestion.id] !== undefined;

  const handleAnswer = (questionId: string, value: any) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: value,
    }));
    setError('');
  };

  const handleNext = () => {
    if (currentQuestion.required && answers[currentQuestion.id] === undefined) {
      setError('This question is required');
      return;
    }

    if (isLastQuestion) {
      onComplete(answers);
    } else {
      setCurrentQuestionIndex((prev) => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex === 0) {
      onBack();
    } else {
      setCurrentQuestionIndex((prev) => prev - 1);
    }
  };

  return (
    <div className="flynn-card">
      {/* Question Counter */}
      <div className="mb-6">
        <p className="text-sm font-semibold text-gray-500">
          Question {currentQuestionIndex + 1} of {questions.length}
        </p>
      </div>

      {/* Question */}
      <div className="mb-6">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">
          {currentQuestion.question}
          {currentQuestion.required && <span className="text-red-500 ml-1">*</span>}
        </h2>
        {currentQuestion.description && (
          <p className="text-sm text-gray-600">{currentQuestion.description}</p>
        )}
      </div>

      {/* Answer Input */}
      <div className="mb-8">
        <QuestionInput
          question={currentQuestion}
          value={answers[currentQuestion.id]}
          onChange={(value) => handleAnswer(currentQuestion.id, value)}
          primaryColor={primaryColor}
        />
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Navigation Buttons */}
      <div className="flex items-center space-x-3">
        <button onClick={handlePrevious} className="flynn-button-secondary">
          Back
        </button>

        <button
          onClick={handleNext}
          disabled={!canGoNext}
          className="flynn-button-primary flex-1"
          style={{ backgroundColor: canGoNext ? primaryColor : undefined }}
        >
          {isLastQuestion ? 'Continue' : 'Next'}
        </button>
      </div>
    </div>
  );
}

// Question Input Component
interface QuestionInputProps {
  question: QuestionConfig;
  value: any;
  onChange: (value: any) => void;
  primaryColor: string;
}

function QuestionInput({ question, value, onChange, primaryColor }: QuestionInputProps) {
  switch (question.type) {
    case 'yes_no':
      return (
        <div className="flex space-x-4">
          <button
            onClick={() => onChange(true)}
            className={`flex-1 py-4 px-6 rounded-lg border-2 font-semibold transition-all ${
              value === true
                ? 'border-current text-white'
                : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
            }`}
            style={value === true ? { backgroundColor: primaryColor, borderColor: primaryColor } : {}}
          >
            Yes
          </button>
          <button
            onClick={() => onChange(false)}
            className={`flex-1 py-4 px-6 rounded-lg border-2 font-semibold transition-all ${
              value === false
                ? 'border-current text-white'
                : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
            }`}
            style={value === false ? { backgroundColor: primaryColor, borderColor: primaryColor } : {}}
          >
            No
          </button>
        </div>
      );

    case 'single_choice':
      return (
        <div className="space-y-3">
          {question.options?.map((option) => (
            <button
              key={option.id}
              onClick={() => onChange(option.value)}
              className={`w-full py-4 px-6 rounded-lg border-2 font-semibold text-left transition-all flex items-center ${
                value === option.value
                  ? 'border-current text-white'
                  : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
              }`}
              style={
                value === option.value ? { backgroundColor: primaryColor, borderColor: primaryColor } : {}
              }
            >
              {option.icon && <span className="mr-3 text-xl">{option.icon}</span>}
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      );

    case 'multi_select':
      const selectedValues = Array.isArray(value) ? value : [];
      return (
        <div className="space-y-3">
          {question.options?.map((option) => {
            const isSelected = selectedValues.includes(option.value);
            return (
              <button
                key={option.id}
                onClick={() => {
                  if (isSelected) {
                    onChange(selectedValues.filter((v) => v !== option.value));
                  } else {
                    onChange([...selectedValues, option.value]);
                  }
                }}
                className={`w-full py-4 px-6 rounded-lg border-2 font-semibold text-left transition-all flex items-center ${
                  isSelected
                    ? 'border-current text-white'
                    : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                }`}
                style={
                  isSelected ? { backgroundColor: primaryColor, borderColor: primaryColor } : {}
                }
              >
                <span className="mr-3 text-xl">{isSelected ? '☑' : '☐'}</span>
                {option.icon && <span className="mr-3 text-xl">{option.icon}</span>}
                <span>{option.label}</span>
              </button>
            );
          })}
        </div>
      );

    case 'short_text':
      return (
        <input
          type="text"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={question.placeholder}
          maxLength={question.maxLength}
          className="flynn-input"
        />
      );

    case 'long_text':
      return (
        <textarea
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={question.placeholder}
          maxLength={question.maxLength}
          rows={5}
          className="flynn-input"
        />
      );

    case 'number':
      return (
        <div>
          <div className="flex items-center space-x-3">
            <input
              type="number"
              value={value || ''}
              onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined)}
              placeholder={question.placeholder}
              min={question.min}
              max={question.max}
              step={question.step || 1}
              className="flynn-input flex-1"
            />
            {question.unit && (
              <span className="text-gray-600 font-medium">{question.unit}</span>
            )}
          </div>
          {(question.min !== undefined || question.max !== undefined) && (
            <p className="text-xs text-gray-500 mt-2">
              {question.min !== undefined && question.max !== undefined
                ? `Range: ${question.min} - ${question.max}`
                : question.min !== undefined
                ? `Minimum: ${question.min}`
                : `Maximum: ${question.max}`}
            </p>
          )}
        </div>
      );

    case 'address':
      return (
        <input
          type="text"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={question.placeholder || 'Enter your address or suburb'}
          className="flynn-input"
        />
      );

    case 'date_time':
      return (
        <input
          type="datetime-local"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          className="flynn-input"
        />
      );

    default:
      return (
        <div className="p-4 bg-gray-100 rounded-lg">
          <p className="text-sm text-gray-600">Unsupported question type: {question.type}</p>
        </div>
      );
  }
}
