'use client';

import { useState } from 'react';
import { BookingPage, CustomField } from '@/lib/supabase';
import { format } from 'date-fns';

interface BookingFormProps {
  bookingPage: BookingPage;
  selectedDate: Date;
  selectedTimeSlot: { start: string; end: string };
  onSubmit: (formData: any) => void;
  onBack: () => void;
  isSubmitting: boolean;
  primaryColor: string;
}

export default function BookingForm({
  bookingPage,
  selectedDate,
  selectedTimeSlot,
  onSubmit,
  onBack,
  isSubmitting,
  primaryColor,
}: BookingFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    notes: '',
    customFields: {} as Record<string, any>,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const customFields = bookingPage.custom_fields || [];

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleCustomFieldChange = (fieldLabel: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      customFields: {
        ...prev.customFields,
        [fieldLabel]: value,
      },
    }));
    if (errors[`custom_${fieldLabel}`]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[`custom_${fieldLabel}`];
        return newErrors;
      });
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone number is required';
    } else if (!/^[\d\s\-\+\(\)]+$/.test(formData.phone)) {
      newErrors.phone = 'Please enter a valid phone number';
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    // Validate custom fields
    customFields.forEach((field) => {
      if (field.required && !formData.customFields[field.label]) {
        newErrors[`custom_${field.label}`] = `${field.label} is required`;
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (validateForm()) {
      onSubmit(formData);
    }
  };

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return format(date, 'h:mm a');
  };

  const renderCustomField = (field: CustomField) => {
    const value = formData.customFields[field.label] || '';
    const error = errors[`custom_${field.label}`];

    switch (field.type) {
      case 'text':
        return (
          <div key={field.label}>
            <label className="flynn-label">
              {field.label}
              {field.required && <span className="text-error ml-1">*</span>}
            </label>
            <input
              type="text"
              className={`flynn-input ${error ? 'border-error' : ''}`}
              value={value}
              onChange={(e) => handleCustomFieldChange(field.label, e.target.value)}
              placeholder={field.placeholder}
            />
            {error && <p className="text-error text-sm mt-1">{error}</p>}
          </div>
        );

      case 'textarea':
        return (
          <div key={field.label}>
            <label className="flynn-label">
              {field.label}
              {field.required && <span className="text-error ml-1">*</span>}
            </label>
            <textarea
              className={`flynn-input ${error ? 'border-error' : ''}`}
              value={value}
              onChange={(e) => handleCustomFieldChange(field.label, e.target.value)}
              placeholder={field.placeholder}
              rows={4}
            />
            {error && <p className="text-error text-sm mt-1">{error}</p>}
          </div>
        );

      case 'select':
        return (
          <div key={field.label}>
            <label className="flynn-label">
              {field.label}
              {field.required && <span className="text-error ml-1">*</span>}
            </label>
            <select
              className={`flynn-input ${error ? 'border-error' : ''}`}
              value={value}
              onChange={(e) => handleCustomFieldChange(field.label, e.target.value)}
            >
              <option value="">Select an option</option>
              {field.options?.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            {error && <p className="text-error text-sm mt-1">{error}</p>}
          </div>
        );

      case 'radio':
        return (
          <div key={field.label}>
            <label className="flynn-label">
              {field.label}
              {field.required && <span className="text-error ml-1">*</span>}
            </label>
            <div className="space-y-2">
              {field.options?.map((option) => (
                <label key={option} className="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    name={field.label}
                    value={option}
                    checked={value === option}
                    onChange={(e) => handleCustomFieldChange(field.label, e.target.value)}
                    className="mr-2"
                    style={{ accentColor: primaryColor }}
                  />
                  <span className="text-gray-700">{option}</span>
                </label>
              ))}
            </div>
            {error && <p className="text-error text-sm mt-1">{error}</p>}
          </div>
        );

      case 'checkbox':
        return (
          <div key={field.label}>
            <label className="flynn-label">
              {field.label}
              {field.required && <span className="text-error ml-1">*</span>}
            </label>
            <div className="space-y-2">
              {field.options?.map((option) => {
                const checked = Array.isArray(value) ? value.includes(option) : false;
                return (
                  <label key={option} className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        const currentValues = Array.isArray(value) ? value : [];
                        const newValues = e.target.checked
                          ? [...currentValues, option]
                          : currentValues.filter((v) => v !== option);
                        handleCustomFieldChange(field.label, newValues);
                      }}
                      className="mr-2"
                      style={{ accentColor: primaryColor }}
                    />
                    <span className="text-gray-700">{option}</span>
                  </label>
                );
              })}
            </div>
            {error && <p className="text-error text-sm mt-1">{error}</p>}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Your Details</h2>
        <button
          onClick={onBack}
          className="text-sm text-gray-600 hover:text-gray-900 flex items-center"
          disabled={isSubmitting}
        >
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Change Time
        </button>
      </div>

      {/* Booking Summary */}
      <div
        className="p-4 rounded-lg mb-6"
        style={{ backgroundColor: `${primaryColor}10` }}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">Selected Date & Time</p>
            <p className="font-semibold text-gray-900">
              {format(selectedDate, 'EEEE, MMMM d, yyyy')}
            </p>
            <p className="text-sm text-gray-700">
              {formatTime(selectedTimeSlot.start)} - {formatTime(selectedTimeSlot.end)}
            </p>
          </div>
          <svg
            className="w-8 h-8"
            style={{ color: primaryColor }}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Standard Fields */}
        <div>
          <label className="flynn-label">
            Name<span className="text-error ml-1">*</span>
          </label>
          <input
            type="text"
            className={`flynn-input ${errors.name ? 'border-error' : ''}`}
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            placeholder="Enter your full name"
            disabled={isSubmitting}
          />
          {errors.name && <p className="text-error text-sm mt-1">{errors.name}</p>}
        </div>

        <div>
          <label className="flynn-label">
            Phone Number<span className="text-error ml-1">*</span>
          </label>
          <input
            type="tel"
            className={`flynn-input ${errors.phone ? 'border-error' : ''}`}
            value={formData.phone}
            onChange={(e) => handleChange('phone', e.target.value)}
            placeholder="Enter your phone number"
            disabled={isSubmitting}
          />
          {errors.phone && <p className="text-error text-sm mt-1">{errors.phone}</p>}
        </div>

        <div>
          <label className="flynn-label">Email (Optional)</label>
          <input
            type="email"
            className={`flynn-input ${errors.email ? 'border-error' : ''}`}
            value={formData.email}
            onChange={(e) => handleChange('email', e.target.value)}
            placeholder="your.email@example.com"
            disabled={isSubmitting}
          />
          {errors.email && <p className="text-error text-sm mt-1">{errors.email}</p>}
        </div>

        {/* Custom Fields */}
        {customFields.map((field) => renderCustomField(field))}

        {/* Additional Notes */}
        <div>
          <label className="flynn-label">Additional Notes (Optional)</label>
          <textarea
            className="flynn-input"
            value={formData.notes}
            onChange={(e) => handleChange('notes', e.target.value)}
            placeholder="Any additional information you'd like to share"
            rows={3}
            disabled={isSubmitting}
          />
        </div>

        {/* Submit Button */}
        <div className="flex space-x-3 pt-6">
          <button
            type="button"
            onClick={onBack}
            className="flynn-button-secondary flex-1"
            disabled={isSubmitting}
          >
            Back
          </button>
          <button
            type="submit"
            className="flynn-button-primary flex-1"
            disabled={isSubmitting}
            style={{ backgroundColor: primaryColor }}
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center">
                <svg
                  className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Booking...
              </span>
            ) : (
              'Confirm Booking'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
