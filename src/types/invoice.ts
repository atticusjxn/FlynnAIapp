// Invoice Types
// Invoice builder with Stripe Payment Links and payment tracking

import { LineItem } from './quote';

export interface Invoice {
  id: string;
  org_id: string;

  // References
  job_id?: string;
  client_id?: string;
  event_id?: string;
  quote_id?: string; // Link to original quote if converted

  // Invoice identification
  invoice_number: string; // e.g., "INV-2025-001"
  title?: string; // e.g., "Bathroom Renovation"

  // Line items
  line_items: LineItem[];

  // Pricing
  subtotal: number; // decimal(12, 2)
  tax_rate: number; // decimal(5, 2) - e.g., 10.00 for 10%
  tax_amount: number; // decimal(12, 2)
  total: number; // decimal(12, 2)
  amount_paid: number; // decimal(12, 2)
  amount_due: number; // decimal(12, 2)

  // Invoice details
  notes?: string; // Internal notes
  terms?: string; // Payment terms shown to customer
  due_date?: string; // ISO date string
  issued_date: string; // ISO date string

  // Customer message
  message?: string; // Custom message to include in SMS/email

  // Status
  status: InvoiceStatus;

  // Stripe integration
  stripe_payment_link_id?: string;
  stripe_payment_link_url?: string;
  stripe_invoice_id?: string; // Stripe invoice object ID
  stripe_payment_intent_id?: string; // Track specific payment

  // PDF generation
  pdf_url?: string; // Supabase Storage URL

  // Tracking
  sent_at?: string; // ISO timestamp
  sent_to?: string; // Phone or email
  viewed_at?: string;
  paid_at?: string;
  payment_method?: string; // How customer paid

  // Metadata
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export type InvoiceStatus =
  | 'draft'     // Not yet sent
  | 'sent'      // Sent to customer
  | 'viewed'    // Customer viewed the invoice
  | 'partial'   // Partially paid
  | 'paid'      // Fully paid
  | 'overdue'   // Past due date and unpaid
  | 'cancelled' // Cancelled/voided
  | 'refunded'; // Payment refunded

export interface PaymentEvent {
  id: string;
  org_id: string;

  // What was paid
  invoice_id: string;

  // Payment details
  amount: number; // decimal(12, 2)
  payment_method?: string; // stripe, cash, bank_transfer, check, etc.

  // Stripe tracking
  stripe_event_id?: string; // Stripe webhook event ID
  stripe_payment_intent_id?: string;
  stripe_charge_id?: string;

  // Status
  status: PaymentEventStatus;
  failure_reason?: string;

  // Metadata
  metadata?: Record<string, any>; // Store Stripe webhook payload
  created_at: string;
}

export type PaymentEventStatus =
  | 'succeeded' // Payment succeeded
  | 'pending'   // Payment pending
  | 'failed'    // Payment failed
  | 'refunded'; // Payment refunded

// Create Invoice Request
export interface CreateInvoiceRequest {
  org_id: string;
  job_id?: string;
  client_id?: string;
  event_id?: string;
  quote_id?: string; // Convert from quote
  title?: string;
  line_items: LineItem[];
  tax_rate?: number; // Defaults to 10.00 (Australian GST)
  notes?: string;
  terms?: string;
  due_date?: string; // ISO date string
  message?: string;
}

// Update Invoice Request
export type UpdateInvoiceRequest = Partial<Omit<CreateInvoiceRequest, 'org_id'>>;

// Send Invoice Request
export interface SendInvoiceRequest {
  invoice_id: string;
  send_to: string; // Phone number or email
  send_via: 'sms' | 'email';
  generate_payment_link?: boolean; // Default true
  generate_pdf?: boolean; // Default true
}

// Record Payment Request (manual payment recording)
export interface RecordPaymentRequest {
  invoice_id: string;
  amount: number;
  payment_method: 'cash' | 'bank_transfer' | 'check' | 'other';
  payment_date?: string; // ISO date string, defaults to now
  notes?: string;
}

// Convert Quote to Invoice Request
export interface ConvertQuoteToInvoiceRequest {
  quote_id: string;
  due_date?: string; // ISO date string
  terms?: string; // Override quote terms
}

// Invoice with related data (for admin views)
export interface InvoiceWithDetails extends Invoice {
  job?: any; // Import from jobs types if needed
  client?: any; // Import from clients types if needed
  event?: any; // Import from calendar types if needed
  quote?: any; // Import from quote types if needed
  payment_events?: PaymentEvent[];
}

// Calculate invoice totals helper
export interface InvoiceCalculation {
  subtotal: number;
  tax_amount: number;
  total: number;
  amount_paid: number;
  amount_due: number;
}

// Payment terms presets
export const PAYMENT_TERMS = {
  DUE_ON_RECEIPT: 'Payment due upon receipt',
  NET_7: 'Payment due within 7 days',
  NET_14: 'Payment due within 14 days',
  NET_30: 'Payment due within 30 days',
  NET_60: 'Payment due within 60 days',
} as const;

// Payment method options
export const PAYMENT_METHODS = {
  STRIPE: 'stripe',
  CASH: 'cash',
  BANK_TRANSFER: 'bank_transfer',
  CHECK: 'check',
  OTHER: 'other',
} as const;
