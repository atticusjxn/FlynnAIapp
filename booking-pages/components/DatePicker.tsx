'use client';

import { useState, useEffect } from 'react';
import { BookingPage } from '@/lib/supabase';
import {
  addDays,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  format,
  isSameDay,
  isToday,
  isBefore,
  startOfDay,
  addMonths,
  subMonths,
} from 'date-fns';

interface DatePickerProps {
  bookingPage: BookingPage;
  selectedDate: Date | null;
  onDateSelect: (date: Date) => void;
  primaryColor: string;
}

export default function DatePicker({
  bookingPage,
  selectedDate,
  onDateSelect,
  primaryColor,
}: DatePickerProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [availableDates, setAvailableDates] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Calculate available dates based on business hours
    const available = new Set<string>();
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

    const dayNameMap: { [key: number]: keyof typeof bookingPage.business_hours } = {
      0: 'sunday',
      1: 'monday',
      2: 'tuesday',
      3: 'wednesday',
      4: 'thursday',
      5: 'friday',
      6: 'saturday',
    };

    daysInMonth.forEach((day) => {
      const dayName = dayNameMap[day.getDay()];
      const businessDay = bookingPage.business_hours[dayName];

      // Check if day is enabled and not in the past
      if (businessDay.enabled && !isBefore(day, startOfDay(new Date()))) {
        // Check max days advance
        const maxDate = addDays(new Date(), bookingPage.max_days_advance || 60);
        if (!isBefore(maxDate, day)) {
          available.add(format(day, 'yyyy-MM-dd'));
        }
      }
    });

    setAvailableDates(available);
  }, [currentMonth, bookingPage]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Pad start with empty cells
  const startDayOfWeek = monthStart.getDay();
  const paddingDays = Array(startDayOfWeek).fill(null);

  const handlePreviousMonth = () => {
    const prevMonth = subMonths(currentMonth, 1);
    // Don't go before current month
    if (!isBefore(endOfMonth(prevMonth), startOfDay(new Date()))) {
      setCurrentMonth(prevMonth);
    }
  };

  const handleNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-6">Select a Date</h2>

      {/* Month Navigation */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={handlePreviousMonth}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          aria-label="Previous month"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <h3 className="text-lg font-semibold text-gray-800">
          {format(currentMonth, 'MMMM yyyy')}
        </h3>

        <button
          onClick={handleNextMonth}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          aria-label="Next month"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-2">
        {/* Day Headers */}
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div key={day} className="text-center text-sm font-medium text-gray-600 py-2">
            {day}
          </div>
        ))}

        {/* Padding Days */}
        {paddingDays.map((_, index) => (
          <div key={`padding-${index}`} />
        ))}

        {/* Calendar Days */}
        {daysInMonth.map((day) => {
          const dateKey = format(day, 'yyyy-MM-dd');
          const isAvailable = availableDates.has(dateKey);
          const isSelected = selectedDate && isSameDay(day, selectedDate);
          const isPast = isBefore(day, startOfDay(new Date()));
          const isCurrentDay = isToday(day);

          return (
            <button
              key={dateKey}
              onClick={() => isAvailable && onDateSelect(day)}
              disabled={!isAvailable}
              className={`
                aspect-square rounded-lg font-medium text-sm transition-all
                ${isSelected ? 'ring-2 ring-offset-2' : ''}
                ${isAvailable ? 'hover:bg-gray-100 cursor-pointer' : 'opacity-40 cursor-not-allowed'}
                ${isCurrentDay ? 'font-bold' : ''}
              `}
              style={{
                backgroundColor: isSelected ? primaryColor : 'transparent',
                color: isSelected ? '#FFFFFF' : isAvailable ? '#1E293B' : '#94A3B8',
              }}
            >
              {format(day, 'd')}
            </button>
          );
        })}
      </div>

      <div className="mt-6 flex items-center space-x-4 text-sm text-gray-600">
        <div className="flex items-center">
          <div className="w-4 h-4 rounded bg-gray-200 mr-2" />
          <span>Not available</span>
        </div>
        <div className="flex items-center">
          <div
            className="w-4 h-4 rounded mr-2"
            style={{ backgroundColor: primaryColor }}
          />
          <span>Selected</span>
        </div>
      </div>
    </div>
  );
}
