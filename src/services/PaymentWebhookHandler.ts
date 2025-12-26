// Payment Webhook Handler
// Processes Stripe webhook events and updates quote/invoice/event/job status

import { supabase } from './supabase';
import QuoteService from './QuoteService';
import InvoiceService from './InvoiceService';

interface StripeWebhookEvent {
  id: string;
  type: string;
  data: {
    object: {
      id: string;
      amount_total?: number;
      payment_status?: string;
      metadata?: {
        quote_id?: string;
        invoice_id?: string;
        event_id?: string;
        job_id?: string;
      };
    };
  };
}

class PaymentWebhookHandler {
  /**
   * Handle incoming Stripe webhook event
   */
  async handleWebhook(event: StripeWebhookEvent): Promise<void> {
    console.log(`[PaymentWebhook] Received event: ${event.type}`);

    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutCompleted(event);
        break;

      case 'payment_intent.succeeded':
        await this.handlePaymentSucceeded(event);
        break;

      case 'payment_intent.payment_failed':
        await this.handlePaymentFailed(event);
        break;

      default:
        console.log(`[PaymentWebhook] Unhandled event type: ${event.type}`);
    }
  }

  /**
   * Handle successful checkout session
   */
  private async handleCheckoutCompleted(event: StripeWebhookEvent): Promise<void> {
    const session = event.data.object;
    const metadata = session.metadata || {};

    try {
      // Update quote if quote_id is present
      if (metadata.quote_id) {
        await this.updateQuotePayment(
          metadata.quote_id,
          session.amount_total || 0,
          session.payment_status === 'paid'
        );

        // Update associated event if event_id is present
        if (metadata.event_id) {
          await this.updateEventStatus(metadata.event_id, 'confirmed');
        }
      }

      // Update invoice if invoice_id is present
      if (metadata.invoice_id) {
        await this.updateInvoicePayment(
          metadata.invoice_id,
          session.amount_total || 0,
          session.payment_status === 'paid'
        );

        // Update associated job/event if present
        if (metadata.event_id) {
          await this.updateEventStatus(metadata.event_id, 'complete');
        }

        if (metadata.job_id) {
          await this.updateJobStatus(metadata.job_id, 'paid');
        }
      }

      // Record payment event
      await this.recordPaymentEvent({
        stripe_event_id: event.id,
        event_type: event.type,
        quote_id: metadata.quote_id || null,
        invoice_id: metadata.invoice_id || null,
        amount: session.amount_total || 0,
        status: session.payment_status || 'unknown',
        metadata: session,
      });

      console.log('[PaymentWebhook] Checkout completed successfully');
    } catch (error) {
      console.error('[PaymentWebhook] Error handling checkout completed:', error);
      throw error;
    }
  }

  /**
   * Handle successful payment intent
   */
  private async handlePaymentSucceeded(event: StripeWebhookEvent): Promise<void> {
    const paymentIntent = event.data.object;
    const metadata = paymentIntent.metadata || {};

    try {
      // Similar logic to checkout completed
      if (metadata.invoice_id) {
        await this.updateInvoicePayment(
          metadata.invoice_id,
          paymentIntent.amount_total || 0,
          true
        );

        if (metadata.event_id) {
          await this.updateEventStatus(metadata.event_id, 'complete');
        }

        if (metadata.job_id) {
          await this.updateJobStatus(metadata.job_id, 'paid');
        }
      }

      await this.recordPaymentEvent({
        stripe_event_id: event.id,
        event_type: event.type,
        quote_id: metadata.quote_id || null,
        invoice_id: metadata.invoice_id || null,
        amount: paymentIntent.amount_total || 0,
        status: 'succeeded',
        metadata: paymentIntent,
      });

      console.log('[PaymentWebhook] Payment succeeded');
    } catch (error) {
      console.error('[PaymentWebhook] Error handling payment succeeded:', error);
      throw error;
    }
  }

  /**
   * Handle failed payment
   */
  private async handlePaymentFailed(event: StripeWebhookEvent): Promise<void> {
    const paymentIntent = event.data.object;
    const metadata = paymentIntent.metadata || {};

    try {
      await this.recordPaymentEvent({
        stripe_event_id: event.id,
        event_type: event.type,
        quote_id: metadata.quote_id || null,
        invoice_id: metadata.invoice_id || null,
        amount: paymentIntent.amount_total || 0,
        status: 'failed',
        metadata: paymentIntent,
      });

      console.log('[PaymentWebhook] Payment failed');
    } catch (error) {
      console.error('[PaymentWebhook] Error handling payment failed:', error);
      throw error;
    }
  }

  /**
   * Update quote payment status
   */
  private async updateQuotePayment(
    quoteId: string,
    amount: number,
    isPaid: boolean
  ): Promise<void> {
    if (isPaid) {
      await QuoteService.acceptQuote(quoteId);
    }

    await supabase
      .from('quotes')
      .update({
        stripe_payment_status: isPaid ? 'paid' : 'pending',
      })
      .eq('id', quoteId);
  }

  /**
   * Update invoice payment status
   */
  private async updateInvoicePayment(
    invoiceId: string,
    amount: number,
    isPaid: boolean
  ): Promise<void> {
    if (isPaid) {
      // Convert amount from cents to dollars
      const amountDollars = amount / 100;

      await InvoiceService.recordPayment({
        invoice_id: invoiceId,
        amount: amountDollars,
        payment_method: 'stripe',
        payment_date: new Date().toISOString(),
      });
    }
  }

  /**
   * Update calendar event status
   */
  private async updateEventStatus(eventId: string, status: string): Promise<void> {
    const { error } = await supabase
      .from('calendar_events')
      .update({ status })
      .eq('id', eventId);

    if (error) {
      console.error('[PaymentWebhook] Error updating event status:', error);
      throw error;
    }
  }

  /**
   * Update job status
   */
  private async updateJobStatus(jobId: string, status: string): Promise<void> {
    const { error } = await supabase
      .from('jobs')
      .update({ status })
      .eq('id', jobId);

    if (error) {
      console.error('[PaymentWebhook] Error updating job status:', error);
      throw error;
    }
  }

  /**
   * Record payment event for audit trail
   */
  private async recordPaymentEvent(event: {
    stripe_event_id: string;
    event_type: string;
    quote_id: string | null;
    invoice_id: string | null;
    amount: number;
    status: string;
    metadata: any;
  }): Promise<void> {
    const { error } = await supabase.from('payment_events').insert({
      stripe_event_id: event.stripe_event_id,
      event_type: event.event_type,
      quote_id: event.quote_id,
      invoice_id: event.invoice_id,
      amount: event.amount / 100, // Convert from cents to dollars
      status: event.status,
      metadata: event.metadata,
    });

    if (error) {
      console.error('[PaymentWebhook] Error recording payment event:', error);
      throw error;
    }
  }
}

export default new PaymentWebhookHandler();
