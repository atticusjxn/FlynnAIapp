'use client';

import { format } from 'date-fns';

interface ConfirmationModalProps {
  booking: {
    id: string;
    customer_name: string;
    customer_phone: string;
    customer_email?: string;
    start_time: string;
    end_time: string;
  };
  businessName: string;
  onClose: () => void;
}

export default function ConfirmationModal({
  booking,
  businessName,
  onClose,
}: ConfirmationModalProps) {
  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return format(date, 'h:mm a');
  };

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return format(date, 'EEEE, MMMM d, yyyy');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-flynn max-w-md w-full p-8 shadow-flynn-lg animate-fade-in">
        {/* Success Icon */}
        <div className="flex items-center justify-center mb-6">
          <div className="w-16 h-16 bg-success-light rounded-full flex items-center justify-center">
            <svg
              className="w-10 h-10 text-success"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
        </div>

        {/* Title */}
        <h2 className="text-2xl font-bold text-gray-900 text-center mb-2">
          Booking Confirmed!
        </h2>
        <p className="text-gray-600 text-center mb-6">
          Your appointment has been successfully scheduled
        </p>

        {/* Booking Details */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6 space-y-3">
          <div>
            <p className="text-sm text-gray-600">Business</p>
            <p className="font-semibold text-gray-900">{businessName}</p>
          </div>

          <div>
            <p className="text-sm text-gray-600">Date & Time</p>
            <p className="font-semibold text-gray-900">{formatDate(booking.start_time)}</p>
            <p className="text-sm text-gray-700">
              {formatTime(booking.start_time)} - {formatTime(booking.end_time)}
            </p>
          </div>

          <div>
            <p className="text-sm text-gray-600">Contact</p>
            <p className="font-semibold text-gray-900">{booking.customer_name}</p>
            <p className="text-sm text-gray-700">{booking.customer_phone}</p>
            {booking.customer_email && (
              <p className="text-sm text-gray-700">{booking.customer_email}</p>
            )}
          </div>

          <div>
            <p className="text-sm text-gray-600">Confirmation Number</p>
            <p className="font-mono text-sm font-semibold text-gray-900">
              {booking.id.substring(0, 8).toUpperCase()}
            </p>
          </div>
        </div>

        {/* Confirmation Message */}
        <div className="bg-primary-light border-l-4 border-primary p-4 rounded mb-6">
          <div className="flex items-start">
            <svg
              className="w-5 h-5 text-primary mr-3 mt-0.5 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div className="text-sm">
              <p className="font-semibold text-gray-900 mb-1">
                Confirmation sent
              </p>
              <p className="text-gray-700">
                We've sent a confirmation {booking.customer_email ? 'email and SMS' : 'SMS'} to you.
                You'll also receive a reminder before your appointment.
              </p>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={onClose}
          className="flynn-button-primary w-full"
        >
          Done
        </button>

        {/* Additional Info */}
        <p className="text-xs text-gray-500 text-center mt-4">
          Need to make changes? Contact {businessName} directly.
        </p>
      </div>
    </div>
  );
}
