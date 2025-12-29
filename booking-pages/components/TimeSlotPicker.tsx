'use client';

import { useState, useEffect } from 'react';
import { BookingPage, BookingSlot } from '@/lib/supabase';
import { format } from 'date-fns';

interface TimeSlotPickerProps {
  bookingPage: BookingPage;
  selectedDate: Date;
  selectedTimeSlot: { start: string; end: string } | null;
  onTimeSlotSelect: (slot: { start: string; end: string }) => void;
  onBack: () => void;
  primaryColor: string;
}

export default function TimeSlotPicker({
  bookingPage,
  selectedDate,
  selectedTimeSlot,
  onTimeSlotSelect,
  onBack,
  primaryColor,
}: TimeSlotPickerProps) {
  const [slots, setSlots] = useState<BookingSlot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAvailableSlots();
  }, [selectedDate]);

  const fetchAvailableSlots = async () => {
    setLoading(true);
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const response = await fetch(
        `/api/booking/${bookingPage.slug}/availability?date=${dateStr}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch available slots');
      }

      const data = await response.json();
      setSlots(data.slots || []);
    } catch (error) {
      console.error('Error fetching slots:', error);
      setSlots([]);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return format(date, 'h:mm a');
  };

  const availableSlots = slots.filter((slot) => slot.is_available);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Select a Time</h2>
          <p className="text-sm text-gray-600 mt-1">
            {format(selectedDate, 'EEEE, MMMM d, yyyy')}
          </p>
        </div>
        <button
          onClick={onBack}
          className="text-sm text-gray-600 hover:text-gray-900 flex items-center"
        >
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Change Date
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
        </div>
      ) : availableSlots.length === 0 ? (
        <div className="text-center py-12">
          <svg
            className="w-16 h-16 text-gray-400 mx-auto mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No Available Times
          </h3>
          <p className="text-gray-600 mb-6">
            There are no available time slots for this date. Please select another date.
          </p>
          <button onClick={onBack} className="flynn-button-primary">
            Choose Different Date
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {availableSlots.map((slot, index) => {
            const isSelected =
              selectedTimeSlot?.start === slot.start_time &&
              selectedTimeSlot?.end === slot.end_time;

            return (
              <button
                key={index}
                onClick={() =>
                  onTimeSlotSelect({ start: slot.start_time, end: slot.end_time })
                }
                className={`
                  py-3 px-4 rounded-lg font-medium text-sm transition-all
                  ${isSelected ? 'ring-2 ring-offset-2' : 'border border-gray-300 hover:border-gray-400'}
                `}
                style={{
                  backgroundColor: isSelected ? primaryColor : '#FFFFFF',
                  color: isSelected ? '#FFFFFF' : '#1E293B',
                }}
              >
                {formatTime(slot.start_time)}
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-6 pt-6 border-t border-gray-200">
        <div className="flex items-center text-sm text-gray-600">
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>
            Appointment duration: {bookingPage.slot_duration_minutes} minutes
          </span>
        </div>
      </div>
    </div>
  );
}
