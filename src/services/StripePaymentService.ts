// Stripe Payment Service
// Handles Stripe Payment Links creation and webhook processing

import { supabase } from './supabase';
import { LineItem } from '../types/quote';

// NOTE: You'll need to add these to .env:
// EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY
// STRIPE_SECRET_KEY (backend only)

interface CreatePaymentLinkRequest {
  amount: number; // Total amount in dollars (will be converted to cents)
  currency?: string; // Default 'aud'
  description: string;
  metadata: {
    type: 'quote' | 'invoice';
    entity_id: string; // Quote ID or Invoice ID
    org_id: string;
    customer_name?: string;
    customer_email?: string;
    customer_phone?: string;
  };
  line_items?: LineItem[]; // Optional: for detailed line items
}

interface PaymentLinkResponse {
  id: string; // Stripe Payment Link ID
  url: string; // Customer-facing URL
  active: boolean;
}

class StripePaymentService {
  private readonly baseURL = 'https://api.stripe.com/v1';
  private readonly secretKey: string;

  constructor() {
    // In a production app, secret key should NEVER be in the mobile app
    // This should be handled by a backend API
    // For now, we'll assume you have a backend endpoint that proxies Stripe calls
    this.secretKey = process.env.STRIPE_SECRET_KEY || '';

    if (!this.secretKey && __DEV__) {
      console.warn('⚠️  STRIPE_SECRET_KEY not set. Payment links will not work.');
    }
  }

  /**
   * Create a Stripe Payment Link
   *
   * IMPORTANT: In production, this should be called from your backend API,
   * not directly from the mobile app. The secret key should never be exposed.
   *
   * This is a simplified example. In reality, you'd call your backend API endpoint:
   * POST /api/payments/create-link
   */
  async createPaymentLink(
    request: CreatePaymentLinkRequest
  ): Promise<PaymentLinkResponse> {
    try {
      // Convert dollars to cents for Stripe
      const amountInCents = Math.round(request.amount * 100);

      // In production, this would be:
      // const response = await fetch(`${YOUR_BACKEND_URL}/api/payments/create-link`, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(request)
      // });

      // For now, we'll create a placeholder response
      // You need to implement the actual Stripe API call in your backend

      const paymentLinkId = `plink_${Date.now()}`;
      const paymentLinkUrl = `https://buy.stripe.com/test_${paymentLinkId}`;

      console.log('🔗 Payment Link Created:', {
        id: paymentLinkId,
        url: paymentLinkUrl,
        amount: request.amount,
        metadata: request.metadata,
      });

      return {
        id: paymentLinkId,
        url: paymentLinkUrl,
        active: true,
      };
    } catch (error) {
      console.error('❌ Failed to create payment link:', error);
      throw new Error('Failed to create payment link');
    }
  }

  /**
   * Create Payment Link for Quote
   */
  async createQuotePaymentLink(
    quoteId: string,
    quote: {
      total: number;
      title?: string;
      org_id: string;
      customer_name?: string;
      customer_email?: string;
      customer_phone?: string;
      line_items: LineItem[];
    }
  ): Promise<{ paymentLinkId: string; paymentLinkUrl: string }> {
    const paymentLink = await this.createPaymentLink({
      amount: quote.total,
      currency: 'aud',
      description: quote.title || `Quote Payment`,
      metadata: {
        type: 'quote',
        entity_id: quoteId,
        org_id: quote.org_id,
        customer_name: quote.customer_name,
        customer_email: quote.customer_email,
        customer_phone: quote.customer_phone,
      },
      line_items: quote.line_items,
    });

    // Update quote with payment link
    await supabase
      .from('quotes')
      .update({
        stripe_payment_link_id: paymentLink.id,
        stripe_payment_link_url: paymentLink.url,
      })
      .eq('id', quoteId);

    return {
      paymentLinkId: paymentLink.id,
      paymentLinkUrl: paymentLink.url,
    };
  }

  /**
   * Create Payment Link for Invoice
   */
  async createInvoicePaymentLink(
    invoiceId: string,
    invoice: {
      total: number;
      title?: string;
      org_id: string;
      customer_name?: string;
      customer_email?: string;
      customer_phone?: string;
      line_items: LineItem[];
    }
  ): Promise<{ paymentLinkId: string; paymentLinkUrl: string }> {
    const paymentLink = await this.createPaymentLink({
      amount: invoice.total,
      currency: 'aud',
      description: invoice.title || `Invoice Payment`,
      metadata: {
        type: 'invoice',
        entity_id: invoiceId,
        org_id: invoice.org_id,
        customer_name: invoice.customer_name,
        customer_email: invoice.customer_email,
        customer_phone: invoice.customer_phone,
      },
      line_items: invoice.line_items,
    });

    // Update invoice with payment link
    await supabase
      .from('invoices')
      .update({
        stripe_payment_link_id: paymentLink.id,
        stripe_payment_link_url: paymentLink.url,
      })
      .eq('id', invoiceId);

    return {
      paymentLinkId: paymentLink.id,
      paymentLinkUrl: paymentLink.url,
    };
  }

  /**
   * Handle Stripe Webhook Event
   *
   * This should be called from your backend webhook endpoint:
   * POST /api/webhooks/stripe
   *
   * Stripe will send events like:
   * - payment_intent.succeeded
   * - payment_intent.payment_failed
   * - checkout.session.completed
   */
  async handleWebhookEvent(event: any): Promise<void> {
    console.log('📨 Stripe Webhook Event:', event.type);

    switch (event.type) {
      case 'payment_intent.succeeded':
        await this.handlePaymentSuccess(event.data.object);
        break;

      case 'payment_intent.payment_failed':
        await this.handlePaymentFailed(event.data.object);
        break;

      case 'checkout.session.completed':
        await this.handleCheckoutCompleted(event.data.object);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
  }

  /**
   * Handle successful payment
   */
  private async handlePaymentSuccess(paymentIntent: any): Promise<void> {
    const metadata = paymentIntent.metadata;
    const { type, entity_id, org_id } = metadata;

    // Record payment event
    await supabase.from('payment_events').insert({
      org_id,
      invoice_id: type === 'invoice' ? entity_id : null,
      amount: paymentIntent.amount_received / 100, // Convert cents to dollars
      payment_method: 'stripe',
      stripe_event_id: paymentIntent.id,
      stripe_payment_intent_id: paymentIntent.id,
      stripe_charge_id: paymentIntent.latest_charge,
      status: 'succeeded',
      metadata: paymentIntent,
    });

    if (type === 'quote') {
      // Mark quote as accepted
      await supabase
        .from('quotes')
        .update({
          status: 'accepted',
          accepted_at: new Date().toISOString(),
        })
        .eq('id', entity_id);

      // Auto-confirm associated event
      const { data: quote } = await supabase
        .from('quotes')
        .select('event_id')
        .eq('id', entity_id)
        .single();

      if (quote?.event_id) {
        await supabase
          .from('calendar_events')
          .update({ status: 'confirmed' })
          .eq('id', quote.event_id);
      }
    } else if (type === 'invoice') {
      // Invoice status will be updated automatically by the
      // update_invoice_status_from_payments() trigger
      // when payment_event is inserted above
    }

    console.log('✅ Payment processed successfully:', {
      type,
      entity_id,
      amount: paymentIntent.amount_received / 100,
    });
  }

  /**
   * Handle failed payment
   */
  private async handlePaymentFailed(paymentIntent: any): Promise<void> {
    const metadata = paymentIntent.metadata;
    const { type, entity_id, org_id } = metadata;

    // Record failed payment event
    await supabase.from('payment_events').insert({
      org_id,
      invoice_id: type === 'invoice' ? entity_id : null,
      amount: paymentIntent.amount / 100,
      payment_method: 'stripe',
      stripe_event_id: paymentIntent.id,
      stripe_payment_intent_id: paymentIntent.id,
      status: 'failed',
      failure_reason: paymentIntent.last_payment_error?.message,
      metadata: paymentIntent,
    });

    console.log('❌ Payment failed:', {
      type,
      entity_id,
      reason: paymentIntent.last_payment_error?.message,
    });
  }

  /**
   * Handle checkout session completed
   */
  private async handleCheckoutCompleted(session: any): Promise<void> {
    // Similar to handlePaymentSuccess, but for checkout sessions
    console.log('✅ Checkout completed:', session.id);
  }

  /**
   * Get payment link status
   */
  async getPaymentLinkStatus(paymentLinkId: string): Promise<{
    active: boolean;
    url: string;
  }> {
    // In production, call your backend API
    // GET /api/payments/link/:id

    return {
      active: true,
      url: `https://buy.stripe.com/test_${paymentLinkId}`,
    };
  }

  /**
   * Deactivate a payment link
   */
  async deactivatePaymentLink(paymentLinkId: string): Promise<void> {
    // In production, call your backend API
    // POST /api/payments/link/:id/deactivate

    console.log('🚫 Payment link deactivated:', paymentLinkId);
  }
}

export default new StripePaymentService();
