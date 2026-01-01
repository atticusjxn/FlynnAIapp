'use client';

import { useState } from 'react';

interface ContactDetailsScreenProps {
  requirePhone: boolean;
  requireEmail: boolean;
  initialDetails: { name: string; phone: string; email?: string; address?: string } | null;
  onComplete: (details: { name: string; phone: string; email?: string; address?: string }) => void;
  onBack: () => void;
  primaryColor: string;
}

export default function ContactDetailsScreen({
  requirePhone,
  requireEmail,
  initialDetails,
  onComplete,
  onBack,
  primaryColor,
}: ContactDetailsScreenProps) {
  const [name, setName] = useState(initialDetails?.name || '');
  const [phone, setPhone] = useState(initialDetails?.phone || '');
  const [email, setEmail] = useState(initialDetails?.email || '');
  const [address, setAddress] = useState(initialDetails?.address || '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (requirePhone && !phone.trim()) {
      newErrors.phone = 'Phone number is required';
    }

    if (requireEmail && !email.trim()) {
      newErrors.email = 'Email is required';
    } else if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Please enter a valid email';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (validate()) {
      onComplete({
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
        address: address.trim() || undefined,
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flynn-card">
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Your Contact Details</h2>
      <p className="text-sm text-gray-600 mb-6">
        So we can send you the quote
      </p>

      <div className="space-y-4 mb-6">
        {/* Name */}
        <div>
          <label className="flynn-label">
            Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="John Smith"
            className={`flynn-input ${errors.name ? 'border-red-500' : ''}`}
          />
          {errors.name && <p className="text-xs text-red-600 mt-1">{errors.name}</p>}
        </div>

        {/* Phone */}
        <div>
          <label className="flynn-label">
            Phone {requirePhone && <span className="text-red-500">*</span>}
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="0412 345 678"
            className={`flynn-input ${errors.phone ? 'border-red-500' : ''}`}
          />
          {errors.phone && <p className="text-xs text-red-600 mt-1">{errors.phone}</p>}
        </div>

        {/* Email */}
        <div>
          <label className="flynn-label">
            Email {requireEmail && <span className="text-red-500">*</span>}
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="john@example.com"
            className={`flynn-input ${errors.email ? 'border-red-500' : ''}`}
          />
          {errors.email && <p className="text-xs text-red-600 mt-1">{errors.email}</p>}
        </div>

        {/* Address */}
        <div>
          <label className="flynn-label">Address (optional)</label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="123 Main St, Sydney NSW 2000"
            className="flynn-input"
          />
        </div>
      </div>

      <div className="flex items-center space-x-3">
        <button type="button" onClick={onBack} className="flynn-button-secondary">
          Back
        </button>
        <button
          type="submit"
          className="flynn-button-primary flex-1"
          style={{ backgroundColor: primaryColor }}
        >
          Review Quote Request
        </button>
      </div>
    </form>
  );
}
