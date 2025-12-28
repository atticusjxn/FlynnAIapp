'use client';

import { useState, useEffect } from 'react';
import { BookingPage } from '@/lib/supabase';
import BusinessHeader from './BusinessHeader';
import DatePicker from './DatePicker';
import TimeSlotPicker from './TimeSlotPicker';
import BookingForm from './BookingForm';
import ConfirmationModal from './ConfirmationModal';
import FlynnFooter from './FlynnFooter';
import { format } from 'date-fns';

interface BookingPageClientProps {
  bookingPage: BookingPage;
}

type BookingStep = 'date' | 'time' | 'details' | 'confirmation';

export default function BookingPageClient({ bookingPage }: BookingPageClientProps) {
  const [step, setStep] = useState<BookingStep>('date');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<{
    start: string;
    end: string;
  } | null>(null);
  const [bookingDetails, setBookingDetails] = useState<any>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const primaryColor = bookingPage.primary_color || '#2563EB';

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    setStep('time');
  };

  const handleTimeSlotSelect = (slot: { start: string; end: string }) => {
    setSelectedTimeSlot(slot);
    setStep('details');
  };

  const handleFormSubmit = async (formData: any) => {
    setIsSubmitting(true);

    try {
      // Submit booking to API
      const response = await fetch(`/api/booking/${bookingPage.slug}/book`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          booking_page_id: bookingPage.id,
          customer_name: formData.name,
          customer_phone: formData.phone,
          customer_email: formData.email,
          start_time: selectedTimeSlot?.start,
          end_time: selectedTimeSlot?.end,
          duration_minutes: bookingPage.slot_duration_minutes,
          notes: formData.notes,
          custom_responses: formData.customFields,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create booking');
      }

      const booking = await response.json();
      setBookingDetails(booking);
      setShowConfirmation(true);
    } catch (error) {
      console.error('Error creating booking:', error);
      alert('Failed to create booking. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBackToDate = () => {
    setStep('date');
    setSelectedTimeSlot(null);
  };

  const handleBackToTime = () => {
    setStep('time');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <style jsx global>{`
        :root {
          --primary-color: ${primaryColor};
        }
      `}</style>

      {/* Business Header */}
      <BusinessHeader
        businessName={bookingPage.business_name}
        logoUrl={bookingPage.business_logo_url}
        primaryColor={primaryColor}
      />

      {/* Main Booking Flow */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Progress Indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-center space-x-4">
            <StepIndicator
              label="Date"
              isActive={step === 'date'}
              isCompleted={selectedDate !== null}
              primaryColor={primaryColor}
            />
            <div className="w-12 h-0.5 bg-gray-300" />
            <StepIndicator
              label="Time"
              isActive={step === 'time'}
              isCompleted={selectedTimeSlot !== null}
              primaryColor={primaryColor}
            />
            <div className="w-12 h-0.5 bg-gray-300" />
            <StepIndicator
              label="Details"
              isActive={step === 'details'}
              isCompleted={false}
              primaryColor={primaryColor}
            />
          </div>
        </div>

        {/* Step Content */}
        <div className="flynn-card">
          {step === 'date' && (
            <DatePicker
              bookingPage={bookingPage}
              selectedDate={selectedDate}
              onDateSelect={handleDateSelect}
              primaryColor={primaryColor}
            />
          )}

          {step === 'time' && selectedDate && (
            <TimeSlotPicker
              bookingPage={bookingPage}
              selectedDate={selectedDate}
              selectedTimeSlot={selectedTimeSlot}
              onTimeSlotSelect={handleTimeSlotSelect}
              onBack={handleBackToDate}
              primaryColor={primaryColor}
            />
          )}

          {step === 'details' && selectedDate && selectedTimeSlot && (
            <BookingForm
              bookingPage={bookingPage}
              selectedDate={selectedDate}
              selectedTimeSlot={selectedTimeSlot}
              onSubmit={handleFormSubmit}
              onBack={handleBackToTime}
              isSubmitting={isSubmitting}
              primaryColor={primaryColor}
            />
          )}
        </div>
      </div>

      {/* Powered by Flynn Footer */}
      <FlynnFooter />

      {/* Confirmation Modal */}
      {showConfirmation && bookingDetails && (
        <ConfirmationModal
          booking={bookingDetails}
          businessName={bookingPage.business_name}
          onClose={() => setShowConfirmation(false)}
        />
      )}
    </div>
  );
}

function StepIndicator({
  label,
  isActive,
  isCompleted,
  primaryColor,
}: {
  label: string;
  isActive: boolean;
  isCompleted: boolean;
  primaryColor: string;
}) {
  const bgColor = isActive || isCompleted ? primaryColor : '#E2E8F0';
  const textColor = isActive || isCompleted ? '#FFFFFF' : '#64748B';

  return (
    <div className="flex flex-col items-center">
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm transition-all"
        style={{ backgroundColor: bgColor, color: textColor }}
      >
        {isCompleted ? '✓' : label.charAt(0)}
      </div>
      <span className="text-xs font-medium text-gray-600 mt-2">{label}</span>
    </div>
  );
}
